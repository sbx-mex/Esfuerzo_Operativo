import { useEffect, useMemo, useState, type ReactNode } from 'react'
import type { jsPDF as JsPdfDocument } from 'jspdf'
import {
  ArrowDownRight, ArrowUpRight, Building2, CalendarDays, Check,
  ChevronDown, ChevronRight, CircleGauge, Coffee, Cookie, Donut,
  FileDown, Info, MessageCircle, PackageOpen, RefreshCw, Search, ShoppingBag,
  Sparkles, Target, TrendingUp,
} from 'lucide-react'
import { loadDashboard } from './data'
import type { DashboardData, DailyRow, DmScore, Metric, ProductGroup, StoreScore, View } from './types'

const groupColumn: Record<ProductGroup, 4 | 5 | 6> = {
  "Cake Pop's":4,
  Galletas:5,
  'Dona G&G':6,
}
const groupIcon: Record<ProductGroup, typeof Coffee> = {
  "Cake Pop's":Coffee,
  Galletas:Cookie,
  'Dona G&G':Donut,
}
const dateFormatter = new Intl.DateTimeFormat('es-MX', { day:'2-digit', month:'short', year:'2-digit', timeZone:'UTC' })
const integerFormatter = new Intl.NumberFormat('es-MX', { maximumFractionDigits:0 })
const decimalFormatter = new Intl.NumberFormat('es-MX', { minimumFractionDigits:1, maximumFractionDigits:1 })

function dateFromIso(value: string) {
  const [year, month, day] = value.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day))
}

function shortDate(value: string) {
  if (!value) return '—'
  const raw = dateFormatter.format(dateFromIso(value)).replace('.', '')
  return raw.split(' ').map((part, index) => index === 1 ? `${part[0].toUpperCase()}${part.slice(1)}` : part).join('/')
}

function metricValue(metric: Metric, units: number, usd: number) {
  return metric === 'usd' ? usd : units
}

function metricLabel(metric: Metric) {
  return metric === 'usd' ? 'USD' : 'Unidades Totales'
}

function formatMetric(metric: Metric, value: number) {
  return metric === 'usd' ? decimalFormatter.format(value) : integerFormatter.format(value)
}

function parseView() : View {
  const hash = window.location.hash.replace('#','')
  return hash === 'merch' ? 'merch' : 'operativo'
}

function Card({ label, value, note, icon:Icon, tone = 'green' }: { label:string; value:string; note:string; icon:typeof Coffee; tone?:'green'|'gold'|'cream'|'ink' }) {
  return <article className={`kpi-card tone-${tone}`}>
    <span className="kpi-icon"><Icon size={20} aria-hidden="true" /></span>
    <div><p>{label}</p><strong>{value}</strong><small>{note}</small></div>
  </article>
}

function EmptyState({ children }: { children:ReactNode }) {
  return <div className="empty-state"><Search size={28} aria-hidden="true" /><strong>Sin datos para esta selección</strong><p>{children}</p></div>
}

function TrendChart({ points, metric }: { points:Array<{ date:string; value:number }>; metric:Metric }) {
  const visible = points.slice(-14)
  const max = Math.max(1, ...visible.map(point => point.value))
  if (!visible.length) return <EmptyState>Ajusta el periodo o el alcance para continuar.</EmptyState>
  return <div className="trend-chart" role="img" aria-label={`Avance diario de ${metricLabel(metric)}`}>
    {visible.map(point => <div className="trend-column" key={point.date} title={`${shortDate(point.date)} · ${formatMetric(metric, point.value)}`}>
      <span className="trend-value">{formatMetric(metric, point.value)}</span>
      <span className="trend-track"><span className="trend-bar" style={{ height:`${Math.max(5, point.value / max * 100)}%` }} /></span>
      <small>{shortDate(point.date).slice(0,6)}</small>
    </div>)}
  </div>
}

interface StoreTrend {
  values:number[]
  delta:number
  percent:number | null
}

interface DmWeekScore extends DmScore {
  weekly:Record<number,number>
}

function StoreTable({ scores, metric, title, message, trends, ascending = false, limit = 10 }: {
  scores:StoreScore[]; metric:Metric; title:string; message:string; trends:Map<string,StoreTrend>; ascending?:boolean; limit?:number
}) {
  const sorted = [...scores].sort((a,b) => {
    const difference = metricValue(metric, a.units, a.usd) - metricValue(metric, b.units, b.usd)
    return (ascending ? difference : -difference) || a.store.localeCompare(b.store, 'es')
  }).slice(0,limit)
  const max = Math.max(1, ...sorted.map(score => metricValue(metric, score.units, score.usd)))
  return <section className="panel ranking-panel">
    <div className="panel-heading"><div><p className="eyebrow">{ascending ? 'Foco' : 'Top'}</p><h2>{title}</h2><p>{message}</p></div><span className={`status-chip ${ascending ? 'warning' : ''}`}>{sorted.length} tiendas</span></div>
    {!sorted.length ? <EmptyState>No existen tiendas en el alcance seleccionado.</EmptyState> : <div className="table-scroll"><table>
      <thead><tr><th>#</th><th>Tienda</th><th>USD</th><th>Total impulso</th><th>Tendencia</th></tr></thead>
      <tbody>{sorted.map((score,index) => {
        const value = metricValue(metric, score.units, score.usd)
        const trend = trends.get(score.cc)
        const direction = trend && trend.delta > 0 ? 'up' : trend && trend.delta < 0 ? 'down' : 'flat'
        const TrendIcon = direction === 'up' ? ArrowUpRight : direction === 'down' ? ArrowDownRight : ChevronRight
        const trendText = trend?.percent !== null && trend?.percent !== undefined
          ? `${trend.percent > 0 ? '+' : ''}${decimalFormatter.format(trend.percent)}%`
          : trend ? `${trend.delta > 0 ? '+' : ''}${formatMetric(metric,trend.delta)}` : '—'
        return <tr key={score.cc}>
          <td><span className={`rank-badge ${ascending && index < 3 ? 'needs-focus' : ''}`}>{index + 1}</span></td>
          <td><strong>{score.store}</strong></td>
          <td>{metric === 'usd' ? <div className="inline-meter"><span style={{ width:`${value / max * 100}%` }} /><strong>{decimalFormatter.format(score.usd)}</strong></div> : decimalFormatter.format(score.usd)}</td>
          <td>{metric === 'total' ? <div className="inline-meter"><span style={{ width:`${value / max * 100}%` }} /><strong>{integerFormatter.format(score.units)}</strong></div> : integerFormatter.format(score.units)}</td>
          <td><span className={`trend-pill ${direction}`}><TrendIcon size={14} />{trendText}</span></td>
        </tr>
      })}</tbody>
    </table></div>}
  </section>
}

