import Image from 'next/image';

export function BrandMark({
  size = 32,
  invert = false,
}: {
  size?: number;
  invert?: boolean;
}) {
  return (
    <span
      className="inline-flex items-center justify-center overflow-hidden rounded-md"
      style={{ width: size, height: size }}
    >
      <Image
        src="/brand/pulse-mark.png"
        alt="Pulse Community Agency"
        width={size}
        height={size}
        className={invert ? 'invert' : ''}
        priority
      />
    </span>
  );
}
