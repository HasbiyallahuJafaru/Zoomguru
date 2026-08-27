import Link from 'next/link';
import { FEATURES } from '@/lib/site';

// Must match the keyframe shift in globals.css (-100% / COPIES).
const COPIES = 6;

/**
 * A thin strip of capability names running under the hero — a table of contents
 * for the section below it, not a feature list in its own right. The names are
 * rendered twice so the track loops without a seam; the second pass is hidden
 * from screen readers and skipped by tab so nothing is announced twice.
 */
export function FeatureMarquee() {
  return (
    <div className="marquee border-y border-rule/50 py-3.5">
      <div className="marquee-track">
        {/* Six copies: the loop shifts by exactly one, and the remaining five
            always cover the viewport. See the note in globals.css. */}
        {Array.from({ length: COPIES }, (_, i) => (
          <Row key={i} duplicate={i > 0} />
        ))}
      </div>
    </div>
  );
}

function Row({ duplicate = false }: { duplicate?: boolean }) {
  return (
    <ul className="flex shrink-0 items-center" aria-hidden={duplicate || undefined}>
      {FEATURES.map((feature) => (
        <li key={feature.slug} className="flex items-center">
          <Link
            href={`/features/${feature.slug}`}
            tabIndex={duplicate ? -1 : undefined}
            className="whitespace-nowrap px-6 font-mono text-[0.6875rem] uppercase tracking-[0.16em] text-muted transition-colors hover:text-overlay md:px-8"
          >
            {feature.name}
          </Link>
          <span aria-hidden="true" className="h-1 w-1 rounded-full bg-overlay/30" />
        </li>
      ))}
    </ul>
  );
}
