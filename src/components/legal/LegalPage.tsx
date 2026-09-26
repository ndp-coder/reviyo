import { type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { legal } from '@/config/legal';
import { BrandLogo } from '@/components/BrandLogo';
import { SiteFooter } from '@/components/SiteFooter';
import { SkipLink } from '@/components/SkipLink';

interface LegalPageProps {
  title: string;
  summary: string;
  children: ReactNode;
}

/** Shared shell for every policy page: landmarks, heading order, and chrome. */
// The page <title> and meta tags come from config/seo.ts via <RouteMeta />.
export function LegalPage({ title, summary, children }: LegalPageProps) {
  return (
    <div className="min-h-screen bg-white flex flex-col">
      <SkipLink />
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between gap-4">
          <Link to="/" aria-label="Reviyo home" className="inline-flex rounded-lg">
            <BrandLogo className="h-11 w-auto" />
          </Link>
          <Link
            to="/contact"
            className="inline-flex min-h-10 items-center text-sm font-medium text-blue-700 underline underline-offset-2 hover:text-blue-800"
          >
            Contact us
          </Link>
        </div>
      </header>

      <main id="main-content" tabIndex={-1} className="flex-1 px-6 py-12">
        <article className="max-w-3xl mx-auto">
          <h1 className="text-3xl font-bold text-gray-900">{title}</h1>
          <p className="mt-3 text-base text-gray-700">{summary}</p>
          <p className="mt-4 text-sm text-gray-600">
            Last updated: {new Date(legal.policyLastUpdated).toLocaleDateString('en-IN', {
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}
            {' · '}Version {legal.consentVersion}
          </p>
          <div className="mt-10 space-y-10">{children}</div>
        </article>
      </main>

      <SiteFooter />
    </div>
  );
}

/** A numbered top-level clause. */
export function Clause({ id, heading, children }: { id: string; heading: string; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-heading`} className="scroll-mt-24">
      <h2 id={`${id}-heading`} className="text-xl font-bold text-gray-900">
        {heading}
      </h2>
      <div className="mt-3 space-y-3 text-sm leading-relaxed text-gray-700">{children}</div>
    </section>
  );
}

/** A sub-heading inside a clause. */
export function SubHeading({ children }: { children: ReactNode }) {
  return <h3 className="text-base font-semibold text-gray-900 pt-2">{children}</h3>;
}

/** Bulleted list with adequate contrast and spacing. */
export function List({ items }: { items: ReactNode[] }) {
  return (
    <ul className="list-disc space-y-2 pl-5">
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ul>
  );
}

/** A definition-style table for data-processing disclosures. */
export function DataTable({
  caption,
  columns,
  rows,
}: {
  caption: string;
  columns: string[];
  rows: ReactNode[][];
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200">
      <table className="w-full text-left text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            {columns.map((column) => (
              <th key={column} scope="col" className="px-4 py-3 font-semibold text-gray-900">
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 align-top">
          {rows.map((row, i) => (
            <tr key={i}>
              {row.map((cell, j) => (
                <td key={j} className="px-4 py-3 text-gray-700">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
