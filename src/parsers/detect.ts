export type DbType = 'pg' | 'mysql'

export function detectDb(raw: string): DbType | null {
  try {
    const parsed = JSON.parse(raw)
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      ('query_block' in parsed || 'Query Block' in parsed)
    ) {
      return 'mysql'
    }
    if (Array.isArray(parsed) && parsed.length > 0 && 'Plan' in parsed[0]) {
      return 'pg'
    }
    return null
  } catch {
    return null
  }
}
