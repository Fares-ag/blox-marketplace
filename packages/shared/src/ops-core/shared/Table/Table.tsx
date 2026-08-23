import React, { useCallback } from 'react';
import {
  Table as MuiTable,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Paper,
  Box,
} from '@mui/material';
import { TableSkeleton } from '../Skeleton/Skeleton';
import { EmptyState } from '../EmptyState/EmptyState';
import './Table.scss';

export interface Column<T extends object = Record<string, unknown>> {
  id: string;
  label: string;
  minWidth?: number;
  align?: 'right' | 'left' | 'center';
  format?: (value: any, row: T) => React.ReactNode;
}

export interface TableProps<T extends object = Record<string, unknown>> {
  columns: Column<T>[];
  rows: T[];
  loading?: boolean;
  page?: number;
  rowsPerPage?: number;
  totalRows?: number;
  onPageChange?: (page: number) => void;
  onRowsPerPageChange?: (rowsPerPage: number) => void;
  onRowClick?: (row: T) => void;
  emptyMessage?: string;
}

function renderCellValue(value: unknown): React.ReactNode {
  if (value === null || value === undefined) return '';
  if (React.isValidElement(value)) return value;
  switch (typeof value) {
    case 'string':
    case 'number':
      return value;
    case 'boolean':
      return value ? 'Yes' : 'No';
    default:
      try {
        return JSON.stringify(value);
      } catch {
        return String(value);
      }
  }
}

const TableRowComponent = <T extends object>({
  row,
  columns,
  onRowClick,
}: {
  row: T;
  columns: Column<T>[];
  onRowClick?: (row: T) => void;
}) => {
  const handleClick = useCallback(() => {
    onRowClick?.(row);
  }, [onRowClick, row]);

  const rowRecord = row as unknown as Record<string, unknown>;

  return (
    <TableRow
      hover
      onClick={onRowClick ? handleClick : undefined}
      className={onRowClick ? 'clickable-row' : ''}
      sx={{ cursor: onRowClick ? 'pointer' : 'default' }}
    >
      {columns.map((column) => {
        const value = rowRecord[column.id];
        return (
          <TableCell key={column.id} align={column.align || 'left'}>
            {column.format ? column.format(value, row) : renderCellValue(value)}
          </TableCell>
        );
      })}
    </TableRow>
  );
};

export function Table<T extends object>({
  columns,
  rows,
  loading = false,
  page = 0,
  rowsPerPage = 10,
  totalRows,
  onPageChange,
  onRowsPerPageChange,
  onRowClick,
  emptyMessage = 'No data available',
}: TableProps<T>) {
  const handleChangePage = useCallback(
    (_event: unknown, newPage: number) => {
      onPageChange?.(newPage);
    },
    [onPageChange]
  );

  const handleChangeRowsPerPage = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const newRowsPerPage = parseInt(event.target.value, 10);
      onRowsPerPageChange?.(newRowsPerPage);
    },
    [onRowsPerPageChange]
  );

  return (
    <Paper className="custom-table-container">
      {loading ? (
        <Box sx={{ p: 3 }}>
          <TableSkeleton rows={rowsPerPage} columns={columns.length} />
        </Box>
      ) : rows.length === 0 ? (
        <EmptyState title="No data available" message={emptyMessage} />
      ) : (
        <>
          <TableContainer>
            <MuiTable stickyHeader>
              <TableHead>
                <TableRow>
                  {columns.map((column) => (
                    <TableCell
                      key={column.id}
                      align={column.align || 'left'}
                      style={{ minWidth: column.minWidth }}
                      className="table-header"
                    >
                      {column.label}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((row, index) => (
                  <TableRowComponent
                    key={String((row as any)?.id ?? index)}
                    row={row}
                    columns={columns}
                    onRowClick={onRowClick}
                  />
                ))}
              </TableBody>
            </MuiTable>
          </TableContainer>
          {totalRows !== undefined && (
            <TablePagination
              component="div"
              count={totalRows}
              page={page}
              onPageChange={handleChangePage}
              rowsPerPage={rowsPerPage}
              onRowsPerPageChange={handleChangeRowsPerPage}
              rowsPerPageOptions={[5, 10, 25, 50]}
            />
          )}
        </>
      )}
    </Paper>
  );
}
