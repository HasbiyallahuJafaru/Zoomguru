import type { FaqSection } from '@/lib/faq';

/**
 * Native details/summary: open by keyboard, findable by in-page search, and it
 * cannot silently stop working the way the old hand-bound accordion did.
 */
export function FaqAccordion({ sections }: { sections: FaqSection[] }) {
  return (
    <div className="space-y-16">
      {sections.map((section) => (
        <section key={section.title}>
          <h2 className="label">{section.title}</h2>

          <div className="mt-6 border-t border-rule/60">
            {section.items.map((item) => (
              <details key={item.q} className="group border-b border-rule/60">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-6 py-5 marker:hidden">
                  <span className="font-display text-lg md:text-xl">{item.q}</span>
                  <span
                    aria-hidden="true"
                    className="shrink-0 font-mono text-overlay transition-transform duration-200 group-open:rotate-45"
                  >
                    +
                  </span>
                </summary>
                <div className="max-w-[62ch] space-y-4 pb-7 pr-8">
                  {item.a.map((para) => (
                    <p key={para} className="text-[0.9375rem] leading-[1.8] text-muted">
                      {para}
                    </p>
                  ))}
                </div>
              </details>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
