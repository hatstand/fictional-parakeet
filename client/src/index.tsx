import React from 'react';
import ReactDOM from 'react-dom';
import './index.css';
import 'bootstrap/dist/css/bootstrap.min.css';
import App from './App';
import { store } from './app/store';
import { Provider } from 'react-redux';
import * as serviceWorker from './serviceWorker';
import { position, tick } from './features/marketdata/marketdataSlice';

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

const socket = new WebSocket(process.env.REACT_APP_SUBSCRIBE_URL!);
socket.addEventListener('open', (ev) => {
  console.log('Connection opened: ', ev);
});
socket.addEventListener('message', (ev) => {
  console.debug(ev.data);
  const m = JSON.parse(ev.data);
  switch (m.event) {
    case 'tick':
      store.dispatch(tick(m.tick));
      break;
    case 'position':
      store.dispatch(position(m.position));
      break;
    default:
      console.warn('Unhandled message type:', m.event);
      break;
  }
});
socket.addEventListener('error', ev => {
  console.log('websocket error: ', ev);
});
