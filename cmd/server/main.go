package main

import (
	"fmt"
	"log"

	"github.com/frankrap/deribit-api"
	"github.com/frankrap/deribit-api/models"
	"github.com/kelseyhightower/envconfig"
)

type config struct {
	DeribitAPIKey    string `envconfig:"DERIBIT_API_KEY" required:"true"`
	DeribitSecretKey string `envconfig:"DERIBIT_SECRET_KEY" required:"true"`
}

func main() {
	var c config
	if err := envconfig.Process("server", &c); err != nil {
		log.Fatal(err)
	}

	cfg := &deribit.Configuration{
		Addr:          deribit.RealBaseURL,
		ApiKey:        c.DeribitAPIKey,
		SecretKey:     c.DeribitSecretKey,
		AutoReconnect: true,
		DebugMode:     true,
	}
	client := deribit.New(cfg)

	client.GetTime()
	client.Test()

	instruments, err := client.GetInstruments(&models.GetInstrumentsParams{
		Currency: "BTC",
		Kind:     "future",
		Expired:  false,
	})
	if err != nil {
		log.Fatal(err)
	}
	tickers := []string{}
	for _, instrument := range instruments {
		log.Println(instrument.InstrumentName)
		tickers = append(tickers, fmt.Sprintf("ticker.%s.raw", instrument.InstrumentName))
	}

	for _, ticker := range tickers {
		client.On(ticker, func(e *models.TickerNotification) {
			log.Println(e)
		})
	}
	client.Subscribe(tickers)

	forever := make(chan bool)
	<-forever
}
