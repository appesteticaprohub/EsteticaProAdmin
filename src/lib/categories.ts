// Definición de categorías con value (DB) y label (UI)
export const CATEGORIES = [
  { value: 'casos-clinicos', label: 'Casos Clínicos' },
  { value: 'complicaciones', label: 'Complicaciones' },
  { value: 'tendencias-facial', label: 'Tendencias Facial' },
  { value: 'tendencias-corporal', label: 'Tendencias Corporal' },
  { value: 'tendencias-capilar', label: 'Tendencias Capilar' },
  { value: 'tendencias-spa', label: 'Tendencias Spa' },
  { value: 'gestion-empresarial', label: 'Gestión Empresarial' }
] as const

// Tipo para los valores de categoría
export type CategoryValue = typeof CATEGORIES[number]['value']

// Mapeo rápido de value -> label
export const CATEGORY_LABELS: Record<string, string> = {
  'casos-clinicos': 'Casos Clínicos',
  'complicaciones': 'Complicaciones',
  'tendencias-facial': 'Tendencias Facial',
  'tendencias-corporal': 'Tendencias Corporal',
  'tendencias-capilar': 'Tendencias Capilar',
  'tendencias-spa': 'Tendencias Spa',
  'gestion-empresarial': 'Gestión Empresarial'
}

// Función helper para obtener el label desde el value
export function getCategoryLabel(value: string | null | undefined): string {
  if (!value) return 'Sin categoría'
  return CATEGORY_LABELS[value] || value
}

// Función helper para obtener el value desde el label
export function getCategoryValue(label: string): string | null {
  const category = CATEGORIES.find(cat => cat.label === label)
  return category ? category.value : null
}

// Función para validar si una categoría existe
export function isValidCategory(value: string): boolean {
  return Object.keys(CATEGORY_LABELS).includes(value)
}