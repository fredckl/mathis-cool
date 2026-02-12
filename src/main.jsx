import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';

import App from './App.jsx';
import { AppProvider } from './state/AppContext.jsx';
import './styles.css';

const rootElement = document.getElementById('app');

if (!rootElement) {
  throw new Error('Missing #app root element');
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <AppProvider>
      <BrowserRouter
        future={{
          v7_startTransition: true,
          v7_relativeSplatPath: true
        }}
      >
        <App />
      </BrowserRouter>
    </AppProvider>
  </React.StrictMode>
);
