/** Whether submitting an application will reserve the listing (dealer create always does). */
export function willReserveListingOnSubmit(isAdmin: boolean, submitOnCreate: boolean): boolean {
  return !isAdmin || submitOnCreate;
}

export type ListingFinancingBlock = {
  code: 'listing_not_available' | 'vehicle_unavailable';
  status: string;
};

/**
 * Returns a block reason when the listing cannot be used for financing at submit time.
 * When `willReserve` is false (admin draft), only sold/archived are blocked.
 */
export function listingFinancingBlock(
  listingStatus: string | undefined,
  willReserve: boolean,
): ListingFinancingBlock | null {
  const status = listingStatus ?? 'unknown';
  if (status === 'sold' || status === 'archived') {
    return { code: 'listing_not_available', status };
  }
  if (!willReserve) return null;
  if (status === 'reserved') {
    return { code: 'vehicle_unavailable', status };
  }
  if (status !== 'published') {
    return { code: 'listing_not_available', status };
  }
  return null;
}

export function isListingSelectableForFinancing(
  listingStatus: string | undefined,
  willReserve: boolean,
): boolean {
  return listingFinancingBlock(listingStatus, willReserve) === null;
}
