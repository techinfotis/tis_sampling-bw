import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { initAutoSync } from './lib/sync';

// Tunggu DOM siap baru init sync
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Init auto sync setelah render
initAutoSync();
