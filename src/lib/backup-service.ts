import { createServerSupabaseAdminClient } from './server-supabase'
import type {
  BackupConfig,
  BackupData,
  TableMetadata,
  ColumnInfo,
  ForeignKeyInfo,
  IndexInfo,
  RLSPolicy
} from '@/types/backup'

export class BackupService {
  private supabase: ReturnType<typeof createServerSupabaseAdminClient>

  constructor() {
    this.supabase = createServerSupabaseAdminClient()
  }

  /**
   * Descubre automáticamente todas las tablas en el schema público
   */
  async discoverTables(): Promise<string[]> {
    const { data, error } = await this.supabase.rpc('get_public_tables')
    
    if (error) {
      // Fallback: usar query directa si no existe la función
      const result = await this.supabase
        .from('information_schema.tables')
        .select('table_name')
        .eq('table_schema', 'public')
      
      if (result.error) throw new Error(`Error discovering tables: ${result.error.message}`)
      return result.data?.map((t: any) => t.table_name) || []
    }

    return data || []
  }

  /**
   * Obtiene la estructura completa de una tabla
   */
  async getTableStructure(tableName: string): Promise<TableMetadata> {
    // Obtener columnas
    const columns = await this.getTableColumns(tableName)
    
    // Obtener primary keys
    const primaryKeys = await this.getPrimaryKeys(tableName)
    
    // Obtener foreign keys
    const foreignKeys = await this.getForeignKeys(tableName)
    
    // Obtener índices
    const indexes = await this.getIndexes(tableName)
    
    // Contar filas
    const { count } = await this.supabase
      .from(tableName)
      .select('*', { count: 'exact', head: true })
    
    return {
      tableName,
      columns,
      primaryKeys,
      foreignKeys,
      indexes,
      rowCount: count || 0
    }
  }

  /**
   * Obtiene información de columnas de una tabla
   */
  private async getTableColumns(tableName: string): Promise<ColumnInfo[]> {
    const query = `
      SELECT 
        a.attname as name,
        pg_catalog.format_type(a.atttypid, a.atttypmod) as type,
        CASE WHEN a.attnotnull THEN 'NO' ELSE 'YES' END as nullable,
        pg_get_expr(d.adbin, d.adrelid) as default_value
      FROM pg_attribute a
      LEFT JOIN pg_attrdef d ON (a.attrelid, a.attnum) = (d.adrelid, d.adnum)
      WHERE a.attrelid = '${tableName}'::regclass
        AND a.attnum > 0
        AND NOT a.attisdropped
      ORDER BY a.attnum
    `

    const { data, error } = await this.supabase.rpc('execute_sql', { 
      query_text: query 
    })

    if (error) throw new Error(`Error getting columns: ${error.message}`)

    return (data || []).map((col: any) => ({
      name: col.name,
      type: col.type,
      nullable: col.nullable === 'YES',
      defaultValue: col.default_value
    }))
  }

  /**
   * Obtiene las primary keys de una tabla
   */
  private async getPrimaryKeys(tableName: string): Promise<string[]> {
    const query = `
      SELECT a.attname as column_name
      FROM pg_index i
      JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
      WHERE i.indrelid = '${tableName}'::regclass AND i.indisprimary
    `

    const { data, error } = await this.supabase.rpc('execute_sql', { 
      query_text: query 
    })

    if (error) return []
    return (data || []).map((row: any) => row.column_name)
  }

  /**
   * Obtiene las foreign keys de una tabla
   */
  private async getForeignKeys(tableName: string): Promise<ForeignKeyInfo[]> {
    const query = `
      SELECT
        tc.constraint_name as name,
        kcu.column_name as column,
        ccu.table_name as referenced_table,
        ccu.column_name as referenced_column,
        rc.delete_rule as on_delete,
        rc.update_rule as on_update
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu 
        ON tc.constraint_name = kcu.constraint_name
      JOIN information_schema.constraint_column_usage ccu 
        ON ccu.constraint_name = tc.constraint_name
      JOIN information_schema.referential_constraints rc
        ON tc.constraint_name = rc.constraint_name
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_schema = 'public'
        AND tc.table_name = '${tableName}'
    `

    const { data, error } = await this.supabase.rpc('execute_sql', { 
      query_text: query 
    })

    if (error) return []

    return (data || []).map((fk: any) => ({
      name: fk.name,
      column: fk.column,
      referencedTable: fk.referenced_table,
      referencedColumn: fk.referenced_column,
      onDelete: fk.on_delete,
      onUpdate: fk.on_update
    }))
  }

