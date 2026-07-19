import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import LineRequest from './LineRequest.jsx';

const RootApp = window.location.pathname.replace(/\/+$/, '') === '/line-request'
  ? LineRequest
  : App;

createRoot(document.getElementById('root')).render(<RootApp />);
