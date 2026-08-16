import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// The shared skin, then Seep's overrides on top. Order matters: both set the
// same custom properties, and the later stylesheet wins.
import '@laurelwood/card-class/styles.css';
import './styles/seep.css';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
