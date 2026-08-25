import type { CSSProperties } from 'react';
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
  const width = Math.round(height * (120 / 32));
  const mark = (
    <img
      src={BLOX_LOGO_PUBLIC_PATH}
      alt={alt}
      width={width}
      height={height}
      className={`blox-logo ${className}`.trim()}
      style={{ display: 'block', height, width: 'auto', ...style }}
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
        {mark}
      </span>
    );
  }

  return (
    <span className="blox-logo-wrap" style={{ display: 'inline-flex', lineHeight: 0 }}>
      {mark}
    </span>
  );
}

/** Public path for static HTML / favicon use (served from shared public/). */
export const BLOX_LOGO_PUBLIC_PATH = '/brand/blox-logo-nav.svg';
