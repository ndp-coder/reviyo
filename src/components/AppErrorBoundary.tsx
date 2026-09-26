import { Component, type ErrorInfo, type ReactNode } from 'react';
import { BrandLogo } from '@/components/BrandLogo';
import { legal } from '@/config/legal';

interface AppErrorBoundaryProps {
  children: ReactNode;
}

interface AppErrorBoundaryState {
  hasError: boolean;
}

export class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): AppErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Keep a local diagnostic until a production error-reporting provider is configured.
    console.error('Unhandled Reviyo application error', error, info);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <main className="min-h-screen bg-slate-50 px-6 py-16">
        <div
          role="alert"
          className="mx-auto flex max-w-lg flex-col items-center rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm"
        >
          <a href="/" aria-label="Reviyo home">
            <BrandLogo className="h-12 w-auto" />
          </a>
          <h1 className="mt-8 text-2xl font-bold text-slate-900">Something went wrong</h1>
          <p className="mt-3 text-sm leading-6 text-slate-700">
            We could not load this page. Reload and try again. If the problem continues, contact support.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="rounded-lg bg-brand-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
            >
              Reload page
            </button>
            <a
              href={`mailto:${legal.supportEmail}`}
              className="rounded-lg border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
            >
              Contact support
            </a>
          </div>
        </div>
      </main>
    );
  }
}
