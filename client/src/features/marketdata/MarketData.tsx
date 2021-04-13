import React from "react";
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
            <div>{tick.instrumentName}</div>
            <div className="text-danger">{`$${tick.ask.toFixed(2)}`}</div>
            <div className="text-success">{`$${tick.bid.toFixed(2)}`}</div>
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
                <span className={`${position.size >= 0 ? 'text-success' : 'text-danger'}`}>{position.size}</span>
                &nbsp;
                <span>{position.instrumentName}</span>
            </div>
            <div>{getValue()}</div>
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

    return (
        <Container>
            <Row>
                <Col>
                    <h2>Market</h2>
                    {sortedTicks.map(t => <Ticker tick={t} key={t.instrumentName}></Ticker>)}
                </Col>
                <Col>
                    <h2>Positions</h2>
                    {positions.map(p => <Position position={p} tick={ticks[p.instrumentName]} key={p.instrumentName}></Position>)}
                </Col>
            </Row>
        </Container>
    );
};