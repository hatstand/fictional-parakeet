import { useAppSelector } from "../../app/hooks";
import { RootState } from "../../app/store";
import { Position as IPosition, Tick } from "./marketdataSlice";

const selectTicks = (state: RootState) => state.marketdata.ticks;
const selectPositions = (state: RootState) => state.marketdata.positions;


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

interface PositionProps {
    position: IPosition;
    tick?: Tick; // Matching tick for the position instrument.
}

const Position: React.FC<PositionProps> = ({position, tick}) => {

    const getValue = (): string | undefined => {
        if (!tick) return undefined;
        const value = position.size >= 0 ? position.size / tick.bid : -position.size / tick.ask;
        return `₿${value.toFixed(6)}`;
    };

    return (
        <div>
            <div>
                <span>{position.size}</span>
                &nbsp;
                <span>{position.instrumentName}</span>
            </div>
            <div>{getValue()}</div>
        </div>
    )
};

export const MarketData: React.FC = () => {
    const ticks = useAppSelector(selectTicks);
    const positions = Object.values(useAppSelector(selectPositions));

    return (
        <div>
            <div>
                <h2>Market</h2>
                {Object.values(ticks).map(t => <Ticker tick={t} key={t.instrumentName}></Ticker>)}
            </div>
            <div>
                <h2>Positions</h2>
                {positions.map(p => <Position position={p} tick={ticks[p.instrumentName]} key={p.instrumentName}></Position>)}
            </div>
        </div>
    );
};