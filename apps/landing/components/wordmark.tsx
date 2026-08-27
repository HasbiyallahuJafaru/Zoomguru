import Link from 'next/link';

/** Type, not a bitmap. The old 2.1 MB logo.png is only an icon now. */
export function Wordmark({ className = '' }: { className?: string }) {
  return (
    <Link
      href="/"
      className={`font-display text-[1.35rem] leading-none tracking-[-0.03em] text-ink ${className}`}
      style={{ fontVariationSettings: '"SOFT" 0, "WONK" 1, "opsz" 144' }}
    >
      Zoom<em className="not-italic text-overlay">Guru</em>
    </Link>
  );
}
