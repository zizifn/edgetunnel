import { StrictMode } from 'react';
import * as ReactDOM from 'react-dom/client';

// import App from './app/app';
import { EdgeApp } from 'edge-ui';

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);
root.render(
  <StrictMode>
    <EdgeApp />
  </StrictMode>
);
