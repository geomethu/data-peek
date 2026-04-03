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

export interface WebDatabaseAdapter {
  connect(creds: ConnectionCredentials): Promise<void>
  disconnect(): Promise<void>
  query(sql: string, timeoutMs?: number): Promise<WebQueryResult>
  getSchemas(): Promise<SchemaInfo[]>
  explain(sql: string, analyze: boolean): Promise<WebExplainResult>
}
