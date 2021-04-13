package main

import (
	"context"
	"flag"
	"fmt"
	"log"
	"net/http"
	"sync"

	"github.com/frankrap/deribit-api"
	"github.com/frankrap/deribit-api/models"
	"github.com/gorilla/websocket"
	"github.com/kelseyhightower/envconfig"
	"go.uber.org/zap"
	"go.uber.org/zap/zapcore"
)

type config struct {
	DeribitAPIKey    string `envconfig:"DERIBIT_API_KEY" required:"true"`
	DeribitSecretKey string `envconfig:"DERIBIT_SECRET_KEY" required:"true"`
}

type tick struct {
	InstrumentName string  `json:"instrumentName"`
	Bid            float64 `json:"bid"`
	Ask            float64 `json:"ask"`
}

type connection struct {
	Conn      *websocket.Conn
	Context   context.Context
	MessageCh chan<- *tick
}

var loggingLevel = zap.LevelFlag("level", zapcore.DebugLevel, "")

func buildLogger() *zap.SugaredLogger {
	cfg := zap.NewDevelopmentConfig()
	cfg.Level = zap.NewAtomicLevelAt(*loggingLevel)
	logger, _ := cfg.Build()
	return logger.Sugar()
}

func main() {
	flag.Parse()
	var c config
	if err := envconfig.Process("server", &c); err != nil {
		log.Fatal(err)
	}

	logger := buildLogger()
	defer logger.Sync()

	cfg := &deribit.Configuration{
		Addr:          deribit.RealBaseURL,
		ApiKey:        c.DeribitAPIKey,
		SecretKey:     c.DeribitSecretKey,
		AutoReconnect: true,
	}
	client := deribit.New(cfg)

	instruments, err := client.GetInstruments(&models.GetInstrumentsParams{
		Currency: "BTC",
		Kind:     "future",
		Expired:  false,
	})
	if err != nil {
		logger.Fatal(err)
	}
	tickers := []string{}
	for _, instrument := range instruments {
		logger.Debug(instrument)
		tickers = append(tickers, fmt.Sprintf("ticker.%s.raw", instrument.InstrumentName))
	}

	ticks := make(chan *tick)
	for _, ticker := range tickers {
		client.On(ticker, func(e *models.TickerNotification) {
			logger.Debugf("%s\t%.2f\t%.2f", e.InstrumentName, e.BestAskPrice, e.BestBidPrice)
			ticks <- &tick{
				InstrumentName: e.InstrumentName,
				Ask:            e.BestAskPrice,
				Bid:            e.BestBidPrice,
			}
		})
	}
	client.Subscribe(tickers)

	connections := sync.Map{}
	go func() {
		for t := range ticks {
			connections.Range(func(k interface{}, v interface{}) bool {
				// Range is not necessarily consistent so make sure it's still there.
				if _, ok := connections.Load(k); !ok {
					return true
				}
				c := v.(*connection)
				select {
				case <-c.Context.Done():
					logger.Debugf("ending subscription for %v", c.Conn.RemoteAddr())
					close(c.MessageCh)
					connections.Delete(k)
				case c.MessageCh <- t:
				}
				return true
			})
		}
	}()

	upgrader := websocket.Upgrader{
		ReadBufferSize:  1024,
		WriteBufferSize: 1024,
		CheckOrigin: func(r *http.Request) bool {
			return true
		},
	}
	http.HandleFunc("/subscribe", func(w http.ResponseWriter, r *http.Request) {
		logger.Infof("New connection from: %v", r.RemoteAddr)
		conn, err := upgrader.Upgrade(w, r, nil)
		if err != nil {
			http.Error(w, "failed to upgrade websocket", http.StatusUpgradeRequired)
			return
		}
		ctx, cancel := context.WithCancel(context.Background())
		defer cancel()
		receiverCh := make(chan *tick)
		connections.Store(conn, &connection{
			Conn:      conn,
			Context:   ctx,
			MessageCh: receiverCh,
		})
		for t := range receiverCh {
			if err := conn.WriteJSON(t); err != nil {
				logger.Warnf("failed to write message to subscriber: %v", err)
				// Should close the websocket and stop any more writes to the channel.
				logger.Debugf("cancelling subscription for %v", conn.RemoteAddr)
				cancel()
				return
			}
		}
	})

	logger.Info("Listening...")
	if err := http.ListenAndServe(":12345", nil); err != nil {
		logger.Error(err)
	}
}
