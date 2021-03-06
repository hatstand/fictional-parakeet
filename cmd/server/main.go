package main

import (
	"context"
	"flag"
	"fmt"
	"log"
	"net/http"
	"os"
	"runtime"
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

type message struct {
	Event    string    `json:"event"`
	Tick     *tick     `json:"tick,omitempty"`
	Position *position `json:"position,omitempty"`
	Summary  *summary  `json:"summary"`
}

type tick struct {
	InstrumentName string  `json:"instrumentName"`
	Bid            float64 `json:"bid"`
	Ask            float64 `json:"ask"`
}

type position struct {
	InstrumentName string  `json:"instrumentName"`
	Size           float64 `json:"size"`
}

type summary struct {
	Equity float64 `json:"equity"`
}

type connection struct {
	Conn      *websocket.Conn
	Context   context.Context
	MessageCh chan<- *message
}

var loggingLevel = zap.LevelFlag("level", zapcore.InfoLevel, "log level (debug, info, etc.)")

const btcIndexTicker = "deribit_price_index.btc_usd"

func buildLogger() *zap.SugaredLogger {
	var cfg zap.Config
	if os.Getenv("ENV") == "production" {
		cfg = zap.NewProductionConfig()
	} else {
		cfg = zap.NewDevelopmentConfig()
	}
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
		DebugMode:     false,
	}
	client := deribit.New(cfg)

	privateClient := deribit.New(&deribit.Configuration{
		Addr:          deribit.RealBaseURL,
		AutoReconnect: true,
		DebugMode:     true,
	})
	if err := privateClient.Auth(c.DeribitAPIKey, c.DeribitSecretKey); err != nil {
		logger.Fatal(err)
	}

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

	messages := make(chan *message)
	for _, ticker := range tickers {
		client.On(ticker, func(e *models.TickerNotification) {
			logger.Debugf("%s\t%.2f\t%.2f", e.InstrumentName, e.BestAskPrice, e.BestBidPrice)
			messages <- &message{
				Event: "tick",
				Tick: &tick{
					InstrumentName: e.InstrumentName,
					Ask:            e.BestAskPrice,
					Bid:            e.BestBidPrice,
				},
			}
		})

		client.On(btcIndexTicker, func(e *models.DeribitPriceIndexNotification) {
			logger.Debugf("BTC: %.2f", e.Price)
			messages <- &message{
				Event: "tick",
				Tick: &tick{
					InstrumentName: "BTC",
					Ask:            e.Price,
					Bid:            e.Price,
				},
			}
		})

		privateClient.On("user.portfolio.btc", func(e *models.PortfolioNotification) {
			messages <- &message{
				Event: "summary",
				Summary: &summary{
					Equity: e.Equity,
				},
			}
		})
	}
	tickers = append(tickers, btcIndexTicker)
	privateClient.Subscribe([]string{"user.portfolio.btc"})
	client.Subscribe(tickers)

	connections := sync.Map{}
	go func() {
		for t := range messages {
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
				default:
					logger.Warnf("dropping message for %v due to buffer size", c.Conn.RemoteAddr())
				}
				return true
			})
		}
	}()

	positions, err := client.GetPositions(&models.GetPositionsParams{
		Currency: "BTC",
		Kind:     "future",
	})
	if err != nil {
		logger.Error(err)
	}
	for _, position := range positions {
		logger.Infof("%s %s %.0f", position.Direction, position.InstrumentName, position.Size)
	}

	accountSummary, err := client.GetAccountSummary(&models.GetAccountSummaryParams{
		Currency: "BTC",
	})
	if err != nil {
		logger.Error(err)
	} else {
		logger.Infof("Balance (BTC): %f", accountSummary.Balance)
	}

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
		receiverCh := make(chan *message, 1000)
		connections.Store(conn, &connection{
			Conn:      conn,
			Context:   ctx,
			MessageCh: receiverCh,
		})
		// Send all current positions first.
		for _, pos := range positions {
			if err := conn.WriteJSON(message{
				Event: "position",
				Position: &position{
					InstrumentName: pos.InstrumentName,
					Size:           pos.Size,
				},
			}); err != nil {
				logger.Warnf("failed to write message to subscriber: %v", err)
				// Should close the websocket and stop any more writes to the channel.
				logger.Debugf("cancelling subscription for %v", conn.RemoteAddr)
				cancel()
				return
			}
		}
		// Send current balance too.
		if err := conn.WriteJSON(message{
			Event: "balance",
			Position: &position{
				InstrumentName: "BTC",
				Size:           accountSummary.Balance,
			},
		}); err != nil {
			logger.Warnf("failed to write message to subscriber: %v", err)
		}
		if err := conn.WriteJSON(message{
			Event: "summary",
			Summary: &summary{
				Equity: accountSummary.Equity,
			},
		}); err != nil {
			logger.Warnf("failed to write message to subscriber: %v", err)
		}
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

	http.HandleFunc("/status", func(w http.ResponseWriter, r *http.Request) {
		var m runtime.MemStats
		runtime.ReadMemStats(&m)
		fmt.Fprintf(w, "Allocated: %d", m.Alloc/1024/1024)
	})

	logger.Info("Listening...")
	if err := http.ListenAndServe(":12345", nil); err != nil {
		logger.Error(err)
	}
}
