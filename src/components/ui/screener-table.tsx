'use client'

import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
  createColumnHelper,
  SortingState,
  ColumnFiltersState,
} from '@tanstack/react-table'
import { useState } from 'react'
import { ArrowUpDown, ArrowUp, ArrowDown, Trash2, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useTickerManagement } from '@/hooks/use-ticker-management'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { ScreenerRow } from '@/lib/types'
import { cn } from '@/lib/utils'

const columnHelper = createColumnHelper<ScreenerRow>()

interface ScreenerTableProps {
  data: ScreenerRow[]
  onRowClick?: (ticker: string) => void
  className?: string
  showDeleteButton?: boolean
}

export function ScreenerTable({ data, onRowClick, className, showDeleteButton = false }: ScreenerTableProps) {
  const [sorting, setSorting] = useState<SortingState>([])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  
  const { deleteTicker, isDeleting } = useTickerManagement()

  const handleDelete = async (ticker: string, e: React.MouseEvent) => {
    e.stopPropagation() // Prevent row click
    
    if (confirm(`Are you sure you want to delete ${ticker}? This will remove all associated data.`)) {
      try {
        await deleteTicker(ticker)
      } catch (error) {
        // Error is handled by the hook
      }
    }
  }

  const formatPercent = (value: number | null) => {
    if (value === null) return 'N/A'
    return `${(value * 100).toFixed(2)}%`
  }

  const formatCurrency = (value: number | null) => {
    if (value === null) return 'N/A'
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(value)
  }

  const formatRatio = (value: number | null) => {
    if (value === null) return 'N/A'
    return value.toFixed(2)
  }

  const getPercentColor = (value: number | null) => {
    if (value === null) return 'text-gray-500'
    if (value > 0) return 'text-green-600'
    if (value < 0) return 'text-red-600'
    return 'text-gray-600'
  }

  const columns = [
    columnHelper.accessor('ticker', {
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          className="h-8 px-2 font-semibold"
        >
          Ticker
          {column.getIsSorted() === 'asc' ? (
            <ArrowUp className="ml-2 h-4 w-4" />
          ) : column.getIsSorted() === 'desc' ? (
            <ArrowDown className="ml-2 h-4 w-4" />
          ) : (
            <ArrowUpDown className="ml-2 h-4 w-4" />
          )}
        </Button>
      ),
      cell: ({ row }) => (
        <div className="font-medium text-blue-600 hover:text-blue-800 cursor-pointer">
          {row.getValue('ticker')}
        </div>
      ),
    }),
    columnHelper.accessor('name', {
      header: 'Company',
      cell: ({ row }) => (
        <div className="max-w-[200px] truncate">
          {row.getValue('name') || 'N/A'}
        </div>
      ),
    }),
    columnHelper.accessor('close', {
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          className="h-8 px-2 font-semibold"
        >
          Price
          {column.getIsSorted() === 'asc' ? (
            <ArrowUp className="ml-2 h-4 w-4" />
          ) : column.getIsSorted() === 'desc' ? (
            <ArrowDown className="ml-2 h-4 w-4" />
          ) : (
            <ArrowUpDown className="ml-2 h-4 w-4" />
          )}
        </Button>
      ),
      cell: ({ row }) => formatCurrency(row.getValue('close')),
    }),
    columnHelper.accessor('pe_ttm', {
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          className="h-8 px-2 font-semibold"
        >
          P/E TTM
          {column.getIsSorted() === 'asc' ? (
            <ArrowUp className="ml-2 h-4 w-4" />
          ) : column.getIsSorted() === 'desc' ? (
            <ArrowDown className="ml-2 h-4 w-4" />
          ) : (
            <ArrowUpDown className="ml-2 h-4 w-4" />
          )}
        </Button>
      ),
      cell: ({ row }) => formatRatio(row.getValue('pe_ttm')),
    }),
    columnHelper.accessor('rev_yoy', {
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          className="h-8 px-2 font-semibold"
        >
          Rev YoY
          {column.getIsSorted() === 'asc' ? (
            <ArrowUp className="ml-2 h-4 w-4" />
          ) : column.getIsSorted() === 'desc' ? (
            <ArrowDown className="ml-2 h-4 w-4" />
          ) : (
            <ArrowUpDown className="ml-2 h-4 w-4" />
          )}
        </Button>
      ),
      cell: ({ row }) => {
        const value = row.getValue('rev_yoy') as number | null
        return (
          <span className={getPercentColor(value)}>
            {formatPercent(value)}
          </span>
        )
      },
    }),
    columnHelper.accessor('fcf_yield', {
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          className="h-8 px-2 font-semibold"
        >
          FCF Yield
          {column.getIsSorted() === 'asc' ? (
            <ArrowUp className="ml-2 h-4 w-4" />
          ) : column.getIsSorted() === 'desc' ? (
            <ArrowDown className="ml-2 h-4 w-4" />
          ) : (
            <ArrowUpDown className="ml-2 h-4 w-4" />
          )}
        </Button>
      ),
      cell: ({ row }) => {
        const value = row.getValue('fcf_yield') as number | null
        return (
          <span className={getPercentColor(value)}>
            {formatPercent(value)}
          </span>
        )
      },
    }),
    columnHelper.accessor('gross_margin', {
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          className="h-8 px-2 font-semibold"
        >
          Gross Margin
          {column.getIsSorted() === 'asc' ? (
            <ArrowUp className="ml-2 h-4 w-4" />
          ) : column.getIsSorted() === 'desc' ? (
            <ArrowDown className="ml-2 h-4 w-4" />
          ) : (
            <ArrowUpDown className="ml-2 h-4 w-4" />
          )}
        </Button>
      ),
      cell: ({ row }) => formatPercent(row.getValue('gross_margin')),
    }),
    columnHelper.accessor('op_margin', {
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          className="h-8 px-2 font-semibold"
        >
          Op Margin
          {column.getIsSorted() === 'asc' ? (
            <ArrowUp className="ml-2 h-4 w-4" />
          ) : column.getIsSorted() === 'desc' ? (
            <ArrowDown className="ml-2 h-4 w-4" />
          ) : (
            <ArrowUpDown className="ml-2 h-4 w-4" />
          )}
        </Button>
      ),
      cell: ({ row }) => formatPercent(row.getValue('op_margin')),
    }),
  ]

  // Add delete column if enabled
  if (showDeleteButton) {
    columns.push(
      columnHelper.display({
        id: 'actions',
        header: 'Actions',
        cell: ({ row }) => {
          const ticker = row.getValue('ticker') as string
          return (
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => handleDelete(ticker, e)}
              disabled={isDeleting === ticker}
              className="h-8 w-8 p-0 text-red-600 hover:text-red-800 hover:bg-red-50"
            >
              {isDeleting === ticker ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
            </Button>
          )
        },
      })
    )
  }

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    state: {
      sorting,
      columnFilters,
    },
  })

  return (
    <div className={cn('space-y-4', className)}>
      <div className="flex items-center space-x-2">
        <Input
          placeholder="Filter by ticker or company name..."
          value={(table.getColumn('ticker')?.getFilterValue() as string) ?? ''}
          onChange={(event) =>
            table.getColumn('ticker')?.setFilterValue(event.target.value)
          }
          className="max-w-sm"
        />
        <Badge variant="secondary">
          {table.getFilteredRowModel().rows.length} companies
        </Badge>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id} className="px-2">
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getFilteredRowModel().rows?.length ? (
              table.getFilteredRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && 'selected'}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => onRowClick?.(row.getValue('ticker'))}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className="px-2">
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center"
                >
                  No results.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
