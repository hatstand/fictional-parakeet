import { createSlice, PayloadAction } from "@reduxjs/toolkit";

interface MarketDataState {
    ticks: {
        [key: string]: Tick;
    };
    positions: {
        [key: string]: Position;
    };
    balance: Position | null;
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

const initialState: MarketDataState = {
    ticks: {},
    positions: {},
    balance: null,
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
    },
});

export const { balance, position, tick } = marketdataSlice.actions;

export default marketdataSlice.reducer;