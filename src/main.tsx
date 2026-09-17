import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import './index.css';

import { registerSW } from 'virtual:pwa-register';

// Register service worker with auto-reload when updated
registerSW({ immediate: true });

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
