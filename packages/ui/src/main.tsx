import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import { App } from './app/App.js';
import './index.css';

/**
 * HashRouter (not BrowserRouter): GitHub Pages has no server-side rewrites, so
 * deep links like `/run/:id` would 404 under a real router. The hash keeps all
 * routing client-side and works under any base path, including a project site.
 */
const root = document.getElementById('root');
if (!root) throw new Error('missing #root');

createRoot(root).render(
  <StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </StrictMode>,
);
