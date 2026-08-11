import { useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  ArrowDownRight, ArrowUpRight, Building2, CalendarDays, Check,
  ChevronDown, ChevronRight, CircleGauge, Coffee, Cookie, Donut,
  FileDown, Info, Lightbulb, MessageCircle, PackageOpen, RefreshCw, Search, ShoppingBag,
  Sparkles, TrendingUp, Users,
} from 'lucide-react'
import { loadDashboard } from './data'
import type { DashboardData, DailyRow, DmScore, Metric, ProductGroup, StoreScore, View } from './types'
import inspiration from './juntemonos-visual.json'

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
  const visible = points.slice(-7)
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

interface RegionWeekScore { region:string; units:number; usd:number; weekly:Record<number,number> }

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
          <td><strong>{score.store}</strong><small className="store-meta">{score.storeType}{score.benchmark ? ` · ${score.benchmark}` : ''}</small></td>
          <td>{metric === 'usd' ? <div className="inline-meter"><span style={{ width:`${value / max * 100}%` }} /><strong>{decimalFormatter.format(score.usd)}</strong></div> : decimalFormatter.format(score.usd)}</td>
          <td>{metric === 'total' ? <div className="inline-meter"><span style={{ width:`${value / max * 100}%` }} /><strong>{integerFormatter.format(score.units)}</strong></div> : integerFormatter.format(score.units)}</td>
          <td><span className={`trend-pill ${direction}`}><TrendIcon size={14} />{trendText}</span></td>
        </tr>
      })}</tbody>
    </table></div>}
  </section>
}

function ScopeWeekTable({ scores, metric, weeks, level }: { scores:Array<DmWeekScore | RegionWeekScore>; metric:Metric; weeks:number[]; level:'DM'|'Región' }) {
  const sorted = [...scores].sort((a,b) => metricValue(metric,b.units,b.usd) - metricValue(metric,a.units,a.usd))
  return <section className="panel dm-panel">
    <div className="panel-heading"><div><p className="eyebrow">Benchmark ejecutivo</p><h2>Tendencia semanal por {level}</h2><p>Compara el mismo alcance y detecta rápidamente dónde replicar prácticas.</p></div><span className="status-chip">{sorted.length} {level === 'DM' ? 'distritos' : 'regiones'}</span></div>
    {!sorted.length ? <EmptyState>No hay información en el alcance seleccionado.</EmptyState> : <div className="table-scroll dm-week-table"><table>
      <thead><tr><th>#</th><th>{level}</th>{weeks.map(value => <th key={value}>Sem {value}</th>)}<th>Total</th></tr></thead>
      <tbody>{sorted.map((score,index) => { const name = 'dm' in score ? score.dm : score.region; return <tr key={name}>
        <td><span className={`rank-badge ${index === 0 ? '' : index >= sorted.length - 2 ? 'needs-focus' : ''}`}>{index + 1}</span></td>
        <td><strong>{name}</strong></td>
        {weeks.map(value => <td key={value}>{formatMetric(metric,score.weekly[value] ?? 0)}</td>)}
        <td><strong>{formatMetric(metric,metricValue(metric,score.units,score.usd))}</strong></td>
      </tr>})}</tbody>
    </table></div>}
  </section>
}

function InspirationPanel({ leader, total, metric, benchmark }: { leader:string; total:number; metric:Metric; benchmark?:string }) {
  return <article className="inspiration-card" aria-label="Mensaje Juntémonos Más">
    <div className="inspiration-mark"><Users size={24} /><span>{inspiration.eyebrow}</span></div>
    <p className="eyebrow">Impulso que inspira</p>
    <h2>{leader}, gracias por marcar el ritmo.</h2>
    <p>El portafolio suma <strong>{formatMetric(metric,total)} {metricLabel(metric)}</strong> en esta selección.</p>
    <div className="inspiration-message"><Sparkles size={20} /><div><strong>{inspiration.title}</strong><span>{inspiration.message}</span></div></div>
    {benchmark && <div className="benchmark-note"><Lightbulb size={17} /><span><strong>Lo que funciona:</strong> {benchmark}</span></div>}
    <small>{inspiration.closing} · {inspiration.badge}</small>
  </article>
}