function DmWeekTable({ scores, metric, weeks }: { scores:DmWeekScore[]; metric:Metric; weeks:number[] }) {
  const sorted = [...scores].sort((a,b) => metricValue(metric,b.units,b.usd) - metricValue(metric,a.units,a.usd))
  return <section className="panel dm-panel">
    <div className="panel-heading"><div><p className="eyebrow">Resumen ejecutivo</p><h2>Lectura por DM y semana</h2><p>Una sola vista para reconocer el avance y ubicar la siguiente prioridad.</p></div><span className="status-chip">{sorted.length} {sorted.length === 1 ? 'distrito' : 'distritos'}</span></div>
    {!sorted.length ? <EmptyState>No hay distritos en el alcance seleccionado.</EmptyState> : <div className="table-scroll dm-week-table"><table>
      <thead><tr><th>#</th><th>DM</th>{weeks.map(value => <th key={value}>Sem {value}</th>)}<th>Total</th></tr></thead>
      <tbody>{sorted.map((score,index) => <tr key={score.dm}>
        <td><span className={`rank-badge ${index === 0 ? '' : index >= sorted.length - 2 ? 'needs-focus' : ''}`}>{index + 1}</span></td>
        <td><strong>{score.dm}</strong></td>
        {weeks.map(value => <td key={value}>{formatMetric(metric,score.weekly[value] ?? 0)}</td>)}
        <td><strong>{formatMetric(metric,metricValue(metric,score.units,score.usd))}</strong></td>
      </tr>)}</tbody>
    </table></div>}
  </section>
}

function CorporateBrief({ status, week, headline, improvement, reinforcement, guidance }: {
  status:'open'|'closed'; week:number | null; headline:string; improvement:string; reinforcement:string; guidance:string
}) {
  return <section className="panel corporate-brief" aria-label="Lectura ejecutiva">
    <div className="brief-copy"><div className="panel-heading"><div><p className="eyebrow">Resumen</p><h2>Lectura rápida para actuar</h2><p>{headline}</p></div><span className={`status-chip ${status === 'open' ? 'warning' : ''}`}>{week ? `Sem ${week}` : 'Sin semana'} · {status === 'open' ? 'en curso' : 'cerrada'}</span></div>
      <div className="brief-grid">
        <article><span className="brief-icon positive"><ArrowUpRight size={18} /></span><div><small>Qué mejoró</small><strong>{improvement}</strong></div></article>
        <article><span className="brief-icon focus"><Target size={18} /></span><div><small>Dónde reforzar</small><strong>{reinforcement}</strong></div></article>
        <article><span className="brief-icon neutral"><Sparkles size={18} /></span><div><small>Siguiente acción</small><strong>{guidance}</strong></div></article>
      </div>
    </div>
    <img src={`${import.meta.env.BASE_URL}assets/objetivo_esfuerzo.png`} alt="Objetivo inmediato: mejorar USD contra la semana anterior. Objetivo sostenible: superar 50 unidades." loading="lazy" decoding="async" />
  </section>
}

