import type { CSSProperties, SVGProps } from 'react';
import { bloxMeta } from '../config/blox-tokens';

export type BloxLogoTone = 'onDark' | 'onLight';

type BloxLogoProps = {
  /** Visual height in px (width scales). Default 28 for nav. */
  height?: number;
  /** onDark = white wordmark on dark UI; onLight = wordmark on brand plate for light UI */
  tone?: BloxLogoTone;
  className?: string;
  style?: CSSProperties;
  alt?: string;
};

function BloxWordmark({
  height,
  className,
  style,
  alt,
  ...svgProps
}: {
  height: number;
  className?: string;
  style?: CSSProperties;
  alt: string;
} & SVGProps<SVGSVGElement>) {
  const width = Math.round(height * (120 / 32));
  return (
    <svg
      viewBox="0 0 120 32"
      width={width}
      height={height}
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label={alt}
      className={className}
      style={{ display: 'block', ...style }}
      {...svgProps}
    >
      <text
        x="0"
        y="24"
        fontFamily="'IBM Plex Sans', 'Segoe UI', sans-serif"
        fontSize="22"
        fontWeight="700"
        fill="currentColor"
        letterSpacing="-0.02em"
      >
        blox
      </text>
    </svg>
  );
}

/** Standard Blox wordmark (nav / shell / auth). */
export function BloxLogo({
  height = 28,
  tone = 'onDark',
  className = '',
  style,
  alt = bloxMeta.name,
}: BloxLogoProps) {
  const mark = (
    <BloxWordmark
      height={height}
      className={`blox-logo ${className}`.trim()}
      style={tone === 'onDark' ? style : undefined}
      alt={alt}
    />
  );

  if (tone === 'onLight') {
    return (
      <span
        className={`blox-logo-plate ${className}`.trim()}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#fff',
          padding: `${Math.max(4, Math.round(height * 0.22))}px ${Math.max(8, Math.round(height * 0.45))}px`,
          borderRadius: Math.max(6, Math.round(height * 0.28)),
          background: 'var(--blox-deep-green, #16535B)',
          lineHeight: 0,
          ...style,
        }}
      >
        {mark}
      </span>
    );
  }

  return (
    <span className="blox-logo-wrap" style={{ display: 'inline-flex', color: '#fff', lineHeight: 0 }}>
      {mark}
    </span>
  );
}

/** Public path for static HTML / favicon use (served from shared public/). */
export const BLOX_LOGO_PUBLIC_PATH = '/brand/blox-logo-nav.svg';