  /**
   * Obtiene los índices de una tabla
   */
  private async getIndexes(tableName: string): Promise<IndexInfo[]> {
    const query = `
      SELECT
        i.relname as name,
        array_agg(a.attname) as columns,
        ix.indisunique as unique,
        am.amname as type
      FROM pg_class t
      JOIN pg_index ix ON t.oid = ix.indrelid
      JOIN pg_class i ON i.oid = ix.indexrelid
      JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(ix.indkey)
      JOIN pg_am am ON i.relam = am.oid
      WHERE t.relname = '${tableName}'
        AND t.relkind = 'r'
        AND NOT ix.indisprimary
      GROUP BY i.relname, ix.indisunique, am.amname
    `

    const { data, error } = await this.supabase.rpc('execute_sql', { 
      query_text: query 
    })

    if (error) return []

    return (data || []).map((idx: any) => ({
      name: idx.name,
      columns: idx.columns,
      unique: idx.unique,
      type: idx.type
    }))
  }

  /**
   * Obtiene las políticas RLS de una tabla
   */
  async getRLSPolicies(tableName: string): Promise<RLSPolicy[]> {
    const query = `
      SELECT
        schemaname,
        tablename as table_name,
        policyname as policy_name,
        permissive,
        roles,
        cmd as command,
        qual as using,
        with_check
      FROM pg_policies
      WHERE schemaname = 'public' AND tablename = '${tableName}'
    `

    const { data, error } = await this.supabase.rpc('execute_sql', { 
      query_text: query 
    })

    if (error) return []

    return (data || []).map((policy: any) => ({
      tableName: policy.table_name,
      policyName: policy.policy_name,
      command: policy.command,
      roles: policy.roles,
      using: policy.using,
      withCheck: policy.with_check
    }))
  }

  /**
   * Extrae datos de una tabla con filtros de fecha opcionales
   */
  async getTableData(
    tableName: string, 
    dateFrom?: string, 
    dateTo?: string
  ): Promise<any[]> {
    let query = this.supabase.from(tableName).select('*')

    // Aplicar filtros de fecha si existen
    // Asumimos que las tablas tienen una columna 'created_at'
    if (dateFrom) {
      query = query.gte('created_at', dateFrom)
    }
    if (dateTo) {
      query = query.lte('created_at', dateTo)
    }

    const { data, error } = await query

    if (error) {
      // Si la tabla no tiene created_at, obtener todos los datos
      if (error.message.includes('created_at')) {
        const { data: allData, error: allError } = await this.supabase
          .from(tableName)
          .select('*')
        
        if (allError) throw new Error(`Error fetching data: ${allError.message}`)
        return allData || []
      }
      throw new Error(`Error fetching data: ${error.message}`)
    }

    return data || []
  }

  /**
   * Obtiene todos los triggers de una tabla
   */
  async getTriggers(tableName: string): Promise<any[]> {
    const query = `
      SELECT
        t.tgname as trigger_name,
        pg_get_triggerdef(t.oid) as trigger_definition,
        t.tgenabled as is_enabled,
        p.proname as function_name
      FROM pg_trigger t
      JOIN pg_class c ON t.tgrelid = c.oid
      JOIN pg_proc p ON t.tgfoid = p.oid
      WHERE c.relname = '${tableName}'
        AND NOT t.tgisinternal
      ORDER BY t.tgname
    `

    const { data, error } = await this.supabase.rpc('execute_sql', { 
      query_text: query 
    })

    if (error) return []
    
    return (data || []).map((trigger: any) => ({
      triggerName: trigger.trigger_name,
      definition: trigger.trigger_definition,
      isEnabled: trigger.is_enabled === 'O',
      functionName: trigger.function_name,
      tableName
    }))
  }

