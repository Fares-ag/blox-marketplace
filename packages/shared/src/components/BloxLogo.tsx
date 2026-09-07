import type { CSSProperties } from 'react';
import { bloxMeta } from '../config/blox-tokens';

export type BloxLogoTone = 'onDark' | 'onLight';

type BloxLogoProps = {
  /** Visual height in px (width scales). Default 28 for nav. */
  height?: number;
  /** onDark = light wordmark on dark chrome; onLight = deep-green wordmark on light surfaces */
  tone?: BloxLogoTone;
  className?: string;
  style?: CSSProperties;
  alt?: string;
};

/** Standard Blox wordmark — same PNG assets as blox-app (`BloxLogoNav` / `BloxLogo`). */
export function BloxLogo({
  height = 28,
  tone = 'onDark',
  className = '',
  style,
  alt = bloxMeta.name,
}: BloxLogoProps) {
  const src = tone === 'onDark' ? BLOX_LOGO_NAV_PATH : BLOX_LOGO_PATH;
  return (
    <span className="blox-logo-wrap" style={{ display: 'inline-flex', lineHeight: 0, ...style }}>
      <img
        src={src}
        alt={alt}
        height={height}
        className={`blox-logo ${className}`.trim()}
        style={{ display: 'block', height, width: 'auto' }}
      />
    </span>
  );
}

/** Nav wordmark for dark chrome (white + emerald). */
export const BLOX_LOGO_NAV_PATH = '/brand/blox-logo-nav.png';

/** Full wordmark for light surfaces (deep green + emerald). */
export const BLOX_LOGO_PATH = '/brand/blox-logo.png';

/** @deprecated use BLOX_LOGO_NAV_PATH */
export const BLOX_LOGO_PUBLIC_PATH = BLOX_LOGO_NAV_PATH;
