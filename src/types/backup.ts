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
    [tableName: string]: {
      structure: TableMetadata
      data: any[]
      policies: RLSPolicy[]
    }
  }
  extensions: string[]
  functions: string[]
  triggers: string[]
}