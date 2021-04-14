import React, { useEffect } from "react";
import { Container, Row, Col } from "react-bootstrap";
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
            <h6>{tick.instrumentName}</h6>
            <div className="text-danger">{`$${tick.ask.toFixed(2)}`}</div>
            <div className="text-success">{`$${tick.bid.toFixed(2)}`}</div>
        </div>
    )
}

interface PositionProps {
    position: IPosition;
    tick: Tick | null; // Matching tick for the position instrument.
    indexTick: Tick | null; // Current index price.
}

const valuePositionBTC = (position: IPosition, tick: Tick | null): number | null => {
    if (!tick) return null;

    return position.size >= 0 ? position.size / tick.bid : -position.size / tick.ask;
};

const valuePositionUSD = (position: IPosition, tick: Tick | null, indexTick: Tick | null): number | null => {
    if (!indexTick) return null;
    const positionBTC = valuePositionBTC(position, tick);

    return positionBTC !== null ? positionBTC * indexTick.ask : null;
};

const formatUSD = (v?: number): string => v ? `$${v.toFixed(2)}` : '';
const formatBTC = (v?: number): string => v ? `₿${v.toFixed(6)}`: '';

const Position: React.FC<PositionProps> = ({position, tick, indexTick}) => {
    const valueBTC = valuePositionBTC(position, tick);
    const valueUSD = valuePositionUSD(position, tick, indexTick);

    return (
        <div>
            <div>
                <span className={`${position.size >= 0 ? 'text-success' : 'text-danger'}`}>{position.size}</span>
                &nbsp;
                <span>{position.instrumentName}</span>
            </div>
            <div>{valueBTC ? formatBTC(valueBTC) : ''}</div>
            <div>{valueUSD ? formatUSD(valueUSD): ''}</div>
        </div>
    )
};

const orderedMonths = [
    'JAN',
    'FEB',
    'MAR',
    'APR',
    'MAY',
    'JUN',
    'JUL',
    'SEP',
    'OCT',
    'NOV',
    'DEC',
];

function notNull<T>(value: T | null): value is T {
    return value !== null;
}

export const MarketData: React.FC = () => {
    const ticks = useAppSelector(selectTicks);
    const positions = Object.values(useAppSelector(selectPositions));

    const re = /BTC-(\d{1,2})([A-Z]{3})(\d{2})/;

    const sortedTicks = Object.values(ticks).sort((a, b): number => {
        const aMatch = a.instrumentName.match(re);
        const bMatch = b.instrumentName.match(re);
        if (aMatch === bMatch) {
            return 0;
        }
        if (aMatch === null) {
            return -1;
        }
        if (bMatch === null) {
            return 1;
        }
        const [_a, aDay, aMonth, aYear] = aMatch;
        const [_b, bDay, bMonth, bYear] = bMatch;
        if (aYear !== bYear) {
            return aYear.localeCompare(bYear);
        }
        if (aMonth !== bMonth) {
            return orderedMonths.indexOf(aMonth) - orderedMonths.indexOf(bMonth);
        }
        if (aDay !== bDay) {
            return parseInt(aDay) - parseInt(bDay);
        }
        return 0;
    });

    const indexTick = ticks['BTC'];

    const bookValue = positions.map(p => valuePositionUSD(p, ticks[p.instrumentName], indexTick))
        .filter(notNull)
        .reduce((prev, curr) => prev + curr, 0);

    useEffect(() => {
        document.title = formatUSD(bookValue);
    }, [bookValue]);

    return (
        <Container>
            <Row>
                <Col>
                    <h2>Market</h2>
                    {sortedTicks.map(t => <Ticker tick={t} key={t.instrumentName}></Ticker>)}
                </Col>
                <Col>
                    <h2>Positions ({formatUSD(bookValue)})</h2>
                    {positions.map(p => <Position position={p} tick={ticks[p.instrumentName]} indexTick={indexTick} key={p.instrumentName}></Position>)}
                </Col>
            </Row>
        </Container>
    );
};