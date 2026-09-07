import { Link } from 'react-router-dom';
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  FilterPanel,
  OpsListPage,
  OpsPrimaryButton,
  OpsToolbar,
  SearchBar,
  StatusBadge,
  VehicleCardGrid,
  apiFetch,
  buildPaginationQuery,
  paginationWindow,
  useOpsLabels,
  type DealerInventoryItem,
  type FilterConfig,
  type VehicleCardOption,
} from '@drivemarket/shared';

const ROWS_PER_PAGE_OPTIONS = [12, 24, 48] as const;
type RowsPerPage = (typeof ROWS_PER_PAGE_OPTIONS)[number];
const DEFAULT_INVENTORY_PAGE_SIZE: RowsPerPage = ROWS_PER_PAGE_OPTIONS[0];

export function InventoryListPage() {
  const { t, listingStatus } = useOpsLabels();
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState<RowsPerPage>(DEFAULT_INVENTORY_PAGE_SIZE);
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<Record<string, unknown>>({});
  const { data, error, isLoading } = useQuery({
    queryKey: ['dealer-inventory', page, rowsPerPage],
    queryFn: () =>
      apiFetch<{ total: number; items: DealerInventoryItem[] }>(
        `/api/dealer/inventory?${buildPaginationQuery(page, rowsPerPage)}`,
      ),
  });

  const statusFilter = typeof filters.listingStatus === 'string' ? filters.listingStatus : '';
  const filterConfigs: FilterConfig[] = useMemo(
    () => [
      {
        id: 'listingStatus',
        label: t('ops.col.status'),
        type: 'select',
        options: ['draft', 'published', 'reserved', 'sold', 'archived'].map((value) => ({
          value,
          label: listingStatus(value),
        })),
      },
    ],
    [listingStatus, t],
  );

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (data?.items ?? []).filter((p) => {
      if (statusFilter && p.listing_status !== statusFilter) return false;
      if (!q) return true;
      return `${p.make} ${p.model} ${p.model_year}`.toLowerCase().includes(q);
    });
  }, [data?.items, search, statusFilter]);

  const cardItems: VehicleCardOption[] = useMemo(
    () =>
      filteredItems.map((p) => ({
        id: p.id,
        make: p.make,
        model: p.model,
        model_year: p.model_year,
        price: Number(p.price),
        condition: p.condition,
        listing_status: p.listing_status,
        primary_image: p.primary_image ?? p.images?.[0]?.storage_path ?? null,
        // Older API responses do not carry the flag; only a definite `false` earns the pill.
        identity_complete:
          typeof p.identity_complete === 'boolean'
            ? p.identity_complete
            : p.chassis_number === undefined && p.engine_number === undefined
              ? undefined
              : !!(p.vin?.trim() && p.chassis_number?.trim() && p.engine_number?.trim()),
      })),
    [filteredItems],
  );

  const total = data?.total ?? 0;
  const { from, to } = paginationWindow(total, page, rowsPerPage);
  const pageCount = Math.max(1, Math.ceil(total / rowsPerPage));

  return (
    <OpsListPage
      title={t('ops.dealer.inventoryTitle')}
      subtitle={t('ops.dealer.inventorySubtitle')}
      headerActions={
        <Link to="/inventory/new" className="blox-link-reset">
          <OpsPrimaryButton>{t('ops.dealer.newListing')}</OpsPrimaryButton>
        </Link>
      }
      error={error ? (error as Error).message : undefined}
      toolbar={
        <OpsToolbar
          search={
            <SearchBar value={search} onChange={setSearch} placeholder={t('ops.common.search')} />
          }
          filters={
            <FilterPanel
              filters={filterConfigs}
              values={filters}
              onChange={setFilters}
              onClear={() => setFilters({})}
            />
          }
        />
      }
    >
      <VehicleCardGrid
        items={cardItems}
        loading={isLoading}
        searchable={false}
        hrefFor={(item) => `/inventory/${item.id}`}
        statusFor={(item) => (
          <>
            <StatusBadge
              status={item.listing_status ?? 'draft'}
              type="listing"
              label={listingStatus(item.listing_status ?? 'draft')}
            />
          </>
        )}
        emptyTitle={t('ops.dealer.noListings')}
      />

      {total > 0 && (
        <div className="blox-pagination blox-inventory-pagination">
          <span className="blox-pagination__range">
            {t('ops.pagination.showing', { from, to, total })}
          </span>
          <label className="blox-pagination__size">
            <span>{t('ops.pagination.rowsPerPage')}</span>
            <span className="blox-segmented blox-segmented--light" role="group">
              {ROWS_PER_PAGE_OPTIONS.map((n) => (
                <button
                  key={n}
                  type="button"
                  className={n === rowsPerPage ? 'is-active' : undefined}
                  aria-pressed={n === rowsPerPage}
                  onClick={() => {
                    setRowsPerPage(n);
                    setPage(0);
                  }}
                >
                  {n}
                </button>
              ))}
            </span>
          </label>
          <div className="blox-pagination__nav">
            <button
              type="button"
              className="blox-btn blox-btn--ghost blox-btn--sm"
              disabled={page <= 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
            >
              ‹ {t('ops.pagination.previous')}
            </button>
            <span className="blox-pagination__page">
              {page + 1} / {pageCount}
            </span>
            <button
              type="button"
              className="blox-btn blox-btn--ghost blox-btn--sm"
              disabled={page + 1 >= pageCount}
              onClick={() => setPage((p) => p + 1)}
            >
              {t('ops.pagination.next')} ›
            </button>
          </div>
        </div>
      )}
    </OpsListPage>
  );
}

export const InventoryList = InventoryListPage;
