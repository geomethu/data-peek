'use client'

import { CheckCircle, XCircle, Loader2 } from 'lucide-react'

interface ResultsStatusProps {
  rowCount: number | null
  durationMs: number | null
  error: string | null
  isExecuting: boolean
}

export function ResultsStatus({ rowCount, durationMs, error, isExecuting }: ResultsStatusProps) {
  if (isExecuting) {
    return (
      <div className="flex items-center gap-2 px-4 py-1.5 border-b border-border text-xs">
        <Loader2 className="h-3 w-3 animate-spin text-accent" />
        <span className="text-muted-foreground">Executing...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 px-4 py-1.5 border-b border-border text-xs">
        <XCircle className="h-3 w-3 text-destructive" />
        <span className="text-destructive truncate">{error}</span>
      </div>
    )
  }

  if (rowCount !== null) {
    return (
      <div className="flex items-center gap-2 px-4 py-1.5 border-b border-border text-xs">
        <CheckCircle className="h-3 w-3 text-success" />
        <span className="text-success">
          {rowCount.toLocaleString()} row{rowCount !== 1 ? 's' : ''}
        </span>
        {durationMs !== null && (
          <span className="text-muted-foreground">&middot; {durationMs}ms</span>
        )}
      </div>
    )
  }

  return null
}
