import type { SchemaInfo, QueryField } from '@shared/index'

export interface WebQueryResult {
  rows: Record<string, unknown>[]
  fields: QueryField[]
  rowCount: number
  durationMs: number
}

export interface WebExplainResult {
  plan: unknown
  durationMs: number
}

export interface ConnectionCredentials {
  host: string
  port: number
  database: string
  user: string
  password: string
  ssl?: boolean
}

export interface ActiveQuery {
  pid: number
  user: string
  state: string
  duration: string
  durationMs: number
  query: string
}

export interface TableSizeEntry {
  schema: string
  table: string
  rows: number
  dataSize: string
  indexSize: string
  totalSize: string
  totalSizeBytes: number
}

export interface LockEntry {
  blockedPid: number
  blockedUser: string
  blockingPid: number
  blockingUser: string
  lockType: string
  relation: string
  waitDuration: string
  waitDurationMs: number
}

export interface WebDatabaseAdapter {
  connect(creds: ConnectionCredentials): Promise<void>
  disconnect(): Promise<void>
  query(sql: string, timeoutMs?: number): Promise<WebQueryResult>
  getSchemas(): Promise<SchemaInfo[]>
  explain(sql: string, analyze: boolean): Promise<WebExplainResult>
  getActiveQueries(): Promise<ActiveQuery[]>
  getTableSizes(): Promise<{ dbSize: string; tables: TableSizeEntry[] }>
  getCacheStats(): Promise<{ bufferHitRatio: number; indexHitRatio: number }>
  getLocks(): Promise<LockEntry[]>
}
