import { createSlice, PayloadAction } from "@reduxjs/toolkit";

interface MarketDataState {
    ticks: {
        [key: string]: Tick;
    }
}

export interface Tick {
    instrumentName: string;
    bid: number;
    ask: number;
}

const initialState: MarketDataState = {
    ticks: {},
}

export const marketdataSlice = createSlice({
    name: 'marketdata',
    initialState: initialState,
    reducers: {
        tick: (state, action: PayloadAction<Tick>) => {
            state.ticks[action.payload.instrumentName] = action.payload;
        },
    },
});

export const { tick } = marketdataSlice.actions;

export default marketdataSlice.reducer;