  /**
   * Obtiene todas las funciones/procedimientos almacenados del schema público
   */
  async getFunctions(): Promise<any[]> {
    const query = `
      SELECT
        p.proname as function_name,
        pg_get_functiondef(p.oid) as function_definition,
        pg_catalog.pg_get_function_arguments(p.oid) as arguments,
        pg_catalog.pg_get_function_result(p.oid) as return_type,
        l.lanname as language,
        CASE 
          WHEN p.provolatile = 'i' THEN 'IMMUTABLE'
          WHEN p.provolatile = 's' THEN 'STABLE'
          ELSE 'VOLATILE'
        END as volatility,
        CASE p.prosecdef 
          WHEN true THEN 'SECURITY DEFINER'
          ELSE 'SECURITY INVOKER'
        END as security
      FROM pg_proc p
      JOIN pg_namespace n ON p.pronamespace = n.oid
      JOIN pg_language l ON p.prolang = l.oid
      WHERE n.nspname = 'public'
        AND p.prokind IN ('f', 'p')
      ORDER BY p.proname
    `

    const { data, error } = await this.supabase.rpc('execute_sql', { 
      query_text: query 
    })

    if (error) return []
    
    return (data || []).map((func: any) => ({
      functionName: func.function_name,
      definition: func.function_definition,
      arguments: func.arguments,
      returnType: func.return_type,
      language: func.language,
      volatility: func.volatility,
      security: func.security
    }))
  }

  /**
   * Obtiene las extensiones de PostgreSQL instaladas
   */
  async getExtensions(): Promise<string[]> {
    const query = 'SELECT extname FROM pg_extension WHERE extname NOT IN (\'plpgsql\')'

    const { data, error } = await this.supabase.rpc('execute_sql', { 
      query_text: query 
    })

    if (error) return []
    return (data || []).map((ext: any) => ext.extname)
  }

  /**
   * Genera el backup completo según la configuración
   */
  async generateBackup(config: BackupConfig, adminId: string): Promise<BackupData> {
    // Determinar qué tablas incluir
    let tables: string[]
    if (config.type === 'full') {
      tables = await this.discoverTables()
    } else {
      tables = config.tables || []
    }

    // Filtrar tablas del sistema de Supabase
    tables = tables.filter(table => 
      !table.startsWith('_') && 
      !table.startsWith('supabase_') &&
      table !== 'schema_migrations'
    )

    const backupData: BackupData = {
      metadata: {
        generatedAt: new Date().toISOString(),
        generatedBy: adminId,
        version: '1.0.0',
        config
      },
      tables: {},
      extensions: [],
      functions: [],
      triggers: []
    }

    // Procesar cada tabla
    for (const tableName of tables) {
      try {
        const tableData: any = {
          structure: null,
          data: [],
          policies: []
        }

        // Incluir estructura si está habilitado
        if (config.options.includeStructure) {
          tableData.structure = await this.getTableStructure(tableName)
        }

        // Incluir datos si está habilitado
        if (config.options.includeData) {
          tableData.data = await this.getTableData(
            tableName,
            config.dateFrom,
            config.dateTo
          )
        }

        // Incluir políticas RLS si está habilitado
        if (config.options.includeRLS) {
          tableData.policies = await this.getRLSPolicies(tableName)
        }

        backupData.tables[tableName] = tableData
      } catch (error) {
        console.error(`Error processing table ${tableName}:`, error)
        // Continuar con la siguiente tabla
      }
    }

    // Incluir extensiones si está habilitado
    if (config.options.includeExtensions) {
      backupData.extensions = await this.getExtensions()
    }

    // Incluir triggers y funciones si está habilitado
    if (config.options.includeTriggers) {
      // Obtener todas las funciones del schema público
      backupData.functions = await this.getFunctions()
      
      // Obtener triggers de cada tabla procesada
      const allTriggers: any[] = []
      for (const tableName of tables) {
        try {
          const tableTriggers = await this.getTriggers(tableName)
          allTriggers.push(...tableTriggers)
        } catch (error) {
          console.error(`Error getting triggers for ${tableName}:`, error)
        }
      }
      backupData.triggers = allTriggers
    }

    return backupData
  }
}