function Filters({
  data, view, metric, setMetric, month, setMonth, selectedWeeks, setSelectedWeeks,
  region, setRegion, dm, setDm, cc, setCc, selectedGroup, setSelectedGroup,
}:{
  data:DashboardData; view:View; metric:Metric; setMetric:(metric:Metric)=>void
  month:string; setMonth:(value:string)=>void; selectedWeeks:Set<number>; setSelectedWeeks:(value:Set<number>)=>void
  region:string; setRegion:(value:string)=>void; dm:string; setDm:(value:string)=>void; cc:string; setCc:(value:string)=>void
  selectedGroup:ProductGroup; setSelectedGroup:(group:ProductGroup)=>void
}) {
  const regions = useMemo(() => [...new Set(data.directory.map(item => item.region))].sort(), [data])
  const dms = useMemo(() => [...new Set(data.directory.filter(item => region === 'Todas' || item.region === region).map(item => item.dm))].sort(), [data,region])
  const stores = useMemo(() => data.directory.filter(item => (region === 'Todas' || item.region === region) && (dm === 'Todos' || item.dm === dm)), [data,region,dm])
  const availableWeeks = useMemo(() => {
    const source = view === 'merch' ? data.merch : data.daily
    return [...new Set(source.filter(row => month === 'Todos' || row[1] === month).map(row => row[2]))].sort((a,b) => a - b)
  },[data,view,month])
  const weekLabel = selectedWeeks.size === 0
    ? 'Todas'
    : selectedWeeks.size === 1
      ? `Semana ${[...selectedWeeks][0]}`
      : `${selectedWeeks.size} semanas`
  function toggleWeek(value:number) {
    const next = new Set(selectedWeeks)
    if (next.has(value)) next.delete(value)
    else next.add(value)
    setSelectedWeeks(next)
  }
  return <section className="filters" aria-label="Filtros del tablero">
    <div className="filter-topline">
      <p className="filter-context">{view === 'merch' ? 'Impulso Merch · motor independiente' : `${selectedGroup} · lectura sin combinar`}</p>
      <div className="metric-toggle" aria-label="Métrica principal">
        <button type="button" className={metric === 'usd' ? 'active' : ''} onClick={() => setMetric('usd')} aria-pressed={metric === 'usd'}>USD</button>
        <button type="button" className={metric === 'total' ? 'active' : ''} onClick={() => setMetric('total')} aria-pressed={metric === 'total'}>Unidades Totales</button>
      </div>
    </div>
    <div className="filter-grid">
      <label>Mes<select value={month} onChange={event => { setMonth(event.target.value); setSelectedWeeks(new Set()) }}><option>Todos</option>{data.meta.months.map(value => <option key={value}>{value}</option>)}</select></label>
      <div className="week-field"><span>Semana</span><details className="week-picker"><summary>{weekLabel}<ChevronDown size={16} /></summary><div className="week-options">
        <button type="button" className={selectedWeeks.size === 0 ? 'active' : ''} onClick={() => setSelectedWeeks(new Set())}>Todas las semanas</button>
        {availableWeeks.map(value => <button type="button" key={value} className={selectedWeeks.has(value) ? 'active' : ''} onClick={() => toggleWeek(value)}><span className="week-option-label"><span className="week-checkbox">{selectedWeeks.has(value) && <Check size={13} />}</span>Semana {value}</span></button>)}
      </div></details></div>
      <label>Región<select value={region} onChange={event => { setRegion(event.target.value); setDm('Todos'); setCc('Todos') }}><option>Todas</option>{regions.map(value => <option key={value}>{value}</option>)}</select></label>
      <label>DM<select value={dm} onChange={event => { setDm(event.target.value); setCc('Todos') }}><option>Todos</option>{dms.map(value => <option key={value}>{value}</option>)}</select></label>
      <label className="store-filter">Tienda<select value={cc} onChange={event => setCc(event.target.value)}><option value="Todos">Todas las tiendas</option>{stores.map(item => <option key={item.cc} value={item.cc}>{item.store} · {item.cc}</option>)}</select></label>
    </div>
    {view !== 'merch' && <div className="product-filter"><div><span>Familia activa</span><small>Lectura independiente</small></div><div className="product-buttons">
      {data.meta.groups.map(group => { const Icon = groupIcon[group]; const active = selectedGroup === group; return <button type="button" key={group} className={active ? 'active' : ''} onClick={() => setSelectedGroup(group)} aria-pressed={active}><Icon size={17} />{group}{active && <Check size={14} />}</button> })}
    </div><p><Info size={14} /> Cada familia se evalúa por separado. Dona G&amp;G no incluye Dona en Combo.</p></div>}
    <div className="metric-definition"><CircleGauge size={16} /><span><strong>USD</strong> muestra el promedio diario por tienda en el periodo seleccionado.</span></div>
  </section>
}

