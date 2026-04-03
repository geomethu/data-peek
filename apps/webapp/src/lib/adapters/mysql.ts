import mysql from 'mysql2/promise'
import type {
  SchemaInfo,
  QueryField,
  TableInfo,
  ColumnInfo,
  ForeignKeyInfo,
  RoutineInfo,
  RoutineParameterInfo,
} from '@shared/index'
import type {
  WebDatabaseAdapter,
  WebQueryResult,
  WebExplainResult,
  ConnectionCredentials,
} from './types'

const MYSQL_TYPE_MAP: Record<number, string> = {
  0: 'decimal',
  1: 'tinyint',
  2: 'smallint',
  3: 'int',
  4: 'float',
  5: 'double',
  6: 'null',
  7: 'timestamp',
  8: 'bigint',
  9: 'mediumint',
  10: 'date',
  11: 'time',
  12: 'datetime',
  13: 'year',
  15: 'varchar',
  16: 'bit',
  245: 'json',
  246: 'newdecimal',
  247: 'enum',
  248: 'set',
  249: 'tiny_blob',
  250: 'medium_blob',
  251: 'long_blob',
  252: 'blob',
  253: 'var_string',
  254: 'string',
  255: 'geometry',
}

interface MySQLColumnRow {
  table_schema: string
  table_name: string
  column_name: string
  data_type: string
  column_type: string
  is_nullable: string
  column_default: string | null
  ordinal_position: number
  extra: string
  is_primary_key: boolean | number
}

interface MySQLForeignKeyRow {
  table_schema: string
  table_name: string
  column_name: string
  constraint_name: string
  referenced_schema: string
  referenced_table: string
  referenced_column: string
}

interface MySQLRoutineRow {
  routine_schema: string
  routine_name: string
  routine_type: string
  return_type?: string
  specific_name: string
}

interface MySQLParameterRow {
  specific_schema: string
  specific_name: string
  parameter_name: string
  data_type: string
  parameter_mode: string
  ordinal_position: number
}

export class MySQLWebAdapter implements WebDatabaseAdapter {
  private connection: mysql.Connection | null = null

  async connect(creds: ConnectionCredentials): Promise<void> {
    this.connection = await mysql.createConnection({
      host: creds.host,
      port: creds.port,
      database: creds.database,
      user: creds.user,
      password: creds.password,
      ssl: creds.ssl ? { rejectUnauthorized: false } : undefined,
      connectTimeout: 10000,
    })
  }

  async disconnect(): Promise<void> {
    if (this.connection) {
      await this.connection.end()
      this.connection = null
    }
  }

  async query(sql: string, timeoutMs = 30000): Promise<WebQueryResult> {
    if (!this.connection) throw new Error('Not connected')

    const start = performance.now()
    const [rows, fields] = await this.connection.query({ sql, timeout: timeoutMs })
    const durationMs = Math.round(performance.now() - start)

    const resultRows = Array.isArray(rows) ? (rows as Record<string, unknown>[]) : []
    const resultFields: QueryField[] = (fields || []).map((f: mysql.FieldPacket) => ({
      name: f.name,
      dataType: MYSQL_TYPE_MAP[f.type ?? 253] ?? `unknown(${f.type})`,
      dataTypeID: f.type,
    }))

    return {
      rows: resultRows,
      fields: resultFields,
      rowCount: resultRows.length,
      durationMs,
    }
  }

  async explain(sql: string, analyze: boolean): Promise<WebExplainResult> {
    if (!this.connection) throw new Error('Not connected')

    const start = performance.now()
    const prefix = analyze ? 'EXPLAIN ANALYZE' : 'EXPLAIN FORMAT=JSON'
    const [rows] = await this.connection.query(`${prefix} ${sql}`)
    const durationMs = Math.round(performance.now() - start)

    return {
      plan: Array.isArray(rows) ? rows : rows,
      durationMs,
    }
  }

