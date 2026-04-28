import Image from 'next/image';

/**
 * Pulse brand mark — uses the official PNG from `/brand/pulse-mark.png`.
 *
 * Tone:
 *   "cream"   — for placement on light surfaces (default).
 *   "inverse" — light bg behind the mark; for placement on dark sections.
 */
export function BrandMark({
  size = 28,
  tone = 'inverse',
}: {
  size?: number;
  tone?: 'cream' | 'inverse';
}) {
  const wrapperClass =
    tone === 'inverse'
      ? 'inline-flex items-center justify-center rounded-md bg-cream-lt p-1.5 shadow-sm'
      : 'inline-flex items-center justify-center';
  return (
    <span className={wrapperClass}>
      <Image
        src="/brand/pulse-mark.png"
        alt="Pulse"
        width={size}
        height={size}
        priority
      />
    </span>
  );
}
