import { configureStore, ThunkAction, Action } from '@reduxjs/toolkit';
import marketdataReducer from '../features/marketdata/marketdataSlice';

export const store = configureStore({
  reducer: {
    marketdata: marketdataReducer,
  },
});

export type AppDispatch = typeof store.dispatch;
export type RootState = ReturnType<typeof store.getState>;
export type AppThunk<ReturnType = void> = ThunkAction<
  ReturnType,
  RootState,
  unknown,
  Action<string>
>;
