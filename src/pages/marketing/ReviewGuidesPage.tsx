import { Link, useParams } from 'react-router-dom';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { MarketingHeader } from '@/components/MarketingHeader';
import { SiteFooter } from '@/components/SiteFooter';
import { SkipLink } from '@/components/SkipLink';
import { buttonClasses } from '@/components/ui/button-styles';
import { NotFoundPage } from '@/pages/NotFoundPage';
import { GUIDE_PATH, GUIDE_PUBLISHED, getReviewGuide, googleReviewSources, reviewGuides } from '@/config/review-guides';
import { TOOL_PATH } from '@/config/seo';

export function ReviewGuidesPage() {
  return <div className="min-h-screen bg-white"><SkipLink /><MarketingHeader /><main id="main-content" tabIndex={-1} className="mx-auto max-w-6xl px-5 py-10 sm:px-6 lg:py-14">
    <Breadcrumbs />
    <div className="my-10 max-w-3xl"><h1 className="text-4xl font-semibold leading-tight text-brand-900 sm:text-5xl">Practical guides to Google reviews</h1><p className="mt-6 text-lg leading-relaxed text-gray-700">Choose a review tool, set up a QR code, and help customers share their real experience. Written by Reviyo for small business owners.</p></div>
    <ul className="grid gap-x-12 sm:grid-cols-2">{reviewGuides.map(guide => <li key={guide.slug} className="border-t border-gray-200 py-7"><h2 className="text-xl font-semibold text-brand-900"><Link to={`${GUIDE_PATH}/${guide.slug}`} className="hover:underline underline-offset-4">{guide.title}</Link></h2><p className="mt-3 text-sm leading-relaxed text-gray-700">{guide.description}</p><Link to={`${GUIDE_PATH}/${guide.slug}`} className="mt-4 inline-block py-2 text-sm font-semibold text-accent-700 underline underline-offset-4">Read the guide</Link></li>)}</ul>
    <div className="mt-10 border-t border-gray-200 pt-8"><Link to={TOOL_PATH} className={buttonClasses({variant:'outline',size:'lg'})}>Create a free review link</Link></div>
  </main><SiteFooter /></div>;
}

export function ReviewGuidePage() {
  const { slug } = useParams<{ slug: string }>();
  const guide = getReviewGuide(slug);
  if (!guide) return <NotFoundPage />;
  const related = reviewGuides.filter(item => guide.related.includes(item.slug));
  return <div className="min-h-screen bg-white"><SkipLink /><MarketingHeader /><main id="main-content" tabIndex={-1}>
    <div className="mx-auto max-w-6xl px-5 pt-8 sm:px-6"><Breadcrumbs /></div>
    <article className="mx-auto max-w-3xl px-5 pb-16 pt-10 sm:px-6">
      <p className="text-sm text-gray-600">Published by Reviyo · <time dateTime={GUIDE_PUBLISHED}>1 October 2026</time></p>
      <h1 className="mt-4 text-3xl font-semibold leading-tight text-brand-900 sm:text-5xl">{guide.title}</h1>
      <p className="mt-7 border-l-2 border-accent-700 pl-5 text-lg leading-relaxed text-gray-800">{guide.answer}</p>
      <nav aria-label="In this guide" className="my-10 border-y border-gray-200 py-5"><p className="font-semibold text-brand-900">In this guide</p><ul className="mt-3 space-y-2">{guide.sections.map((section,index) => <li key={section.title}><a href={`#section-${index+1}`} className="inline-block py-1 text-sm text-accent-700 underline underline-offset-4">{section.title}</a></li>)}</ul></nav>
      {guide.comparison && <section className="mb-10"><h2 className="text-2xl font-semibold text-brand-900">{guide.comparison.heading}</h2><div className="mt-5 overflow-x-auto"><table className="w-full text-left text-sm"><caption className="sr-only">Review tool options and their limitations</caption><thead><tr className="border-b border-gray-300"><th scope="col" className="p-3">Option</th><th scope="col" className="p-3">Useful for</th><th scope="col" className="p-3">Limitations</th></tr></thead><tbody>{guide.comparison.rows.map(row=><tr key={row.option} className="border-b border-gray-200 align-top"><th scope="row" className="p-3 font-medium">{row.option}</th><td className="p-3 leading-relaxed">{row.use}</td><td className="p-3 leading-relaxed">{row.limitation}</td></tr>)}</tbody></table></div></section>}
      {guide.sections.map((section,index) => <section key={section.title} id={`section-${index+1}`} className="mb-10 scroll-mt-24"><h2 className="text-2xl font-semibold leading-snug text-brand-900">{section.title}</h2>{section.paragraphs.map(paragraph=><p key={paragraph} className="mt-4 leading-[1.85] text-gray-700">{paragraph}</p>)}{section.checklist && <ol className="mt-5 list-decimal space-y-3 pl-6 text-gray-700">{section.checklist.map(item=><li key={item} className="pl-1 leading-relaxed">{item}</li>)}</ol>}</section>)}
      <section className="border-t border-gray-200 pt-8"><h2 className="text-2xl font-semibold text-brand-900">Common questions</h2>{guide.faqs.map(item=><div key={item.q} className="mt-6"><h3 className="font-semibold text-brand-900">{item.q}</h3><p className="mt-2 leading-relaxed text-gray-700">{item.a}</p></div>)}</section>
      <section className="mt-10 border-t border-gray-200 pt-8"><h2 className="text-xl font-semibold text-brand-900">Sources and product details</h2><p className="mt-3 text-sm leading-relaxed text-gray-700">Google controls its review policies and moderation. Product descriptions here refer to Reviyo’s current advertised features; this is not an independent vendor ranking.</p><ul className="mt-4 space-y-2 text-sm">{googleReviewSources.map(source=><li key={source.url}><a href={source.url} className="inline-block py-1 text-accent-700 underline underline-offset-4">{source.title}</a></li>)}<li><Link to="/pricing" className="inline-block py-1 text-accent-700 underline underline-offset-4">Reviyo pricing and plan scope</Link></li><li><Link to="/refunds" className="inline-block py-1 text-accent-700 underline underline-offset-4">Trial, AutoPay, and refund terms</Link></li></ul></section>
      <aside className="mt-10 border-t border-gray-200 pt-8" aria-label="Related guides"><h2 className="text-xl font-semibold text-brand-900">Keep reading</h2><ul className="mt-4 space-y-3">{related.map(item=><li key={item.slug}><Link to={`${GUIDE_PATH}/${item.slug}`} className="text-accent-700 underline underline-offset-4">{item.title}</Link></li>)}</ul><div className="mt-6 flex flex-wrap gap-4"><Link to={TOOL_PATH} className={buttonClasses({variant:'outline'})}>Create a free review link</Link><Link to="/for" className={buttonClasses({variant:'ghost'})}>Find your industry</Link></div></aside>
    </article>
  </main><SiteFooter /></div>;
}
