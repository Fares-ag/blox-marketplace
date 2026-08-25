import { describe, expect, it } from 'vitest';
import { listingImageMediaPath } from './listing-image-url';

describe('listingImageMediaPath', () => {
  it('rewrites private R2 endpoint URLs to the API media proxy', () => {
    expect(
      listingImageMediaPath(
        'https://fa92858db5f9247b380e5df67feb4247.r2.cloudflarestorage.com/listing-images/qauto/vw-tiguan/cover.png',
      ),
    ).toBe('/api/v1/media/listings/qauto/vw-tiguan/cover.png');
  });

  it('rewrites local upload paths to the API media proxy', () => {
    expect(listingImageMediaPath('/uploads/listing-images/qauto/audi-q5/cover.webp')).toBe(
      '/api/v1/media/listings/qauto/audi-q5/cover.webp',
    );
  });

  it('rewrites legacy /vehicles catalog paths to the bundled catalog media route', () => {
    expect(listingImageMediaPath('/vehicles/audi-rsq8.webp')).toBe(
      '/api/v1/media/catalog/audi-rsq8.webp',
    );
  });

  it('leaves public CDN URLs unchanged', () => {
    expect(listingImageMediaPath('https://cdn.example.com/qauto/audi-q5/cover.webp')).toBeNull();
  });
});
