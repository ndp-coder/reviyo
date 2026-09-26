import { Link, useLocation } from 'react-router-dom';
import { getPageMeta } from '@/config/seo';

/**
 * The visible breadcrumb trail for the current page. It reads the same trail
 * as the page's BreadcrumbList structured data (config/seo.ts), so what people
 * see and what search engines read can never disagree. Renders nothing on
 * pages without a trail.
 */
export function Breadcrumbs({ className = '' }: { className?: string }) {
  const { pathname } = useLocation();
  const trail = getPageMeta(pathname).trail;
  if (!trail) return null;

  const crumbs = [{ name: 'Home', path: '/' }, ...trail];
  return (
    <nav aria-label="Breadcrumb" className={`text-sm text-gray-600 ${className}`}>
      <ol className="flex flex-wrap items-center gap-1.5">
        {crumbs.map((crumb, index) => {
          const current = index === crumbs.length - 1;
          return (
            <li key={crumb.path} className="flex items-center gap-1.5">
              {index > 0 && <span aria-hidden="true">/</span>}
              {current ? (
                <span aria-current="page" className="text-gray-900">
                  {crumb.name}
                </span>
              ) : (
                <Link to={crumb.path} className="inline-block py-1.5 hover:text-gray-900 hover:underline">
                  {crumb.name}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
