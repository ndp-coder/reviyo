import { StrictMode } from 'react';
import { createRoot, hydrateRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.tsx';
import { AuthProvider } from '@/lib/auth-context';
import { AppErrorBoundary } from '@/components/AppErrorBoundary';
import './index.css';

const root = document.getElementById('root')!;

const app = (
  <StrictMode>
    <AppErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <App />
        </AuthProvider>
      </BrowserRouter>
    </AppErrorBoundary>
  </StrictMode>
);

// Public pages arrive prerendered (scripts/prerender.mjs), marked with the path
// they were rendered for. Hydrate only when that matches the current URL; if a
// host served the HTML for a different path, render from scratch instead.
const normalise = (path: string) => (path !== '/' ? path.replace(/\/+$/, '') : '/');
const prerenderedFor = root.dataset.prerenderedPath;

if (prerenderedFor && normalise(prerenderedFor) === normalise(window.location.pathname)) {
  hydrateRoot(root, app);
} else {
  root.innerHTML = '';
  createRoot(root).render(app);
}