function ObjectiveDisclosure() {
  return <details className="objective-disclosure">
    <summary><TargetIcon /><span><strong>Objetivo +50 unidades</strong><small>Activa la guía visual de esfuerzo operativo</small></span><ChevronDown size={18} /></summary>
    <div><img src={`${import.meta.env.BASE_URL}assets/objetivo_esfuerzo_operativo.webp`} alt="Esfuerzo operativo: Donas, Cake Pop's y Galletas suman 50 unidades; planear, ejecutar, revisar y ajustar." loading="lazy" decoding="async" /></div>
  </details>
}

function TargetIcon() { return <span className="objective-icon"><CircleGauge size={20} /></span> }

function Filters({
  data, view, metric, setMetric, month, setMonth, selectedWeeks, setSelectedWeeks,
  region, setRegion, dm, setDm, cc, setCc, selectedGroups, setSelectedGroups,
}:{
  data:DashboardData; view:View; metric:Metric; setMetric:(metric:Metric)=>void
  month:string; setMonth:(value:string)=>void; selectedWeeks:Set<number>; setSelectedWeeks:(value:Set<number>)=>void
  region:string; setRegion:(value:string)=>void; dm:string; setDm:(value:string)=>void; cc:string; setCc:(value:string)=>void
  selectedGroups:Set<ProductGroup>; setSelectedGroups:(groups:Set<ProductGroup>)=>void
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
      <p className="filter-context">{view === 'merch' ? 'Impulso Merch · motor independiente' : `${selectedGroups.size} de 3 familias · meta conjunta +50`}</p>
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
    {view !== 'merch' && <div className="product-filter"><div><span>Familias activas</span><small>Selección múltiple</small></div><div className="product-buttons">
      {data.meta.groups.map(group => { const Icon = groupIcon[group]; const active = selectedGroups.has(group); return <button type="button" key={group} className={active ? 'active' : ''} onClick={() => { const next = new Set(selectedGroups); if (active && next.size > 1) next.delete(group); else next.add(group); setSelectedGroups(next) }} aria-pressed={active}><Icon size={17} />{group}{active && <Check size={14} />}</button> })}
    </div><p><Info size={14} /> Recomendado: conserva las 3 para impulsar +50 unidades. Puedes comparar cualquier combinación; Dona G&amp;G no incluye Dona en Combo.</p></div>}
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
  const [selectedGroups,setSelectedGroups] = useState<Set<ProductGroup>>(() => new Set<ProductGroup>(["Cake Pop's",'Galletas','Dona G&G']))
  const selectedColumns = useMemo(() => [...selectedGroups].map(group => groupColumn[group]),[selectedGroups])

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
      for (const row of data.daily) if (scopeCc.has(row[3]) && periodMatches(row)) {
        const value = selectedColumns.reduce((sum,column) => sum + row[column],0)
        units.set(row[3],(units.get(row[3]) ?? 0) + value)
      }
    }
    return scopeStores.map(store => {
      const total = units.get(store.cc) ?? 0
      return { ...store, units:total, usd:dayCount ? total / dayCount : 0, active:total > 0 }
    })
  // periodMatches depends only on listed filters.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[data,view,scopeStores,scopeCc,month,selectedWeeks,selectedColumns,dayCount])

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
      data.daily.forEach(row => { if (scopeCc.has(row[3]) && periodMatches(row)) totals.set(row[0],(totals.get(row[0]) ?? 0) + selectedColumns.reduce((sum,column) => sum + row[column],0)) })
    }
    return [...totals].sort(([a],[b]) => a.localeCompare(b)).map(([date,value]) => ({ date, value:metric === 'usd' ? value / scopeStores.length : value }))
  // periodMatches depends only on listed filters.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[data,view,scopeStores.length,scopeCc,visibleDates,selectedColumns,metric,month,selectedWeeks])

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
      data.daily.forEach(row => {
        if (!scopeCc.has(row[3]) || !periodMatches(row)) return
        const store = totals.get(row[3]) ?? new Map<number,number>()
        store.set(row[2],(store.get(row[2]) ?? 0) + selectedColumns.reduce((sum,column) => sum + row[column],0))
        totals.set(row[3],store)
      })
    }
    return totals
  // periodMatches depends only on the listed filters.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[data,view,scopeStores,scopeCc,month,selectedWeeks,selectedColumns])

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

  const regionWeekScores = useMemo<RegionWeekScore[]>(() => {
    const names = [...new Set(storeScores.map(store => store.region))]
    return names.map(regionName => {
      const stores = storeScores.filter(store => store.region === regionName)
      const weekly:Record<number,number> = {}
      visibleWeeks.forEach(selectedWeek => {
        const units = stores.reduce((sum,store) => sum + (weeklyStoreTotals.get(store.cc)?.get(selectedWeek) ?? 0),0)
        weekly[selectedWeek] = metric === 'usd' ? units / Math.max(1,weekDayCounts.get(selectedWeek) ?? 1) / Math.max(1,stores.length) : units
      })
      const units = stores.reduce((sum,store) => sum + store.units,0)
      return { region:regionName, units, usd:dayCount && stores.length ? units / dayCount / stores.length : 0, weekly }
    })
  },[storeScores,visibleWeeks,weeklyStoreTotals,metric,weekDayCounts,dayCount])

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
  const leaderName = cc !== 'Todos' ? scopeStores[0]?.dm : bestDm?.dm
  const leadingStore = [...storeScores].sort((a,b) => metricValue(metric,b.units,b.usd) - metricValue(metric,a.units,a.usd))[0]
  const scopeRegionLabel = region === 'Todas' ? 'Todas las regiones' : region

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
        <div className="hero-copy"><p className="eyebrow">{scopeRegionLabel} · {viewCopy.eyebrow}</p><h1>{viewCopy.title}</h1><p>{viewCopy.description}</p>
          <div className="hero-actions"><a href="#tablero">Ver avance <ChevronRight size={17} /></a><span><CalendarDays size={16} /> Corte al {shortDate(currentCutoff)}</span></div>
        </div>
        <div className="hero-visual"><img src={`${import.meta.env.BASE_URL}assets/${view === 'merch' ? 'impulso_merch.webp' : 'Esfuerzo_Operativo.webp'}`} alt={view === 'merch' ? 'Guía visual Impulso Merch de la semana' : 'Identidad visual de Esfuerzo Operativo'} loading={view === 'merch' ? 'lazy' : 'eager'} decoding="async" /></div>
      </section>

      <div id="tablero" className="dashboard-anchor" />
      <Filters data={data} view={view} metric={metric} setMetric={setMetric} month={month} setMonth={setMonth} selectedWeeks={selectedWeeks} setSelectedWeeks={setSelectedWeeks} region={region} setRegion={setRegion} dm={dm} setDm={setDm} cc={cc} setCc={setCc} selectedGroups={selectedGroups} setSelectedGroups={setSelectedGroups} />

      <div className="executive-heading"><div><p className="eyebrow">Datos clave</p><h2>{viewLabel} al corte</h2></div><span>{region === 'Todas' ? 'Región completa' : region}{dm !== 'Todos' ? ` · ${dm}` : ''}</span></div>
      <section className="kpi-grid" aria-label="Resumen ejecutivo">
        <Card label="Total impulso" value={integerFormatter.format(totalUnits)} note={`${dayCount} ${dayCount === 1 ? 'día' : 'días'} · ${storeScores.length} tiendas`} icon={PackageOpen} />
        <Card label="USD" value={decimalFormatter.format(totalUsd)} note="Promedio diario por tienda" icon={CircleGauge} tone="gold" />
        <Card label="Cobertura" value={`${activeStores}/${storeScores.length}`} note={`${storeScores.length ? Math.round(activeStores / storeScores.length * 100) : 0}% con impulso`} icon={Building2} tone="cream" />
        <Card label={`Movimiento ${metricLabel(metric)}`} value={`${change > 0 ? '+' : ''}${formatMetric(metric,change)}`} note={change > 0 ? 'vs día anterior' : change < 0 ? 'oportunidad vs día anterior' : 'se mantiene'} icon={change >= 0 ? ArrowUpRight : ArrowDownRight} tone={change >= 0 ? 'green' : 'ink'} />
      </section>

      <ObjectiveDisclosure />

      {cc !== 'Todos' && selectedWeeks.size === 1 && <div className="week-guidance"><CalendarDays size={18} /><span><strong>¿Quieres evaluar tendencia?</strong> Selecciona una semana adicional para comparar; con tres o más verás la evolución semanal.</span></div>}

      <section className="two-column">
        <article className="panel trend-panel"><div className="panel-heading"><div><p className="eyebrow">Avance diario</p><h2>El ritmo al corte.</h2><p>Los últimos 7 días disponibles dentro de tu selección.</p></div><span className="status-chip">{lastPoint ? shortDate(lastPoint.date) : 'Sin corte'}</span></div><TrendChart points={dailyPoints} metric={metric} /></article>
        <InspirationPanel leader={leaderName ?? 'Equipo'} total={bestDm ? metricValue(metric,bestDm.units,bestDm.usd) : metric === 'usd' ? totalUsd : totalUnits} metric={metric} benchmark={leadingStore?.benchmark} />
      </section>

      <ScopeWeekTable scores={region === 'Todas' && dm === 'Todos' ? regionWeekScores : dmWeekScores} metric={metric} weeks={visibleWeeks} level={region === 'Todas' && dm === 'Todos' ? 'Región' : 'DM'} />

      <div className="ranking-toolbar"><div><p className="eyebrow">Tiendas</p><h2>{compactStoreScope ? 'Portafolio seleccionado' : 'Top y foco operativo'}</h2></div><button type="button" className="pdf-action" onClick={async () => { const { createExecutivePdf } = await import('./pdf'); createExecutivePdf({ data,view,metric,month,weeks:selectedWeeks,region,dm,cc,groups:selectedGroups,stores:scopeStores }) }}><FileDown size={17} />Generar PDF carta · 1 hoja</button></div>
      {compactStoreScope
        ? <StoreTable scores={storeScores} metric={metric} trends={storeTrends} title="Portafolio seleccionado" message="Una lectura puntual para acompañar cada tienda." limit={storeScores.length} />
        : <div className="ranking-grid">
            <StoreTable scores={storeScores} metric={metric} trends={storeTrends} title="10 tiendas con mayor impulso" message="Reconoce el avance y comparte lo que está funcionando." limit={10} />
            <StoreTable scores={storeScores} metric={metric} trends={storeTrends} title="10 tiendas para acompañar" message="Una conversación cercana puede activar el siguiente avance." ascending limit={10} />
          </div>}
    </main>

    <footer><div><strong>Diseñado por Jorge Alcantar Aguiar & Enrique César Flores</strong><p>Herramienta interna para reconocer avances, enfocar conversaciones y seguir impulsando resultados juntos.</p><p className="footer-tags">#Orgullo CN 🚀 · #GreenApronService · JUNTÉMONOS MÁS</p></div><a href="https://wa.me/message/ENKDSAHYHIGAN1" target="_blank" rel="noreferrer"><MessageCircle size={17} />Comentarios y sugerencias</a></footer>
  </div>
}
