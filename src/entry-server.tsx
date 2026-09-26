// Server entry used only at build time by scripts/prerender.mjs to turn each
// public page into static HTML. It renders exactly the same tree as main.tsx,
// so the browser can hydrate the HTML without re-rendering it.
import { StrictMode } from 'react';
import { renderToString } from 'react-dom/server';
import { StaticRouter } from 'react-router-dom';
import App from './App';
import { AuthProvider } from '@/lib/auth-context';
import { AppErrorBoundary } from '@/components/AppErrorBoundary';

export { publicPages, getPageMeta, renderHeadTags, renderLlmsTxt, SITE_URL } from '@/config/seo';

export function render(url: string): string {
  return renderToString(
    <StrictMode>
      <AppErrorBoundary>
        <StaticRouter location={url}>
          <AuthProvider>
            <App />
          </AuthProvider>
        </StaticRouter>
      </AppErrorBoundary>
    </StrictMode>
  );
}
