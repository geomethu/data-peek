'use client'

import { useMemo, useRef, useState } from 'react'
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  type SortingState,
  type ColumnDef,
} from '@tanstack/react-table'
import { useVirtualizer } from '@tanstack/react-virtual'
import type { QueryField } from '@shared/index'

interface ResultsTableProps {
  rows: Record<string, unknown>[]
  fields: QueryField[]
}

export function ResultsTable({ rows, fields }: ResultsTableProps) {
  const [sorting, setSorting] = useState<SortingState>([])
  const parentRef = useRef<HTMLDivElement>(null)

  const columns = useMemo<ColumnDef<Record<string, unknown>>[]>(
    () =>
      fields.map((field) => ({
        accessorKey: field.name,
        header: field.name,
        cell: ({ getValue }) => {
          const value = getValue()
          if (value === null) return <span className="italic text-muted-foreground/50">NULL</span>
          if (typeof value === 'object') return <span className="text-orange-400">{JSON.stringify(value)}</span>
          return String(value)
        },
        size: Math.max(100, Math.min(300, field.name.length * 10 + 40)),
      })),
    [fields]
  )

  const table = useReactTable({
    data: rows,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  })

  const { rows: tableRows } = table.getRowModel()

  const virtualizer = useVirtualizer({
    count: tableRows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 33,
    overscan: 20,
  })

  if (fields.length === 0) return null

  return (
    <div ref={parentRef} className="flex-1 overflow-auto">
      <table className="w-full border-collapse text-xs font-mono">
        <thead className="sticky top-0 z-10">
          {table.getHeaderGroups().map((hg) => (
            <tr key={hg.id}>
              {hg.headers.map((header) => (
                <th
                  key={header.id}
                  onClick={header.column.getToggleSortingHandler()}
                  className="cursor-pointer select-none whitespace-nowrap border-b border-border bg-background px-3 py-1.5 text-left font-medium text-accent hover:bg-muted/50"
                  style={{ width: header.getSize() }}
                >
                  {flexRender(header.column.columnDef.header, header.getContext())}
                  {{ asc: ' ↑', desc: ' ↓' }[header.column.getIsSorted() as string] ?? ''}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {virtualizer.getVirtualItems().length > 0 && (
            <tr>
              <td
                colSpan={columns.length}
                style={{ height: virtualizer.getVirtualItems()[0].start }}
              />
            </tr>
          )}
          {virtualizer.getVirtualItems().map((virtualRow) => {
            const row = tableRows[virtualRow.index]
            return (
              <tr
                key={row.id}
                className="border-b border-border/30 hover:bg-muted/30"
              >
                {row.getVisibleCells().map((cell) => (
                  <td
                    key={cell.id}
                    className="whitespace-nowrap px-3 py-1 text-foreground max-w-xs truncate"
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            )
          })}
          {virtualizer.getVirtualItems().length > 0 && (
            <tr>
              <td
                colSpan={columns.length}
                style={{
                  height:
                    virtualizer.getTotalSize() -
                    (virtualizer.getVirtualItems().at(-1)?.end ?? 0),
                }}
              />
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
