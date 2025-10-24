// Tipos para el sistema de backup

export type BackupType = 'full' | 'selective'
export type BackupFormat = 'sql' | 'json'

export interface BackupOptions {
  includeStructure: boolean
  includeData: boolean
  includeRLS: boolean
  includeTriggers: boolean
  includeIndexes: boolean
  includeExtensions: boolean
}

export interface BackupConfig {
  type: BackupType
  tables?: string[] // Solo cuando type === 'selective'
  dateFrom?: string // ISO date string
  dateTo?: string // ISO date string
  format: BackupFormat
  options: BackupOptions
}

export interface TableMetadata {
  tableName: string
  columns: ColumnInfo[]
  primaryKeys: string[]
  foreignKeys: ForeignKeyInfo[]
  indexes: IndexInfo[]
  rowCount: number
}

export interface ColumnInfo {
  name: string
  type: string
  nullable: boolean
  defaultValue: string | null
}

export interface ForeignKeyInfo {
  name: string
  column: string
  referencedTable: string
  referencedColumn: string
  onDelete: string
  onUpdate: string
}

export interface IndexInfo {
  name: string
  columns: string[]
  unique: boolean
  type: string
}

export interface RLSPolicy {
  tableName: string
  policyName: string
  command: string
  roles: string[]
  using: string | null
  withCheck: string | null
}

export interface BackupData {
  metadata: {
    generatedAt: string
    generatedBy: string
    version: string
    config: BackupConfig
  }
  tables: {
    [tableName: string]: TableBackupData
  }
  extensions: string[]
  functions: FunctionInfo[]
  triggers: TriggerInfo[]
}

// Interfaces para resultados de queries SQL
export interface TableNameResult {
  table_name: string
}

export interface ColumnQueryResult {
  name: string
  type: string
  nullable: string
  default_value: string | null
}

export interface PrimaryKeyResult {
  column_name: string
}

export interface ForeignKeyQueryResult {
  name: string
  column: string
  referenced_table: string
  referenced_column: string
  on_delete: string
  on_update: string
}

export interface IndexQueryResult {
  name: string
  columns: string[]
  unique: boolean
  type: string
}

export interface PolicyQueryResult {
  table_name: string
  policy_name: string
  command: string
  roles: string[]
  using: string | null
  with_check: string | null
}

export interface TriggerQueryResult {
  trigger_name: string
  trigger_definition: string
  is_enabled: string
  function_name: string
}

export interface TriggerInfo {
  triggerName: string
  definition: string
  isEnabled: boolean
  functionName: string
  tableName: string
}

export interface FunctionQueryResult {
  function_name: string
  function_definition: string
  arguments: string
  return_type: string
  language: string
  volatility: string
  security: string
}

export interface FunctionInfo {
  functionName: string
  definition: string
  arguments: string
  returnType: string
  language: string
  volatility: string
  security: string
}

export interface ExtensionQueryResult {
  extname: string
}

export interface TableBackupData {
  structure: TableMetadata | null
  data: Record<string, unknown>[]
  policies: RLSPolicy[]
}