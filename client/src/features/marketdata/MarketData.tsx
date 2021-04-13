import { useAppSelector } from "../../app/hooks";
import { RootState } from "../../app/store";
import { Tick } from "./marketdataSlice";

export const selectTicks = (state: RootState) => state.marketdata.ticks;


interface TickerProps {
    tick: Tick;
}

const Ticker: React.FC<TickerProps> = ({tick}) => {
    return (
        <div>
            <div>{tick.instrumentName}</div>
            <div>{`$${tick.bid.toFixed(2)}`}</div>
            <div>{`$${tick.ask.toFixed(2)}`}</div>
        </div>
    )
}

export const MarketData: React.FC = () => {
    const ticks = Object.values(useAppSelector(selectTicks));

    return (
        <div>
            {ticks.map(t => <Ticker tick={t} key={t.instrumentName}></Ticker>)}
        </div>
    );
};