import { useEffect, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { BrandLogo } from '@/components/BrandLogo';
import { TOOL_PATH } from '@/config/seo';
import { useAuth } from '@/lib/auth-context';

export interface MarketingLink {
  label: string;
  /** In-app route, e.g. "/pricing". */
  to?: string;
  /** Same-page anchor, e.g. "#faq". */
  href?: string;
}

const DEFAULT_MARKETING_LINKS: MarketingLink[] = [
  { to: '/for', label: 'Industries' },
  { to: TOOL_PATH, label: 'Free review link tool' },
  { to: '/pricing', label: 'Pricing' },
];

const desktopLink = 'text-[15px] text-ink/80 hover:text-ink';
const mobileLink = 'block rounded-md px-3 py-3 text-base font-medium text-ink hover:bg-paper';

/**
 * Top navigation for public pages. On phones the links move into a menu
 * behind a button, so Sign in, Pricing, and the rest stay reachable.
 */
export function MarketingHeader({ links = DEFAULT_MARKETING_LINKS }: { links?: MarketingLink[] }) {
  const [open, setOpen] = useState(false);
  // Signed-in owners get a way back to their dashboard instead of sign-up
  // prompts. Until auth has loaded this renders the signed-out header, which is
  // also what the prerendered HTML contains, so hydration matches.
  const { user, loading } = useAuth();
  const signedIn = Boolean(user) && !loading;
  const { pathname, hash } = useLocation();

  useEffect(() => {
    setOpen(false);
  }, [pathname, hash]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open]);

  const renderLink = (link: MarketingLink, className: string) =>
    link.href ? (
      <a key={link.label} href={link.href} className={className} onClick={() => setOpen(false)}>
        {link.label}
      </a>
    ) : (
      <NavLink
        key={link.label}
        to={link.to ?? '/'}
        className={({ isActive }) => `${className} ${isActive ? 'font-semibold text-ink' : ''}`}
      >
        {link.label}
      </NavLink>
    );

  return (
    <header className="sticky top-0 z-50 border-b border-line bg-paper">
      <nav aria-label="Main" className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <Link to="/" aria-label="Reviyo home" className="inline-flex">
          <BrandLogo className="h-10 w-auto sm:h-11" />
        </Link>

        <div className="hidden items-center gap-6 md:flex">
          {links.map((link) => renderLink(link, desktopLink))}
          {signedIn ? (
            <Link
              to="/dashboard"
              className="inline-flex min-h-10 items-center rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700"
            >
              Go to dashboard
            </Link>
          ) : (
            <>
              <Link to="/login" className="text-[15px] font-medium text-ink/80 hover:text-ink">
                Sign in
              </Link>
              <Link
                to="/signup"
                className="inline-flex min-h-10 items-center rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700"
              >
                Start free trial
              </Link>
            </>
          )}
        </div>

        <div className="flex items-center gap-1 md:hidden">
          <Link
            to={signedIn ? '/dashboard' : '/signup'}
            className="inline-flex min-h-10 items-center whitespace-nowrap rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700"
          >
            {signedIn ? 'Dashboard' : 'Start free trial'}
          </Link>
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            aria-expanded={open}
            aria-controls="marketing-menu"
            aria-label={open ? 'Close menu' : 'Open menu'}
            className="flex h-11 w-11 items-center justify-center rounded-md text-ink hover:bg-white"
          >
            {open ? <X className="h-5 w-5" aria-hidden="true" /> : <Menu className="h-5 w-5" aria-hidden="true" />}
          </button>
        </div>
      </nav>

      {open && (
        <div id="marketing-menu" className="border-t border-line bg-white px-4 pb-4 pt-2 md:hidden">
          <ul className="space-y-0.5">
            {links.map((link) => (
              <li key={link.label}>{renderLink(link, mobileLink)}</li>
            ))}
            {!signedIn && (
              <li>
                <Link to="/login" className={mobileLink}>
                  Sign in
                </Link>
              </li>
            )}
          </ul>
        </div>
      )}
    </header>
  );
}
