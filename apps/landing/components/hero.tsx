import Link from 'next/link';
import { Wrap } from './section';
import { DownloadButton } from './download-button';
import { HeroBackdrop } from './hero-backdrop';

/**
 * Headline, the two actions, and nothing else. The hero paints its own
 * background so the site-wide thread field does not show through here — the
 * rays are the only atmosphere on this screen.
 */
export function Hero() {
  return (
    <div className="relative isolate bg-paper py-24 md:py-36">
      <HeroBackdrop />

      <Wrap className="text-center">
        <p className="label">AI interview copilot · Windows</p>

        <h1 className="mx-auto mt-7 max-w-[15ch] text-mega">
          Answers, while they are still asking.
        </h1>

        <div className="mt-11 flex flex-wrap items-center justify-center gap-4">
          <DownloadButton />
          <Link href="/pricing" className="btn btn-secondary">
            See pricing
          </Link>
        </div>

        <p className="mt-7 font-mono text-xs text-muted">
          Free for 30 minutes. No card. Windows 10 and later.
        </p>
      </Wrap>
    </div>
  );
}
