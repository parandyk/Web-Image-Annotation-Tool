import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/app.css';

// App entrypoint: mount React tree into the Vite root container.
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
