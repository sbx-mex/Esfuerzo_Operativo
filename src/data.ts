import type { DashboardData } from './types'

let cachedData: DashboardData | null = null

export async function loadDashboard(signal?: AbortSignal) {
  if (cachedData) return cachedData
  const response = await fetch(`${import.meta.env.BASE_URL}data/dashboard.json`, {
    signal,
    cache:'no-cache',
    headers:{ Accept:'application/json' },
  })
  if (!response.ok) throw new Error(`No fue posible cargar el motor de datos (${response.status}).`)
  const payload = await response.json() as DashboardData
  if (!payload.meta?.latestDate || !Array.isArray(payload.directory) || !Array.isArray(payload.daily)) {
    throw new Error('El motor de datos no tiene la estructura esperada.')
  }
  cachedData = payload
  return payload
}