export function App() {
  const [data,setData] = useState<DashboardData | null>(null)
  const [error,setError] = useState('')
  const [retryKey,setRetryKey] = useState(0)
  const [view,setView] = useState<View>(parseView)
  const [metric,setMetric] = useState<Metric>('usd')
  const [month,setMonth] = useState('Todos')
  const [selectedWeeks,setSelectedWeeks] = useState<Set<number>>(new Set())
  const [region,setRegion] = useState('Todas')
  const [dm,setDm] = useState('Todos')
  const [cc,setCc] = useState('Todos')
  const [selectedGroup,setSelectedGroup] = useState<ProductGroup>("Cake Pop's")

  useEffect(() => {
    const controller = new AbortController()
    setError('')
    loadDashboard(controller.signal).then(payload => {
      setData(payload)
    }).catch(loadError => {
      if (loadError instanceof DOMException && loadError.name === 'AbortError') return
      setError(loadError instanceof Error ? loadError.message : 'No fue posible cargar la información.')
    })
    return () => controller.abort()
  },[retryKey])

  useEffect(() => {
    const onHashChange = () => setView(parseView())
    window.addEventListener('hashchange',onHashChange)
    return () => window.removeEventListener('hashchange',onHashChange)
  },[])

  function changeView(next: View) {
    setView(next)
    history.replaceState(null,'',`#${next}`)
    window.scrollTo({ top:0, behavior:'smooth' })
  }

  const scopeStores = useMemo(() => data?.directory.filter(item =>
    (region === 'Todas' || item.region === region)
    && (dm === 'Todos' || item.dm === dm)
    && (cc === 'Todos' || item.cc === cc)
  ) ?? [],[data,region,dm,cc])
  const scopeCc = useMemo(() => new Set(scopeStores.map(item => item.cc)),[scopeStores])

  const periodMatches = (row: DailyRow | DashboardData['merch'][number]) =>
    (month === 'Todos' || row[1] === month)
    && (selectedWeeks.size === 0 || selectedWeeks.has(row[2]))

  const sourceRows = useMemo(() => {
    if (!data) return []
    return view === 'merch' ? data.merch.filter(periodMatches) : data.daily.filter(periodMatches)
  // periodMatches depends only on the listed primitives.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[data,view,month,selectedWeeks])

  const visibleDates = useMemo(() => [...new Set(sourceRows.map(row => row[0]))].sort(),[sourceRows])
  const visibleWeeks = useMemo(() => [...new Set(sourceRows.map(row => row[2]))].sort((a,b) => a - b),[sourceRows])
  const dayCount = visibleDates.length

  const storeScores = useMemo<StoreScore[]>(() => {
    if (!data) return []
    const units = new Map(scopeStores.map(store => [store.cc,0]))
    if (view === 'merch') {
      for (const row of data.merch) if (scopeCc.has(row[3]) && periodMatches(row)) units.set(row[3],(units.get(row[3]) ?? 0) + row[4])
    } else {
      const selectedColumn = groupColumn[selectedGroup]
      for (const row of data.daily) if (scopeCc.has(row[3]) && periodMatches(row)) {
        const value = row[selectedColumn]
        units.set(row[3],(units.get(row[3]) ?? 0) + value)
      }
    }
    return scopeStores.map(store => {
      const total = units.get(store.cc) ?? 0
      return { ...store, units:total, usd:dayCount ? total / dayCount : 0, active:total > 0 }
    })
  // periodMatches depends only on listed filters.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[data,view,scopeStores,scopeCc,month,selectedWeeks,selectedGroup,dayCount])

  const totalUnits = storeScores.reduce((sum,store) => sum + store.units,0)
  const totalUsd = dayCount && storeScores.length ? totalUnits / dayCount / storeScores.length : 0
  const activeStores = storeScores.filter(store => store.active).length

  const dailyPoints = useMemo(() => {
    if (!data || !scopeStores.length) return []
    const totals = new Map<string,number>()
    visibleDates.forEach(date => totals.set(date,0))
    if (view === 'merch') {
      data.merch.forEach(row => { if (scopeCc.has(row[3]) && periodMatches(row)) totals.set(row[0],(totals.get(row[0]) ?? 0) + row[4]) })
    } else {
      const selectedColumn = groupColumn[selectedGroup]
      data.daily.forEach(row => { if (scopeCc.has(row[3]) && periodMatches(row)) totals.set(row[0],(totals.get(row[0]) ?? 0) + row[selectedColumn]) })
    }
    return [...totals].sort(([a],[b]) => a.localeCompare(b)).map(([date,value]) => ({ date, value:metric === 'usd' ? value / scopeStores.length : value }))
  // periodMatches depends only on listed filters.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[data,view,scopeStores.length,scopeCc,visibleDates,selectedGroup,metric,month,selectedWeeks])

  const dmScores = useMemo<DmScore[]>(() => {
    const byDm = new Map<string,DmScore>()
    storeScores.forEach(store => {
      const current = byDm.get(store.dm) ?? { dm:store.dm, stores:0, activeStores:0, units:0, usd:0 }
      current.stores += 1
      current.activeStores += store.active ? 1 : 0
      current.units += store.units
      byDm.set(store.dm,current)
    })
    byDm.forEach(score => { score.usd = dayCount && score.stores ? score.units / dayCount / score.stores : 0 })
    return [...byDm.values()]
  },[storeScores,dayCount])

  const weeklyStoreTotals = useMemo(() => {
    const totals = new Map<string,Map<number,number>>()
    scopeStores.forEach(store => totals.set(store.cc,new Map()))
    if (!data) return totals
    if (view === 'merch') {
      data.merch.forEach(row => {
        if (!scopeCc.has(row[3]) || !periodMatches(row)) return
        const store = totals.get(row[3]) ?? new Map<number,number>()
        store.set(row[2],(store.get(row[2]) ?? 0) + row[4])
        totals.set(row[3],store)
      })
    } else {
      const selectedColumn = groupColumn[selectedGroup]
      data.daily.forEach(row => {
        if (!scopeCc.has(row[3]) || !periodMatches(row)) return
        const store = totals.get(row[3]) ?? new Map<number,number>()
        store.set(row[2],(store.get(row[2]) ?? 0) + row[selectedColumn])
        totals.set(row[3],store)
      })
    }
    return totals
  // periodMatches depends only on the listed filters.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[data,view,scopeStores,scopeCc,month,selectedWeeks,selectedGroup])

  const weekDayCounts = useMemo(() => {
    const dates = new Map<number,Set<string>>()
    sourceRows.forEach(row => {
      const current = dates.get(row[2]) ?? new Set<string>()
      current.add(row[0])
      dates.set(row[2],current)
    })
    return new Map([...dates].map(([week,values]) => [week,values.size]))
  },[sourceRows])

  const storeTrends = useMemo(() => {
    const trends = new Map<string,StoreTrend>()
    storeScores.forEach(store => {
      const values = visibleWeeks.map(selectedWeek => {
        const units = weeklyStoreTotals.get(store.cc)?.get(selectedWeek) ?? 0
        return metric === 'usd' ? units / Math.max(1,weekDayCounts.get(selectedWeek) ?? 1) : units
      })
      const first = values[0] ?? 0
      const last = values.at(-1) ?? 0
      const delta = values.length > 1 ? last - first : 0
      trends.set(store.cc,{ values, delta, percent:values.length > 1 && first ? delta / first * 100 : null })
    })
    return trends
  },[storeScores,visibleWeeks,weeklyStoreTotals,metric,weekDayCounts])

  const dmWeekScores = useMemo<DmWeekScore[]>(() => dmScores.map(score => {
    const stores = storeScores.filter(store => store.dm === score.dm)
    const weekly:Record<number,number> = {}
    visibleWeeks.forEach(selectedWeek => {
      const units = stores.reduce((sum,store) => sum + (weeklyStoreTotals.get(store.cc)?.get(selectedWeek) ?? 0),0)
      weekly[selectedWeek] = metric === 'usd'
        ? units / Math.max(1,weekDayCounts.get(selectedWeek) ?? 1) / Math.max(1,stores.length)
        : units
    })
    return { ...score, weekly }
  }),[dmScores,storeScores,visibleWeeks,weeklyStoreTotals,metric,weekDayCounts])

  const comparison = useMemo(() => {
    if (!data || !scopeStores.length) return null
    const rows = view === 'merch' ? data.merch : data.daily
    const allWeeks = [...new Set(rows.map(row => row[2]))].sort((a,b) => a - b)
    const currentWeek = visibleWeeks.at(-1) ?? allWeeks.at(-1)
    if (currentWeek === undefined) return null
    const previousWeek = [...allWeeks].reverse().find(value => value < currentWeek) ?? null
    const relevantWeeks = new Set([currentWeek,...(previousWeek === null ? [] : [previousWeek])])
    const dates = new Map<number,Set<string>>()
    const totals = new Map<string,Map<number,number>>()
    scopeStores.forEach(store => totals.set(store.cc,new Map()))
    rows.forEach(row => {
      if (!scopeCc.has(row[3]) || !relevantWeeks.has(row[2])) return
      const weekDates = dates.get(row[2]) ?? new Set<string>()
      weekDates.add(row[0])
      dates.set(row[2],weekDates)
      const store = totals.get(row[3]) ?? new Map<number,number>()
      const units = Number(view === 'merch' ? row[4] : row[groupColumn[selectedGroup]]) || 0
      store.set(row[2],(store.get(row[2]) ?? 0) + units)
      totals.set(row[3],store)
    })
    const storeValue = (storeCc:string, selectedWeek:number | null) => {
      if (selectedWeek === null) return 0
      const units = totals.get(storeCc)?.get(selectedWeek) ?? 0
      return metric === 'usd' ? units / Math.max(1,dates.get(selectedWeek)?.size ?? 1) : units
    }
    const scopeValue = (selectedWeek:number | null) => {
      if (selectedWeek === null) return 0
      const units = scopeStores.reduce((sum,store) => sum + (totals.get(store.cc)?.get(selectedWeek) ?? 0),0)
      return metric === 'usd' ? units / Math.max(1,dates.get(selectedWeek)?.size ?? 1) / scopeStores.length : units
    }
    const currentValue = scopeValue(currentWeek)
    const previousValue = scopeValue(previousWeek)
    const storeMovements = scopeStores.map(store => ({
      store:store.store,
      current:storeValue(store.cc,currentWeek),
      delta:storeValue(store.cc,currentWeek) - storeValue(store.cc,previousWeek),
    })).sort((a,b) => b.delta - a.delta)
    const familyMovements = data.meta.groups.map(group => {
      const totalsByWeek = new Map<number,number>()
      const familyDates = new Map<number,Set<string>>()
      data.daily.forEach(row => {
        if (!scopeCc.has(row[3]) || !relevantWeeks.has(row[2])) return
        totalsByWeek.set(row[2],(totalsByWeek.get(row[2]) ?? 0) + row[groupColumn[group]])
        const current = familyDates.get(row[2]) ?? new Set<string>()
        current.add(row[0])
        familyDates.set(row[2],current)
      })
      const value = (selectedWeek:number | null) => {
        if (selectedWeek === null) return 0
        const units = totalsByWeek.get(selectedWeek) ?? 0
        return metric === 'usd' ? units / Math.max(1,familyDates.get(selectedWeek)?.size ?? 1) / scopeStores.length : units
      }
      const current = value(currentWeek)
      return { group, current, delta:current - value(previousWeek) }
    }).sort((a,b) => b.delta - a.delta)
    const period = data.meta.weekPeriods[view]?.find(item => item.week === currentWeek)
    return {
      currentWeek,
      previousWeek,
      status:(period?.status ?? 'closed') as 'open'|'closed',
      daysLoaded:period?.daysLoaded ?? dates.get(currentWeek)?.size ?? 0,
      currentValue,
      previousValue,
      delta:currentValue - previousValue,
      percent:previousValue ? (currentValue - previousValue) / previousValue * 100 : null,
      bestStore:storeMovements[0] ?? null,
      focusStore:[...storeMovements].sort((a,b) => a.current - b.current)[0] ?? null,
      bestFamily:familyMovements[0] ?? null,
      focusFamily:[...familyMovements].sort((a,b) => a.current - b.current)[0] ?? null,
    }
  },[data,view,scopeStores,scopeCc,visibleWeeks,selectedGroup,metric])

  async function exportCorporatePdf() {
    if (!data) return
    const [{ jsPDF },{ default:autoTable }] = await Promise.all([import('jspdf'),import('jspdf-autotable')])
    const storeOnly = cc !== 'Todos'
    const orientation = storeOnly ? 'portrait' : 'landscape'
    const doc = new jsPDF({ orientation, unit:'mm', format:'letter', compress:true })
    const pageWidth = doc.internal.pageSize.getWidth()
    const pageHeight = doc.internal.pageSize.getHeight()
    const margin = 10
    const green:[number,number,number] = [0,98,65]
    const deep:[number,number,number] = [0,76,52]
    const mint:[number,number,number] = [225,242,234]
    const cream:[number,number,number] = [250,247,239]
    const red:[number,number,number] = [166,56,47]
    const title = view === 'merch' ? 'Impulso Merch' : `Esfuerzo Operativo · ${selectedGroup}`
    const scopeLabel = storeOnly
      ? scopeStores[0]?.store ?? 'Tienda'
      : dm !== 'Todos' ? `Portafolio · ${dm}` : region === 'Todas' ? 'Región completa' : `Región · ${region}`
    const weeksLabel = visibleWeeks.length ? visibleWeeks.map(value => `S${value}`).join(', ') : 'Sin semanas'
    const valueLabel = metricLabel(metric)
    const tableTheme = {
      styles:{ fontSize:7, cellPadding:1.7, lineColor:[220,230,225] as [number,number,number], lineWidth:.15, textColor:[28,60,49] as [number,number,number], overflow:'linebreak' as const, valign:'middle' as const },
      headStyles:{ fillColor:deep, textColor:[255,255,255] as [number,number,number], fontStyle:'bold' as const, halign:'center' as const, fontSize:7 },
      alternateRowStyles:{ fillColor:[247,250,248] as [number,number,number] },
      margin:{ left:margin, right:margin },
      showHead:'everyPage' as const,
    }
    let cursorY = 54
    const drawTable = (options:Parameters<typeof autoTable>[1]) => {
      autoTable(doc,options)
      cursorY = (doc as JsPdfDocument & { lastAutoTable?:{ finalY:number } }).lastAutoTable?.finalY ?? cursorY
    }
    const ensureSpace = (needed:number) => {
      if (cursorY + needed > pageHeight - 18) { doc.addPage(); cursorY = 8 }
    }
    const sectionTitle = (label:string, note:string) => {
      const y = cursorY + 7
      doc.setTextColor(...deep); doc.setFont('helvetica','bold'); doc.setFontSize(10); doc.text(label,margin,y)
      doc.setTextColor(92,112,103); doc.setFont('helvetica','normal'); doc.setFontSize(7); doc.text(note,margin,y + 4)
      cursorY = y + 7
      return cursorY
    }
    doc.setFillColor(...deep); doc.rect(0,0,pageWidth,35,'F')
    doc.setTextColor(255,255,255); doc.setFont('helvetica','bold'); doc.setFontSize(storeOnly ? 16 : 18); doc.text(title,margin,13)
    doc.setFont('helvetica','normal'); doc.setFontSize(8); doc.text(`${scopeLabel} · ${weeksLabel} · Corte ${shortDate(currentCutoff)}`,margin,20)
    doc.setFontSize(7); doc.text(`Lectura independiente · ${valueLabel}`,margin,26)
    doc.setFillColor(255,255,255); doc.roundedRect(pageWidth - 48,8,38,18,3,3,'F')
    doc.setTextColor(...green); doc.setFont('helvetica','bold'); doc.setFontSize(14); doc.text(formatMetric(metric,metric === 'usd' ? totalUsd : totalUnits),pageWidth - 29,17,{ align:'center' })
    doc.setFontSize(6); doc.text(valueLabel.toUpperCase(),pageWidth - 29,22,{ align:'center' })
    doc.setFillColor(...cream); doc.roundedRect(margin,40,pageWidth - margin * 2,12,2,2,'F')
    doc.setTextColor(...deep); doc.setFontSize(8); doc.text(
      comparison?.status === 'open'
        ? `Semana ${comparison.currentWeek} en curso · ${comparison.daysLoaded}/7 días cargados · seguimiento al ritmo diario.`
        : `Semana ${comparison?.currentWeek ?? '—'} cerrada · comparativo contra semana ${comparison?.previousWeek ?? '—'}.`,
      margin + 3,47,
    )

    const ordered = [...storeScores].sort((a,b) => metricValue(metric,b.units,b.usd) - metricValue(metric,a.units,a.usd) || a.store.localeCompare(b.store,'es'))
    if (storeOnly) {
      const store = ordered[0]
      if (view === 'operativo') {
        const familyRows = data.meta.groups.map(group => {
          const familyByWeek = visibleWeeks.map(selectedWeek => data.daily
            .filter(row => row[3] === cc && row[2] === selectedWeek && (month === 'Todos' || row[1] === month))
            .reduce((sum,row) => sum + row[groupColumn[group]],0))
          const units = familyByWeek.reduce((sum,value) => sum + value,0)
          const dates = new Set(data.daily.filter(row => row[3] === cc && visibleWeeks.includes(row[2]) && (month === 'Todos' || row[1] === month)).map(row => row[0])).size
          return [group,decimalFormatter.format(dates ? units / dates : 0),integerFormatter.format(units),...familyByWeek.map(integerFormatter.format)]
        })
        drawTable({ ...tableTheme, startY:sectionTitle('Detalle por familia','Cake Pop, Galletas y Dona G&G se muestran por separado.'), head:[['Familia','USD','Total',...visibleWeeks.map(value => `Sem ${value}`)]], body:familyRows })
      }
      ensureSpace(45)
      const dailyMode = visibleWeeks.length <= 2
      const rows = view === 'merch' ? data.merch : data.daily
      if (dailyMode) {
        const dates = [...new Set(rows.filter(row => row[3] === cc && visibleWeeks.includes(row[2])).map(row => row[0]))].sort()
        const body = dates.map(date => {
          if (view === 'merch') {
            const units = data.merch.filter(row => row[3] === cc && row[0] === date).reduce((sum,row) => sum + row[4],0)
            return [shortDate(date),integerFormatter.format(units)]
          }
          const sameDay = data.daily.filter(row => row[3] === cc && row[0] === date)
          const values = data.meta.groups.map(group => sameDay.reduce((sum,row) => sum + row[groupColumn[group]],0))
          return [shortDate(date),...values.map(integerFormatter.format),integerFormatter.format(values.reduce((sum,value) => sum + value,0))]
        })
        drawTable({ ...tableTheme, startY:sectionTitle('Comparativo diario',`${visibleWeeks.length || 1} semana(s) · detalle para acompañar la ejecución.`), head:[view === 'merch' ? ['Fecha','Unidades Merch'] : ['Fecha','Cake Pop','Galletas','Dona G&G','Total']], body })
      } else {
        const body = visibleWeeks.map(selectedWeek => {
          const units = view === 'merch'
            ? data.merch.filter(row => row[3] === cc && row[2] === selectedWeek).reduce((sum,row) => sum + row[4],0)
            : data.daily.filter(row => row[3] === cc && row[2] === selectedWeek).reduce((sum,row) => sum + row[groupColumn[selectedGroup]],0)
          const days = weekDayCounts.get(selectedWeek) ?? 1
          return [`Semana ${selectedWeek}`,decimalFormatter.format(units / days),integerFormatter.format(units)]
        })
        drawTable({ ...tableTheme, startY:sectionTitle('Tendencia semanal','Tres o más semanas · evolución compacta del periodo.'), head:[['Periodo','USD','Total impulso']], body })
      }
      if (store) {
        ensureSpace(24)
        const y = sectionTitle('Mensaje operativo','Un dato claro debe convertirse en una conversación concreta.')
        doc.setFillColor(...mint); doc.roundedRect(margin,y,pageWidth - margin * 2,14,2,2,'F')
        doc.setTextColor(...deep); doc.setFontSize(8); doc.text('Objetivo inmediato: mejora el USD vs la semana anterior. Objetivo sostenible: supera 50 unidades.',margin + 3,y + 8,{ maxWidth:pageWidth - margin * 2 - 6 })
      }
    } else if (dm === 'Todos') {
      const body = dmWeekScores.map((score,index) => [index + 1,score.dm,...visibleWeeks.map(value => formatMetric(metric,score.weekly[value] ?? 0)),formatMetric(metric,metricValue(metric,score.units,score.usd))])
      drawTable({ ...tableTheme, startY:sectionTitle('Resumen por DM','Participación y evolución del mismo alcance.'), head:[['#','DM',...visibleWeeks.map(value => `Sem ${value}`),'Total']], body, columnStyles:{ 0:{ cellWidth:9 }, 1:{ cellWidth:45 } } })
      ensureSpace(52)
      drawTable({ ...tableTheme, startY:sectionTitle('Top y foco','Reconoce el avance y acompaña las oportunidades.'), head:[['#','Tienda','DM','USD','Total impulso','Tendencia']], body:[
        ...ordered.slice(0,10).map((store,index) => [index + 1,store.store,store.dm,decimalFormatter.format(store.usd),integerFormatter.format(store.units),formatMetric(metric,storeTrends.get(store.cc)?.delta ?? 0)]),
      ], columnStyles:{ 0:{ cellWidth:9 }, 1:{ cellWidth:48 }, 2:{ cellWidth:48 } } })
    } else {
      drawTable({ ...tableTheme, startY:sectionTitle('Portafolio seleccionado','Sólo las tiendas del DM y periodo elegidos.'), head:[['#','Tienda','USD','Total impulso','Tendencia']], body:ordered.map((store,index) => [index + 1,store.store,decimalFormatter.format(store.usd),integerFormatter.format(store.units),formatMetric(metric,storeTrends.get(store.cc)?.delta ?? 0)]), columnStyles:{ 0:{ cellWidth:9 }, 1:{ cellWidth:70 } } })
    }
    const pages = doc.getNumberOfPages()
    for (let page = 1; page <= pages; page += 1) {
      doc.setPage(page)
      doc.setDrawColor(208,221,214); doc.line(margin,pageHeight - 12,pageWidth - margin,pageHeight - 12)
      doc.setTextColor(73,96,86); doc.setFont('helvetica','normal'); doc.setFontSize(6.5)
      doc.text('Diseñado por Jorge Alcantar Aguiar & Enrique César Flores',margin,pageHeight - 7)
      doc.setFont('helvetica','bold'); doc.setTextColor(...green); doc.text('JUNTÉMONOS MÁS · #GreenApronService',pageWidth / 2,pageHeight - 7,{ align:'center' })
      doc.setTextColor(73,96,86); doc.setFont('helvetica','normal'); doc.text(`Página ${page} de ${pages}`,pageWidth - margin,pageHeight - 7,{ align:'right' })
    }
    const safe = (value:string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9]+/g,'_').replace(/^_|_$/g,'')
    doc.save(`Esfuerzo_${safe(viewLabel)}_${safe(scopeLabel)}_${safe(weeksLabel)}.pdf`)
  }

  if (error) return <main className="load-screen"><div className="load-card error"><RefreshCw size={30} /><h1>No pudimos leer el motor</h1><p>{error}</p><button type="button" onClick={() => setRetryKey(value => value + 1)}>Intentar de nuevo</button></div></main>
  if (!data) return <main className="load-screen"><div className="load-card"><span className="loader" /><h1>Preparando la lectura operativa</h1><p>Cruzando CSV, CeCo y Directorio…</p></div></main>

  const lastPoint = dailyPoints.at(-1)
  const previousPoint = dailyPoints.at(-2)
  const change = lastPoint && previousPoint ? lastPoint.value - previousPoint.value : 0
  const bestDm = [...dmScores].sort((a,b) => metricValue(metric,b.units,b.usd) - metricValue(metric,a.units,a.usd))[0]
  const viewLabel = view === 'merch' ? 'Merch' : 'Operativo'
  const currentCutoff = view === 'merch' ? data.meta.latestMerchDate : data.meta.latestOperationalDate
  const compactStoreScope = dm !== 'Todos' || cc !== 'Todos'
  const viewCopy = view === 'merch'
    ? { eyebrow:'Impulso Merch', title:'Recomienda e impulsa.', description:'Seguimiento diario del impulso Merch.' }
    : { eyebrow:'Estrategia regional y distrital', title:'Impulsamos juntos.', description:'Cake Pop, galletas y Dona G&G: una lectura directa para reconocer avances y actuar.' }
  const variationText = comparison
    ? `${comparison.delta > 0 ? '+' : ''}${formatMetric(metric,comparison.delta)} ${metricLabel(metric)}`
    : 'Sin comparación'
  const briefHeadline = comparison?.status === 'open'
    ? `Semana ${comparison.currentWeek} en curso con ${comparison.daysLoaded}/7 días cargados. El ritmo todavía puede cambiar.`
    : `Semana ${comparison?.currentWeek ?? '—'} cerrada${comparison?.previousWeek ? ` vs semana ${comparison.previousWeek}` : ''}.`
  const improvement = comparison?.delta && comparison.delta > 0
    ? `${comparison.bestStore?.store ?? 'El alcance'} impulsa una mejora de ${variationText}.`
    : comparison?.bestStore?.store
      ? `${comparison.bestStore.store} muestra el mejor movimiento del corte.`
      : 'Reconoce la práctica que está sosteniendo el avance.'
  const reinforcement = view === 'operativo' && comparison?.focusFamily
    ? `${comparison.focusFamily.group}: acompaña el ritmo sin mezclar familias.`
    : comparison?.focusStore
      ? `${comparison.focusStore.store}: convierte el dato en una acción cercana.`
      : 'Prioriza una conversación simple y medible.'
  const guidance = comparison?.status === 'open'
    ? 'Da seguimiento diario al USD y protege un cierre superior a la semana anterior.'
    : comparison?.delta && comparison.delta > 0
      ? 'Comparte la práctica que funcionó y define cómo sostenerla en el siguiente corte.'
      : 'Acordar un foco, un responsable y una revisión breve en el siguiente corte.'

  return <div className="app-shell">
    <header className="topbar">
      <a className="brand" href="#operativo" onClick={() => changeView('operativo')}>
        <img src={`${import.meta.env.BASE_URL}assets/Esfuerzo_Operativo.webp`} alt="" width="54" height="54" />
        <span><strong>Esfuerzo Operativo</strong><small>Impulso · Acción · Resultado</small></span>
      </a>
      <nav aria-label="Secciones principales">
        <button type="button" className={view === 'operativo' ? 'active' : ''} onClick={() => changeView('operativo')}><TrendingUp size={17} />Operativo</button>
        <button type="button" className={view === 'merch' ? 'active' : ''} onClick={() => changeView('merch')}><ShoppingBag size={17} />Merch</button>
      </nav>
      <div className="update-badge"><span>{view === 'merch' ? 'Motor Merch' : 'Motor operativo'}</span><strong>{shortDate(currentCutoff)}</strong></div>
    </header>

    <main>
      <section className={`hero ${view === 'merch' ? 'merch' : ''}`}>
        <div className="hero-copy"><p className="eyebrow">Centro Norte · {viewCopy.eyebrow}</p><h1>{viewCopy.title}</h1><p>{viewCopy.description}</p>
          <div className="hero-actions"><a href="#tablero">Ver avance <ChevronRight size={17} /></a><span><CalendarDays size={16} /> Corte al {shortDate(currentCutoff)}</span></div>
        </div>
        <div className="hero-visual"><img src={`${import.meta.env.BASE_URL}assets/${view === 'merch' ? 'impulso_merch.webp' : 'Esfuerzo_Operativo.webp'}`} alt={view === 'merch' ? 'Guía visual Impulso Merch de la semana' : 'Identidad visual de Esfuerzo Operativo'} loading={view === 'merch' ? 'lazy' : 'eager'} decoding="async" /></div>
      </section>

      <div id="tablero" className="dashboard-anchor" />
      <Filters data={data} view={view} metric={metric} setMetric={setMetric} month={month} setMonth={setMonth} selectedWeeks={selectedWeeks} setSelectedWeeks={setSelectedWeeks} region={region} setRegion={setRegion} dm={dm} setDm={setDm} cc={cc} setCc={setCc} selectedGroup={selectedGroup} setSelectedGroup={setSelectedGroup} />

      <div className="executive-heading"><div><p className="eyebrow">Datos clave</p><h2>{viewLabel} al corte</h2></div><span>{region === 'Todas' ? 'Región completa' : region}{dm !== 'Todos' ? ` · ${dm}` : ''}</span></div>
      <section className="kpi-grid" aria-label="Resumen ejecutivo">
        <Card label="Total impulso" value={integerFormatter.format(totalUnits)} note={`${dayCount} ${dayCount === 1 ? 'día' : 'días'} · ${storeScores.length} tiendas`} icon={PackageOpen} />
        <Card label="USD" value={decimalFormatter.format(totalUsd)} note="Promedio diario por tienda" icon={CircleGauge} tone="gold" />
        <Card label="Cobertura" value={`${activeStores}/${storeScores.length}`} note={`${storeScores.length ? Math.round(activeStores / storeScores.length * 100) : 0}% con impulso`} icon={Building2} tone="cream" />
        <Card label={`Movimiento ${metricLabel(metric)}`} value={`${change > 0 ? '+' : ''}${formatMetric(metric,change)}`} note={change > 0 ? 'vs día anterior' : change < 0 ? 'oportunidad vs día anterior' : 'se mantiene'} icon={change >= 0 ? ArrowUpRight : ArrowDownRight} tone={change >= 0 ? 'green' : 'ink'} />
      </section>

      <CorporateBrief status={comparison?.status ?? 'closed'} week={comparison?.currentWeek ?? null} headline={briefHeadline} improvement={improvement} reinforcement={reinforcement} guidance={guidance} />

      {cc !== 'Todos' && selectedWeeks.size === 1 && <div className="week-guidance"><CalendarDays size={18} /><span><strong>¿Quieres evaluar tendencia?</strong> Selecciona una semana adicional para comparar; con tres o más verás la evolución semanal.</span></div>}

      <section className="two-column">
        <article className="panel trend-panel"><div className="panel-heading"><div><p className="eyebrow">Avance diario</p><h2>El ritmo al corte.</h2><p>Los últimos 14 días disponibles dentro de tu selección.</p></div><span className="status-chip">{lastPoint ? shortDate(lastPoint.date) : 'Sin corte'}</span></div><TrendChart points={dailyPoints} metric={metric} /></article>
        <article className="panel focus-panel"><div><p className="eyebrow">Impulso que inspira</p><h2>{bestDm ? `${bestDm.dm}, gracias por marcar el ritmo.` : 'Cada avance cuenta.'}</h2><p>{bestDm ? `El portafolio suma ${formatMetric(metric,metricValue(metric,bestDm.units,bestDm.usd))} ${metricLabel(metric)} en esta selección.` : 'Ajusta los filtros para reconocer el avance.'}</p></div><div className="focus-stat"><Sparkles size={22} /><span><strong>Avanzamos juntos</strong><small>El esfuerzo diario también inspira al equipo.</small></span></div><p className="focus-note">Celebra lo que funciona, comparte una práctica y construyan juntos el siguiente paso.</p></article>
      </section>

      <DmWeekTable scores={dmWeekScores} metric={metric} weeks={visibleWeeks} />

      <div className="ranking-toolbar"><div><p className="eyebrow">Tiendas</p><h2>{compactStoreScope ? 'Portafolio seleccionado' : 'Top y foco operativo'}</h2></div><button type="button" className="pdf-action" onClick={exportCorporatePdf}><FileDown size={17} />Generar PDF carta</button></div>
      {compactStoreScope
        ? <StoreTable scores={storeScores} metric={metric} trends={storeTrends} title="Portafolio seleccionado" message="Una lectura puntual para acompañar cada tienda." limit={storeScores.length} />
        : <div className="ranking-grid">
            <StoreTable scores={storeScores} metric={metric} trends={storeTrends} title="10 tiendas con mayor impulso" message="Reconoce el avance y comparte lo que está funcionando." limit={10} />
            <StoreTable scores={storeScores} metric={metric} trends={storeTrends} title="10 tiendas para acompañar" message="Una conversación cercana puede activar el siguiente avance." ascending limit={10} />
          </div>}
    </main>

    <footer><div><strong>Diseñado por Jorge Alcantar Aguiar & Enrique César Flores</strong><p>Herramienta interna para reconocer avances, enfocar conversaciones y seguir impulsando resultados juntos.</p><p className="footer-tags">#Orgullo CN 🚀 · #GreenApronService · JUNTÉMONOS MÁS</p></div><a href="https://wa.me/message/ENKDSAHYHIGAN1" target="_blank" rel="noreferrer"><MessageCircle size={17} />Mi CEL · Comentarios y sugerencias</a></footer>
  </div>
}
