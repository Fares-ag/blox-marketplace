import { Link } from 'react-router-dom';
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  DEFAULT_PAGE_SIZE,
  FilterPanel,
  OpsCoreTable,
  OpsListPage,
  OpsPrimaryButton,
  OpsToolbar,
  SearchBar,
  StatusBadge,
  apiFetch,
  buildPaginationQuery,
  formatQar,
  useOpsLabels,
  type DealerInventoryItem,
  type FilterConfig,
  type OpsTableColumn,
} from '@drivemarket/shared';

export function InventoryListPage() {
  const { t, listingStatus } = useOpsLabels();
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(DEFAULT_PAGE_SIZE);
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<Record<string, unknown>>({});
  const { data, error, isLoading } = useQuery({
    queryKey: ['dealer-inventory', page, rowsPerPage],
    queryFn: () =>
      apiFetch<{
        total: number;
        items: Array<Pick<DealerInventoryItem, 'id' | 'make' | 'model' | 'model_year' | 'price' | 'listing_status'>>;
      }>(`/api/dealer/inventory?${buildPaginationQuery(page, rowsPerPage)}`),
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

  type Row = (typeof filteredItems)[number];
  const columns: OpsTableColumn<Row>[] = useMemo(
    () => [
      {
        id: 'vehicle',
        label: t('ops.col.vehicle'),
        minWidth: 180,
        format: (_, row) => (
          <Link to={`/inventory/${row.id}`}>
            {row.make} {row.model} {row.model_year}
          </Link>
        ),
      },
      {
        id: 'price',
        label: t('ops.col.price'),
        align: 'right',
        minWidth: 120,
        format: (value) => <span className="blox-money">{formatQar(Number(value))}</span>,
      },
      {
        id: 'listing_status',
        label: t('ops.col.status'),
        minWidth: 120,
        format: (value) => (
          <StatusBadge status={String(value)} type="listing" label={listingStatus(String(value))} />
        ),
      },
    ],
    [listingStatus, t],
  );

  return (
    <OpsListPage
      title={t('ops.dealer.inventoryTitle')}
      subtitle={t('ops.dealer.inventorySubtitle')}
      headerActions={
        <Link to="/inventory/new" style={{ textDecoration: 'none' }}>
          <OpsPrimaryButton>{t('ops.dealer.newListing')}</OpsPrimaryButton>
        </Link>
      }
      error={error ? <p style={{ color: 'var(--blox-danger)' }}>{(error as Error).message}</p> : undefined}
      toolbar={
        <OpsToolbar
          search={
            <SearchBar
              value={search}
              onChange={setSearch}
              placeholder={t('ops.common.search')}
            />
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
      <OpsCoreTable
        columns={columns}
        rows={filteredItems}
        loading={isLoading}
        page={page}
        rowsPerPage={rowsPerPage}
        totalRows={data?.total ?? 0}
        onPageChange={setPage}
        onRowsPerPageChange={(next) => {
          setRowsPerPage(next);
          setPage(0);
        }}
        emptyMessage={t('ops.dealer.noListings')}
      />
    </OpsListPage>
  );
}

export const InventoryList = InventoryListPage;
