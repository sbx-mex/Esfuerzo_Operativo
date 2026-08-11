import type { DashboardData } from './types'

let cachedData: DashboardData | null = null

function validateDashboard(payload: DashboardData) {
  const expectedDailyColumns = ['date','month','week','cc','cakePop','cookies','dona']
  const expectedMerchColumns = ['date','month','week','cc','units']
  const sameColumns = (actual:string[], expected:string[]) =>
    Array.isArray(actual) && actual.length === expected.length && actual.every((value,index) => value === expected[index])
  if (!payload.meta?.latestDate || !payload.meta.latestOperationalDate || !payload.meta.latestMerchDate) {
    throw new Error('El motor no informa correctamente sus fechas de actualización.')
  }
  if (!Array.isArray(payload.directory) || !payload.directory.length) {
    throw new Error('El Directorio no contiene tiendas válidas.')
  }
  if (payload.directory.some(item => !item.cc || !item.store || !item.region || !item.dm || !item.storeType || typeof item.benchmark !== 'string')) {
    throw new Error('El Directorio no conserva CC, Tienda, Región, DM, Tipo Tienda y Benchmark.')
  }
  if (!Array.isArray(payload.daily) || !sameColumns(payload.dailyColumns,expectedDailyColumns)) {
    throw new Error('El CSV operativo no tiene la estructura publicada esperada.')
  }
  if (!Array.isArray(payload.merch) || !sameColumns(payload.merchColumns,expectedMerchColumns)) {
    throw new Error('El CSV Merch no tiene la estructura publicada esperada.')
  }
  const latestOperationalRow = payload.daily.reduce((latest,row) => row[0] > latest ? row[0] : latest,'')
  const latestMerchRow = payload.merch.reduce((latest,row) => row[0] > latest ? row[0] : latest,'')
  if (latestOperationalRow !== payload.meta.latestOperationalDate || latestMerchRow !== payload.meta.latestMerchDate) {
    throw new Error('La fecha del encabezado no coincide con las filas del motor seleccionado.')
  }
  if (!payload.meta.weekPeriods?.operativo?.length || !payload.meta.weekPeriods?.merch?.length) {
    throw new Error('El motor no informa el estado de sus semanas.')
  }
  return payload
}

export async function loadDashboard(signal?: AbortSignal, force = false) {
  if (cachedData && !force) return cachedData
  const dataUrl = new URL(`${import.meta.env.BASE_URL}data/dashboard.json`,window.location.href)
  dataUrl.searchParams.set('actualizar',Date.now().toString())
  const response = await fetch(dataUrl, {
    signal,
    cache:'no-store',
    headers:{ Accept:'application/json' },
  })
  if (!response.ok) throw new Error(`No fue posible cargar el motor de datos (${response.status}).`)
  const payload = validateDashboard(await response.json() as DashboardData)
  cachedData = payload
  return payload
}
