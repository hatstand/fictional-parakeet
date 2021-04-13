import React from 'react';
import ReactDOM from 'react-dom';
import './index.css';
import App from './App';
import { store } from './app/store';
import { Provider } from 'react-redux';
import * as serviceWorker from './serviceWorker';
import { tick } from './features/marketdata/marketdataSlice';

ReactDOM.render(
  <React.StrictMode>
    <Provider store={store}>
      <App />
    </Provider>
  </React.StrictMode>,
  document.getElementById('root')
);

// If you want your app to work offline and load faster, you can change
// unregister() to register() below. Note this comes with some pitfalls.
// Learn more about service workers: https://bit.ly/CRA-PWA
serviceWorker.unregister();

const socket = new WebSocket('ws://localhost:12345/subscribe');
socket.addEventListener('open', (ev) => {
  console.log('Connection opened: ', ev);
});
socket.addEventListener('message', (ev) => {
  console.debug(ev.data);
  store.dispatch(tick(JSON.parse(ev.data)));
});
socket.addEventListener('error', ev => {
  console.log('websocket error: ', ev);
});
