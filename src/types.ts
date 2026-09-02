export type View = 'operativo' | 'merch'
export type Metric = 'usd' | 'total'
export type ProductGroup = 'Cake Pop' | 'Galletas' | 'Dona G&G' | 'Mini Pan Muerto'

export interface DirectoryStore {
  cc:string
  store:string
  region:string
  dm:string
  storeType:string
  benchmark:string
}

export type DailyRow = [date:string, month:string, week:number, cc:string, cakePop:number, cookies:number, dona:number, miniPanMuerto:number]
export type MerchRow = [date:string, month:string, week:number, cc:string, units:number]

export interface DashboardData {
  version:string
  meta:{
    latestDate:string
    latestOperationalDate:string
    latestMerchDate:string
    minDate:string
    months:string[]
    weeks:number[]
    groups:ProductGroup[]
    weekPeriods:Record<View,Array<{
      week:number
      startDate:string
      endDate:string
      daysLoaded:number
      status:'open'|'closed'
    }>>
    metricDefinition:string
    generatedAt:string
  }
  directory:DirectoryStore[]
  dailyColumns:string[]
  daily:DailyRow[]
  merchColumns:string[]
  merch:MerchRow[]
  catalog:{
    groups:Record<ProductGroup,string[]>
    notes:Record<string,string>
  }
}

export interface StoreScore extends DirectoryStore {
  units:number
  usd:number
  active:boolean
}

export interface DmScore {
  dm:string
  stores:number
  activeStores:number
  units:number
  usd:number
}
