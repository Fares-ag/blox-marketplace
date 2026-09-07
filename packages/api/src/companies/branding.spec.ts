import { BadRequestException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { isHexColour, mergeBranding, normalizeHexColour, toBrandingDto } from './branding';

describe('company branding', () => {
  it('accepts 3- and 6-digit hex colours and normalises them', () => {
    expect(isHexColour('#ABC')).toBe(true);
    expect(isHexColour('#a1b2c3')).toBe(true);
    expect(isHexColour('red')).toBe(false);
    expect(isHexColour('#12345')).toBe(false);
    expect(normalizeHexColour(' #ABC ')).toBe('#aabbcc');
    expect(normalizeHexColour('#A1B2C3')).toBe('#a1b2c3');
  });

  it('rejects invalid colours with invalid_hex_colour', () => {
    expect(() => normalizeHexColour('red')).toThrow(BadRequestException);
    expect(() => mergeBranding(null, { primary: '#12345' })).toThrow('invalid_hex_colour');
    expect(() => mergeBranding(null, { accent: 'rgb(1,2,3)' })).toThrow('invalid_hex_colour');
  });

  it('merges a patch over stored branding, clearing on null or empty string', () => {
    const stored = { primary: '#112233', accent: '#445566', display_name: 'Elite Motors' };
    expect(mergeBranding(stored, { tagline: ' Drive today ' })).toEqual({
      primary: '#112233',
      accent: '#445566',
      logo_url: null,
      display_name: 'Elite Motors',
      tagline: 'Drive today',
    });
    expect(mergeBranding(stored, { accent: null, display_name: '' })).toEqual({
      primary: '#112233',
      accent: null,
      logo_url: null,
      display_name: null,
      tagline: null,
    });
  });

  it('returns null when nothing remains set', () => {
    expect(mergeBranding({ primary: '#112233' }, { primary: null })).toBeNull();
    expect(mergeBranding(null, {})).toBeNull();
    expect(toBrandingDto(null)).toBeNull();
    expect(toBrandingDto({})).toBeNull();
  });

  it('validates logo urls only when they are patched', () => {
    expect(() => mergeBranding(null, { logo_url: 'javascript:alert(1)' })).toThrow('invalid_logo_url');
    expect(mergeBranding(null, { logo_url: 'https://cdn.example.com/logo.png' })?.logo_url).toBe(
      'https://cdn.example.com/logo.png',
    );
    expect(mergeBranding(null, { logo_url: '/uploads/logo.svg' })?.logo_url).toBe('/uploads/logo.svg');
    // A legacy invalid value already stored must not block unrelated patches.
    expect(mergeBranding({ logo_url: 'not a url' }, { tagline: 'x' })?.tagline).toBe('x');
  });

  it('reads legacy camelCase keys and falls back to the company logo column', () => {
    expect(toBrandingDto({ primaryColor: '#000000', logoUrl: 'https://x/logo.png', displayName: 'X' })).toEqual({
      primary: '#000000',
      accent: null,
      logo_url: 'https://x/logo.png',
      display_name: 'X',
      tagline: null,
    });
    expect(toBrandingDto({ primary: '#ffffff' }, 'https://x/column.png')?.logo_url).toBe(
      'https://x/column.png',
    );
    expect(toBrandingDto(null, 'https://x/column.png')?.logo_url).toBe('https://x/column.png');
  });
});