  async getSchemas(): Promise<SchemaInfo[]> {
    if (!this.connection) throw new Error('Not connected')

    const systemSchemas = "('mysql', 'performance_schema', 'information_schema', 'sys')"

    const [schemasRows] = await this.connection.query(`
      SELECT schema_name FROM information_schema.schemata
      WHERE schema_name NOT IN ${systemSchemas} ORDER BY schema_name
    `)
    const [tablesRows] = await this.connection.query(`
      SELECT table_schema, table_name, table_type FROM information_schema.tables
      WHERE table_schema NOT IN ${systemSchemas} ORDER BY table_schema, table_name
    `)
    const [columnsRows] = await this.connection.query(`
      SELECT c.table_schema, c.table_name, c.column_name, c.data_type, c.column_type,
        c.is_nullable, c.column_default, c.ordinal_position, c.extra,
        CASE WHEN kcu.column_name IS NOT NULL THEN true ELSE false END as is_primary_key
      FROM information_schema.columns c
      LEFT JOIN information_schema.key_column_usage kcu
        ON c.table_schema = kcu.table_schema AND c.table_name = kcu.table_name
        AND c.column_name = kcu.column_name AND kcu.constraint_name = 'PRIMARY'
      WHERE c.table_schema NOT IN ${systemSchemas}
      ORDER BY c.table_schema, c.table_name, c.ordinal_position
    `)
    const [fksRows] = await this.connection.query(`
      SELECT kcu.table_schema, kcu.table_name, kcu.column_name, kcu.constraint_name,
        kcu.referenced_table_schema AS referenced_schema,
        kcu.referenced_table_name AS referenced_table,
        kcu.referenced_column_name AS referenced_column
      FROM information_schema.key_column_usage kcu
      WHERE kcu.referenced_table_name IS NOT NULL AND kcu.table_schema NOT IN ${systemSchemas}
      ORDER BY kcu.table_schema, kcu.table_name, kcu.column_name
    `)
    const [routinesRows] = await this.connection.query(`
      SELECT routine_schema, routine_name, routine_type, data_type as return_type, specific_name
      FROM information_schema.routines
      WHERE routine_schema NOT IN ${systemSchemas} ORDER BY routine_schema, routine_name
    `)
    const [paramsRows] = await this.connection.query(`
      SELECT specific_schema, specific_name, parameter_name, data_type, parameter_mode, ordinal_position
      FROM information_schema.parameters
      WHERE specific_schema NOT IN ${systemSchemas} AND parameter_name IS NOT NULL
      ORDER BY specific_schema, specific_name, ordinal_position
    `)

    const schemas = schemasRows as { schema_name: string }[]
    const tables = tablesRows as { table_schema: string; table_name: string; table_type: string }[]
    const columns = columnsRows as MySQLColumnRow[]
    const fks = fksRows as MySQLForeignKeyRow[]
    const routines = routinesRows as MySQLRoutineRow[]
    const params = paramsRows as MySQLParameterRow[]

    return buildMySQLSchemaInfo(schemas, tables, columns, fks, routines, params)
  }
}

function buildMySQLSchemaInfo(
  schemas: { schema_name: string }[],
  tables: { table_schema: string; table_name: string; table_type: string }[],
  columns: MySQLColumnRow[],
  fks: MySQLForeignKeyRow[],
  routines: MySQLRoutineRow[],
  params: MySQLParameterRow[]
): SchemaInfo[] {
  const fkMap = new Map<string, ForeignKeyInfo>()
  for (const fk of fks) {
    fkMap.set(`${fk.table_schema}.${fk.table_name}.${fk.column_name}`, {
      constraintName: fk.constraint_name,
      referencedSchema: fk.referenced_schema,
      referencedTable: fk.referenced_table,
      referencedColumn: fk.referenced_column,
    })
  }

  const paramMap = new Map<string, RoutineParameterInfo[]>()
  for (const p of params) {
    const key = `${p.specific_schema}.${p.specific_name}`
    if (!paramMap.has(key)) paramMap.set(key, [])
    paramMap.get(key)!.push({
      name: p.parameter_name,
      dataType: p.data_type,
      mode: (p.parameter_mode as 'IN' | 'OUT' | 'INOUT') || 'IN',
      ordinalPosition: p.ordinal_position,
    })
  }

  const schemaMap = new Map<string, SchemaInfo>()
  for (const s of schemas) {
    schemaMap.set(s.schema_name, { name: s.schema_name, tables: [], routines: [] })
  }

  const tableMap = new Map<string, TableInfo>()
  for (const t of tables) {
    const schema = schemaMap.get(t.table_schema)
    if (!schema) continue
    const tableType = t.table_type === 'BASE TABLE' ? 'table' : 'view'
    const table: TableInfo = {
      name: t.table_name,
      type: tableType as TableInfo['type'],
      columns: [],
    }
    schema.tables.push(table)
    tableMap.set(`${t.table_schema}.${t.table_name}`, table)
  }

  for (const c of columns) {
    const table = tableMap.get(`${c.table_schema}.${c.table_name}`)
    if (!table) continue
    const fk = fkMap.get(`${c.table_schema}.${c.table_name}.${c.column_name}`)
    const col: ColumnInfo = {
      name: c.column_name,
      dataType: c.column_type || c.data_type,
      isNullable: c.is_nullable === 'YES',
      isPrimaryKey: !!c.is_primary_key,
      defaultValue: c.column_default ?? undefined,
      ordinalPosition: c.ordinal_position,
      foreignKey: fk,
    }
    table.columns.push(col)
  }

  for (const r of routines) {
    const schema = schemaMap.get(r.routine_schema)
    if (!schema) continue
    const rParams = paramMap.get(`${r.routine_schema}.${r.specific_name}`) ?? []
    const routine: RoutineInfo = {
      name: r.routine_name,
      type: r.routine_type === 'FUNCTION' ? 'function' : 'procedure',
      returnType: r.return_type,
      parameters: rParams,
    }
    schema.routines = schema.routines ?? []
    schema.routines.push(routine)
  }

  return Array.from(schemaMap.values())
}
