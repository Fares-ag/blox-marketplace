/** Applications no longer reserve a listing, so submit never takes an exclusive lock. */
export function willReserveListingOnSubmit(_isAdmin: boolean, _submitOnCreate: boolean): boolean {
  return false;
}

export type ListingFinancingBlock = {
  code: 'listing_not_available' | 'vehicle_unavailable';
  status: string;
};

/**
 * A listing can be financed until it is sold or archived.
 * Reserved and published listings stay selectable — one vehicle may have many applications.
 */
export function listingFinancingBlock(
  listingStatus: string | undefined,
  _willReserve?: boolean,
): ListingFinancingBlock | null {
  const status = listingStatus ?? 'unknown';
  if (status === 'sold' || status === 'archived') {
    return { code: 'listing_not_available', status };
  }
  return null;
}

export function isListingSelectableForFinancing(
  listingStatus: string | undefined,
  willReserve?: boolean,
): boolean {
  return listingFinancingBlock(listingStatus, willReserve) === null;
}
