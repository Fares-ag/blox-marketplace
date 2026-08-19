import type { CSSProperties } from 'react';
import bloxLogoNav from '../assets/blox-logo-nav.png';
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

/** Standard Blox wordmark (nav / shell / auth). */
export function BloxLogo({
  height = 28,
  tone = 'onDark',
  className = '',
  style,
  alt = bloxMeta.name,
}: BloxLogoProps) {
  const img = (
    <img
      src={bloxLogoNav}
      alt={alt}
      className={tone === 'onDark' ? `blox-logo ${className}`.trim() : 'blox-logo'}
      style={{
        height,
        width: 'auto',
        display: 'block',
        ...(tone === 'onDark' ? style : undefined),
      }}
      decoding="async"
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
          padding: `${Math.max(4, Math.round(height * 0.22))}px ${Math.max(8, Math.round(height * 0.45))}px`,
          borderRadius: Math.max(6, Math.round(height * 0.28)),
          background: 'var(--blox-deep-green, #16535B)',
          lineHeight: 0,
          ...style,
        }}
      >
        {img}
      </span>
    );
  }

  return img;
}

/** Public path for static HTML / favicon use (copied into each app public/brand). */
export const BLOX_LOGO_PUBLIC_PATH = '/brand/blox-logo-nav.png';
