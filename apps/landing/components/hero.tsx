import Image from 'next/image';
import Link from 'next/link';
import { Wrap } from './section';
import { DownloadButton } from './download-button';

/**
 * Headline, the two actions, and nothing else.
 *
 * This is the one screen that runs light-on-dark: the painting behind it is
 * busy and mid-tone, so ink type cannot sit on it without washing the image
 * out to make room. The tint is dark rather than white for the same reason —
 * it holds the picture's colour instead of fading it.
 *
 * It sits in a framed card inset by an equal gutter on all four sides.
 */
export function Hero() {
  return (
    // -mt-20 cancels the fixed-nav offset <main> adds, so the frame's top gutter
    // matches its sides; the translucent nav floats over the frame's top edge.
    <div className="-mt-20 p-4 md:p-6">
      <div className="relative isolate overflow-hidden rounded-card bg-ink py-24 shadow-[0_18px_50px_-32px_rgba(14,14,12,0.4)] md:py-36">
        <Image
          src="/hero-bg.jpg"
          alt=""
          aria-hidden="true"
          fill
          priority
          quality={55}
          sizes="100vw"
          className="object-cover"
        />

        {/* Carries the type. At 55% the lightest part of the painting still
            clears 5.8:1 against white, so the fine print passes AA too. */}
        <div aria-hidden="true" className="absolute inset-0 bg-ink/55" />

        <Wrap className="relative z-10 text-center">
          <p className="label text-paper/80">AI interview copilot · Windows</p>

          <h1 className="mx-auto mt-7 max-w-[15ch] text-mega text-paper">
            Answers, while they are still asking.
          </h1>

          <div className="mt-11 flex flex-wrap items-center justify-center gap-4">
            <DownloadButton />
            <Link href="/pricing" className="btn bg-paper/15 text-paper hover:bg-paper/25">
              See pricing
            </Link>
          </div>

          <p className="mt-7 font-mono text-xs text-paper/70">
            Free for 30 minutes. No card. Windows 10 and later.
          </p>
        </Wrap>
      </div>
    </div>
  );
}
