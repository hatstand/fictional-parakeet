import { createSlice, PayloadAction } from "@reduxjs/toolkit";

interface MarketDataState {
    ticks: {
        [key: string]: Tick;
    };
    positions: {
        [key: string]: Position;
    };
    balance: Position | null;
    equity: number | null;
}

export interface Tick {
    instrumentName: string;
    bid: number;
    ask: number;
}

export interface Position {
    instrumentName: string;
    size: number;
}

export interface Summary {
    equity: number;
}

const initialState: MarketDataState = {
    ticks: {},
    positions: {},
    balance: null,
    equity: null,
}

export const marketdataSlice = createSlice({
    name: 'marketdata',
    initialState: initialState,
    reducers: {
        tick: (state, action: PayloadAction<Tick>) => {
            state.ticks[action.payload.instrumentName] = action.payload;
        },
        position: (state, action: PayloadAction<Position>) => {
            state.positions[action.payload.instrumentName] = action.payload;
        },
        balance: (state, action: PayloadAction<Position>) => {
            state.balance = action.payload;
        },
        summary: (state, action: PayloadAction<Summary>) => {
            state.equity = action.payload.equity;
        },
    },
});

export const { balance, position, summary, tick } = marketdataSlice.actions;

export default marketdataSlice.reducer;