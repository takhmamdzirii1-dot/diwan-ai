import Link from 'next/link';
import GlobalFooter from '../GlobalFooter';
import { VantraLogo, VantraWordmark } from '../VantraLogo';
import { LEGAL_DOCUMENTS, legalContent, legalUi, type LegalDocumentId, type LegalLocale } from '../../content/legal';

export default function LegalPage({ locale, document }: { locale: LegalLocale; document: LegalDocumentId }) {
  const copy = legalContent[locale][document];
  const ui = legalUi[locale];

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[#16181A] text-white">
      <header className="border-b border-white/[0.075]">
        <div className="mx-auto flex h-16 max-w-[1200px] items-center justify-between gap-4 px-5 sm:px-8 lg:px-10">
          <Link href={`/${locale}`} dir="ltr" className="flex items-center gap-2.5 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40" aria-label={ui.back}>
            <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-white/[0.03]">
              <VantraLogo tone="dark" className="h-[22px] w-[22px]" />
            </span>
            <VantraWordmark tone="white" className="h-[13px] w-[76px]" />
          </Link>
          <nav aria-label={ui.navigation} className="flex items-center gap-1 rounded-xl border border-white/10 bg-white/[0.025] p-1">
            {(['fr', 'ar', 'en'] as const).map((nextLocale) => (
              <Link key={nextLocale} href={`/${nextLocale}/${document}`} hrefLang={nextLocale} aria-current={locale === nextLocale ? 'page' : undefined} className={`flex min-h-9 min-w-9 items-center justify-center rounded-lg px-2 text-[10.5px] font-semibold tracking-[0.08em] transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 ${locale === nextLocale ? 'bg-[#d4d4d4] text-[#171717]' : 'text-white/45 hover:bg-white/[0.06] hover:text-white'}`}>
                {nextLocale.toUpperCase()}
              </Link>
            ))}
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[880px] px-5 py-14 sm:px-8 sm:py-20 lg:px-10 lg:py-24">
        <div className="border-b border-white/[0.08] pb-10 sm:pb-12">
          <p className="text-[11px] font-mono uppercase tracking-[0.2em] text-white/45">{copy.label}</p>
          <h1 className="mt-4 max-w-3xl text-4xl font-semibold tracking-[-0.04em] text-white sm:text-5xl">{copy.title}</h1>
          <p className="mt-5 max-w-2xl text-[15px] leading-7 text-white/62 sm:text-base">{copy.description}</p>
          <p className="mt-5 text-[11px] font-mono text-white/38">{ui.updated}: {copy.updated}</p>
        </div>

        <article className="py-4 sm:py-6">
          {copy.sections.map((section) => (
            <section key={section.title} className="border-b border-white/[0.065] py-8 last:border-b-0 sm:py-10">
              <h2 className="text-xl font-semibold tracking-tight text-white sm:text-[22px]">{section.title}</h2>
              <div className="mt-4 space-y-4 text-[14px] leading-7 text-white/64 sm:text-[15px]">
                {section.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
                {section.items && (
                  <ul className="space-y-3 ps-5 marker:text-white/35">
                    {section.items.map((item) => <li key={item} className="ps-1">{item}</li>)}
                  </ul>
                )}
              </div>
            </section>
          ))}
        </article>

        <nav aria-label={ui.navigation} className="mt-6 flex flex-wrap gap-x-5 gap-y-3 border-t border-white/[0.08] pt-8">
          {LEGAL_DOCUMENTS.map((id) => (
            <Link key={id} href={`/${locale}/${id}`} aria-current={document === id ? 'page' : undefined} className={`rounded text-[13px] transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 ${document === id ? 'text-white' : 'text-white/48 hover:text-white/85'}`}>
              {legalContent[locale][id].label}
            </Link>
          ))}
        </nav>
      </main>

      <GlobalFooter />
    </div>
  );
}
