import { describe, expect, it } from 'vitest';
import { isListingSelectableForFinancing, willReserveListingOnSubmit } from './vehicle-availability';

describe('vehicle availability', () => {
  it('does not reserve a listing when an application is submitted', () => {
    expect(willReserveListingOnSubmit(false, true)).toBe(false);
    expect(willReserveListingOnSubmit(true, true)).toBe(false);
  });

  it('lets dealers pick published and reserved listings', () => {
    expect(isListingSelectableForFinancing('published', true)).toBe(true);
    expect(isListingSelectableForFinancing('reserved', true)).toBe(true);
    expect(isListingSelectableForFinancing('draft', false)).toBe(true);
  });

  it('keeps sold and archived listings closed', () => {
    expect(isListingSelectableForFinancing('sold', false)).toBe(false);
    expect(isListingSelectableForFinancing('archived', false)).toBe(false);
  });
});
