import { type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { BrandLogo } from '@/components/BrandLogo';
import { SkipLink } from '@/components/SkipLink';

const footerLinks = [
  { to: '/terms', label: 'Terms' },
  { to: '/privacy', label: 'Privacy' },
  { to: '/refunds', label: 'Refunds' },
  { to: '/contact', label: 'Contact' },
];

export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-paper">
      <SkipLink />
      <header className="px-6 py-5">
        <Link to="/" aria-label="Reviyo home" className="inline-flex rounded-lg">
          <BrandLogo className="h-11 w-auto" />
        </Link>
      </header>
      <main id="main-content" tabIndex={-1} className="flex-1 flex items-center justify-center px-6 pb-8">
        {children}
      </main>
      {/* Policies must be reachable from the page where the account is created,
          not only from the marketing site. */}
      <footer className="px-6 pb-8">
        <nav aria-label="Legal and policies">
          <ul className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
            {footerLinks.map((link) => (
              <li key={link.to}>
                <Link
                  to={link.to}
                  className="text-xs text-gray-600 underline underline-offset-2 hover:text-gray-900"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </footer>
    </div>
  );
}
