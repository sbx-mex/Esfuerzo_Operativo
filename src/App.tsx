import { useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  ArrowDownRight, ArrowUpRight, BarChart3, Building2, CalendarDays, Check,
  ChevronRight, CircleGauge, Coffee, Cookie, Donut, Info, PackageOpen,
  RefreshCw, Search, ShoppingBag, Sparkles, Store, TrendingUp, UsersRound,
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
  return metric === 'usd' ? 'USD' : 'Total impulso'
}

function formatMetric(metric: Metric, value: number) {
  return metric === 'usd' ? decimalFormatter.format(value) : integerFormatter.format(value)
}

function parseView() : View {
  const hash = window.location.hash.replace('#','')
  return hash === 'dm' || hash === 'merch' ? hash : 'operativo'
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

function StoreTable({ scores, metric, title, description, ascending = false }: { scores:StoreScore[]; metric:Metric; title:string; description:string; ascending?:boolean }) {
  const sorted = [...scores].sort((a,b) => {
    const difference = metricValue(metric, a.units, a.usd) - metricValue(metric, b.units, b.usd)
    return (ascending ? difference : -difference) || a.store.localeCompare(b.store, 'es')
  }).slice(0,15)
  const max = Math.max(1, ...sorted.map(score => metricValue(metric, score.units, score.usd)))
  return <section className="panel ranking-panel">
    <div className="panel-heading"><div><p className="eyebrow">{ascending ? 'Foco operativo' : 'Lectura ejecutiva'}</p><h2>{title}</h2><p>{description}</p></div><span className={`status-chip ${ascending ? 'warning' : ''}`}>{sorted.length} tiendas</span></div>
    {!sorted.length ? <EmptyState>No existen tiendas en el alcance seleccionado.</EmptyState> : <div className="table-scroll"><table>
      <thead><tr><th>#</th><th>Tienda</th><th>CeCo</th><th>DM</th><th>Total</th><th>USD</th><th>{metricLabel(metric)}</th></tr></thead>
      <tbody>{sorted.map((score,index) => {
        const value = metricValue(metric, score.units, score.usd)
        return <tr key={score.cc}>
          <td><span className={`rank-badge ${ascending && index < 3 ? 'needs-focus' : ''}`}>{index + 1}</span></td>
          <td><strong>{score.store}</strong></td><td>{score.cc}</td><td>{score.dm}</td>
          <td>{integerFormatter.format(score.units)}</td><td>{decimalFormatter.format(score.usd)}</td>
          <td><div className="inline-meter"><span style={{ width:`${value / max * 100}%` }} /><strong>{formatMetric(metric,value)}</strong></div></td>
        </tr>
      })}</tbody>
    </table></div>}
  </section>
}

function DmTable({ scores, metric }: { scores:DmScore[]; metric:Metric }) {
  const sorted = [...scores].sort((a,b) => metricValue(metric,b.units,b.usd) - metricValue(metric,a.units,a.usd))
  const max = Math.max(1, ...sorted.map(score => metricValue(metric, score.units, score.usd)))
  return <section className="panel dm-panel">
    <div className="panel-heading"><div><p className="eyebrow">Resumen DM</p><h2>Una lectura, seis conversaciones.</h2><p>Comparación justa con el mismo periodo, productos y métrica.</p></div><span className="status-chip">{sorted.length} distritos</span></div>
    {!sorted.length ? <EmptyState>No hay distritos en el alcance seleccionado.</EmptyState> : <div className="dm-list">
      {sorted.map((score,index) => {
        const value = metricValue(metric,score.units,score.usd)
        return <article className={`dm-row ${index < 2 ? 'is-leading' : index >= sorted.length - 2 ? 'is-focus' : ''}`} key={score.dm}>
          <span className="dm-position">{index + 1}</span>
          <div className="dm-name"><strong>{score.dm}</strong><small>{score.activeStores}/{score.stores} tiendas con impulso</small></div>
          <div className="dm-progress"><span style={{ width:`${value / max * 100}%` }} /></div>
          <div className="dm-value"><strong>{formatMetric(metric,value)}</strong><small>{metricLabel(metric)}</small></div>
          <div className="dm-units"><strong>{integerFormatter.format(score.units)}</strong><small>unidades</small></div>
        </article>
      })}
    </div>}
  </section>
}

function Filters({
  data, view, metric, setMetric, month, setMonth, week, setWeek, startDate, setStartDate, endDate, setEndDate,
  region, setRegion, dm, setDm, cc, setCc, selectedGroups, toggleGroup,
}:{
  data:DashboardData; view:View; metric:Metric; setMetric:(metric:Metric)=>void
  month:string; setMonth:(value:string)=>void; week:string; setWeek:(value:string)=>void
  startDate:string; setStartDate:(value:string)=>void; endDate:string; setEndDate:(value:string)=>void
  region:string; setRegion:(value:string)=>void; dm:string; setDm:(value:string)=>void; cc:string; setCc:(value:string)=>void
  selectedGroups:Set<ProductGroup>; toggleGroup:(group:ProductGroup)=>void
}) {
  const regions = useMemo(() => [...new Set(data.directory.map(item => item.region))].sort(), [data])
  const dms = useMemo(() => [...new Set(data.directory.filter(item => region === 'Todas' || item.region === region).map(item => item.dm))].sort(), [data,region])
  const stores = useMemo(() => data.directory.filter(item => (region === 'Todas' || item.region === region) && (dm === 'Todos' || item.dm === dm)), [data,region,dm])
  return <section className="filters" aria-label="Filtros del tablero">
    <div className="filter-topline">
      <div><p className="eyebrow">Alcance dinámico</p><h2>Consulta lo que necesitas.</h2></div>
      <div className="metric-toggle" aria-label="Métrica principal">
        <button type="button" className={metric === 'usd' ? 'active' : ''} onClick={() => setMetric('usd')} aria-pressed={metric === 'usd'}>USD</button>
        <button type="button" className={metric === 'total' ? 'active' : ''} onClick={() => setMetric('total')} aria-pressed={metric === 'total'}>Total impulso</button>
      </div>
    </div>
    <div className="filter-grid">
      <label>Mes<select value={month} onChange={event => setMonth(event.target.value)}><option>Todos</option>{data.meta.months.map(value => <option key={value}>{value}</option>)}</select></label>
      <label>Semana<select value={week} onChange={event => setWeek(event.target.value)}><option>Todas</option>{data.meta.weeks.map(value => <option key={value}>{value}</option>)}</select></label>
      <label>Desde<input type="date" min={data.meta.minDate} max={data.meta.latestDate} value={startDate} onChange={event => setStartDate(event.target.value)} /></label>
      <label>Hasta<input type="date" min={data.meta.minDate} max={data.meta.latestDate} value={endDate} onChange={event => setEndDate(event.target.value)} /></label>
      <label>Región<select value={region} onChange={event => { setRegion(event.target.value); setDm('Todos'); setCc('Todos') }}><option>Todas</option>{regions.map(value => <option key={value}>{value}</option>)}</select></label>
      <label>DM<select value={dm} onChange={event => { setDm(event.target.value); setCc('Todos') }}><option>Todos</option>{dms.map(value => <option key={value}>{value}</option>)}</select></label>
      <label className="store-filter">Tienda<select value={cc} onChange={event => setCc(event.target.value)}><option value="Todos">Todas las tiendas</option>{stores.map(item => <option key={item.cc} value={item.cc}>{item.store} · {item.cc}</option>)}</select></label>
    </div>
    {view !== 'merch' && <div className="product-filter"><div><span>Productos</span><small>Selección múltiple</small></div><div className="product-buttons">
      {data.meta.groups.map(group => { const Icon = groupIcon[group]; const active = selectedGroups.has(group); return <button type="button" key={group} className={active ? 'active' : ''} onClick={() => toggleGroup(group)} aria-pressed={active}><Icon size={17} />{group}{active && <Check size={14} />}</button> })}
    </div><p><Info size={14} /> Dona G&amp;G no incluye Dona en Combo.</p></div>}
    <div className="metric-definition"><CircleGauge size={16} /><span><strong>USD</strong> = unidades seleccionadas ÷ días del rango ÷ tiendas visibles.</span></div>
  </section>
}

export function App() {
  const [data,setData] = useState<DashboardData | null>(null)
  const [error,setError] = useState('')
  const [retryKey,setRetryKey] = useState(0)
  const [view,setView] = useState<View>(parseView)
  const [metric,setMetric] = useState<Metric>('usd')
  const [month,setMonth] = useState('Todos')
  const [week,setWeek] = useState('Todas')
  const [startDate,setStartDate] = useState('')
  const [endDate,setEndDate] = useState('')
  const [region,setRegion] = useState('Todas')
  const [dm,setDm] = useState('Todos')
  const [cc,setCc] = useState('Todos')
  const [selectedGroups,setSelectedGroups] = useState<Set<ProductGroup>>(new Set(["Cake Pop's",'Galletas','Dona G&G']))

  useEffect(() => {
    const controller = new AbortController()
    setError('')
    loadDashboard(controller.signal).then(payload => {
      setData(payload)
      setStartDate(current => current || payload.meta.minDate)
      setEndDate(current => current || payload.meta.latestDate)
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

  function toggleGroup(group: ProductGroup) {
    setSelectedGroups(current => {
      const next = new Set(current)
      if (next.has(group) && next.size > 1) next.delete(group)
      else next.add(group)
      return next
    })
  }

  const scopeStores = useMemo(() => data?.directory.filter(item =>
    (region === 'Todas' || item.region === region)
    && (dm === 'Todos' || item.dm === dm)
    && (cc === 'Todos' || item.cc === cc)
  ) ?? [],[data,region,dm,cc])
  const scopeCc = useMemo(() => new Set(scopeStores.map(item => item.cc)),[scopeStores])

  const periodMatches = (row: DailyRow | DashboardData['merch'][number]) =>
    (month === 'Todos' || row[1] === month)
    && (week === 'Todas' || row[2] === Number(week))
    && (!startDate || row[0] >= startDate)
    && (!endDate || row[0] <= endDate)

  const sourceRows = useMemo(() => {
    if (!data) return []
    return view === 'merch' ? data.merch.filter(periodMatches) : data.daily.filter(periodMatches)
  // periodMatches depends only on the listed primitives.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[data,view,month,week,startDate,endDate])

  const visibleDates = useMemo(() => [...new Set(sourceRows.map(row => row[0]))].sort(),[sourceRows])
  const dayCount = visibleDates.length

  const storeScores = useMemo<StoreScore[]>(() => {
    if (!data) return []
    const units = new Map(scopeStores.map(store => [store.cc,0]))
    if (view === 'merch') {
      for (const row of data.merch) if (scopeCc.has(row[3]) && periodMatches(row)) units.set(row[3],(units.get(row[3]) ?? 0) + row[4])
    } else {
      const selectedColumns = [...selectedGroups].map(group => groupColumn[group])
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
  },[data,view,scopeStores,scopeCc,month,week,startDate,endDate,selectedGroups,dayCount])

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
      const selectedColumns = [...selectedGroups].map(group => groupColumn[group])
      data.daily.forEach(row => { if (scopeCc.has(row[3]) && periodMatches(row)) totals.set(row[0],(totals.get(row[0]) ?? 0) + selectedColumns.reduce((sum,column) => sum + row[column],0)) })
    }
    return [...totals].sort(([a],[b]) => a.localeCompare(b)).map(([date,value]) => ({ date, value:metric === 'usd' ? value / scopeStores.length : value }))
  // periodMatches depends only on listed filters.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[data,view,scopeStores.length,scopeCc,visibleDates,selectedGroups,metric,month,week,startDate,endDate])

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

  if (error) return <main className="load-screen"><div className="load-card error"><RefreshCw size={30} /><h1>No pudimos leer el motor</h1><p>{error}</p><button type="button" onClick={() => setRetryKey(value => value + 1)}>Intentar de nuevo</button></div></main>
  if (!data) return <main className="load-screen"><div className="load-card"><span className="loader" /><h1>Preparando la lectura operativa</h1><p>Cruzando CSV, CeCo y Directorio…</p></div></main>

  const currentMetric = metricValue(metric,totalUnits,totalUsd)
  const lastPoint = dailyPoints.at(-1)
  const previousPoint = dailyPoints.at(-2)
  const change = lastPoint && previousPoint ? lastPoint.value - previousPoint.value : 0
  const bestDm = [...dmScores].sort((a,b) => metricValue(metric,b.units,b.usd) - metricValue(metric,a.units,a.usd))[0]
  const viewLabel = view === 'merch' ? 'Impulso Merch' : view === 'dm' ? 'Resumen DM' : 'Impulso Operativo'

  return <div className="app-shell">
    <header className="topbar">
      <a className="brand" href="#operativo" onClick={() => changeView('operativo')}>
        <img src={`${import.meta.env.BASE_URL}assets/Esfuerzo_Operativo.png`} alt="" width="54" height="54" />
        <span><strong>Esfuerzo Operativo</strong><small>Impulso · Acción · Resultado</small></span>
      </a>
      <nav aria-label="Secciones principales">
        <button type="button" className={view === 'operativo' ? 'active' : ''} onClick={() => changeView('operativo')}><TrendingUp size={17} />Operativo</button>
        <button type="button" className={view === 'dm' ? 'active' : ''} onClick={() => changeView('dm')}><UsersRound size={17} />Resumen DM</button>
        <button type="button" className={view === 'merch' ? 'active' : ''} onClick={() => changeView('merch')}><ShoppingBag size={17} />Merch</button>
      </nav>
      <div className="update-badge"><span>Actualizado</span><strong>{shortDate(data.meta.latestDate)}</strong></div>
    </header>

    <main>
      <section className={`hero ${view === 'merch' ? 'merch' : ''}`}>
        <div className="hero-copy"><p className="eyebrow">Centro Norte · {viewLabel}</p><h1>{view === 'merch' ? 'Cada recomendación cuenta.' : view === 'dm' ? 'Claridad para acompañar.' : 'Impulsamos juntos.'}</h1><p>{view === 'merch' ? 'Sigue el avance diario de Merch y convierte el dato en una conversación operativa.' : view === 'dm' ? 'Una vista simple para reconocer avances, enfocar prioridades y activar el siguiente paso.' : 'Tres familias de producto, una lectura diaria y decisiones más cercanas a la operación.'}</p>
          <div className="hero-actions"><a href="#tablero">Ver avance <ChevronRight size={17} /></a><span><CalendarDays size={16} /> Corte al {shortDate(data.meta.latestDate)}</span></div>
        </div>
        <div className="hero-visual"><img src={`${import.meta.env.BASE_URL}assets/${view === 'merch' ? 'impulso_merch.png' : 'Esfuerzo_Operativo.png'}`} alt={view === 'merch' ? 'Guía visual Impulso Merch de la semana' : 'Identidad visual de Esfuerzo Operativo'} loading={view === 'merch' ? 'lazy' : 'eager'} decoding="async" /></div>
      </section>

      <div id="tablero" className="dashboard-anchor" />
      <Filters data={data} view={view} metric={metric} setMetric={setMetric} month={month} setMonth={setMonth} week={week} setWeek={setWeek} startDate={startDate} setStartDate={setStartDate} endDate={endDate} setEndDate={setEndDate} region={region} setRegion={setRegion} dm={dm} setDm={setDm} cc={cc} setCc={setCc} selectedGroups={selectedGroups} toggleGroup={toggleGroup} />

      <div className="executive-heading"><div><p className="eyebrow">Vista ejecutiva</p><h2>{viewLabel} al corte</h2></div><span>{region === 'Todas' ? 'Todas las regiones' : region}{dm !== 'Todos' ? ` · ${dm}` : ''}</span></div>
      <section className="kpi-grid" aria-label="Resumen ejecutivo">
        <Card label={metricLabel(metric)} value={formatMetric(metric,currentMetric)} note={`${dayCount} ${dayCount === 1 ? 'día' : 'días'} · ${storeScores.length} tiendas`} icon={metric === 'usd' ? CircleGauge : PackageOpen} />
        <Card label="Unidades acumuladas" value={integerFormatter.format(totalUnits)} note={view === 'merch' ? 'Impulso Merch' : `${selectedGroups.size} familias seleccionadas`} icon={BarChart3} tone="gold" />
        <Card label="Tiendas con impulso" value={`${activeStores}/${storeScores.length}`} note={`${storeScores.length ? Math.round(activeStores / storeScores.length * 100) : 0}% de cobertura`} icon={Building2} tone="cream" />
        <Card label="Movimiento diario" value={`${change > 0 ? '+' : ''}${formatMetric(metric,change)}`} note={change > 0 ? 'vs día anterior' : change < 0 ? 'oportunidad vs día anterior' : 'se mantiene'} icon={change >= 0 ? ArrowUpRight : ArrowDownRight} tone={change >= 0 ? 'green' : 'ink'} />
      </section>

      <section className="two-column">
        <article className="panel trend-panel"><div className="panel-heading"><div><p className="eyebrow">Avance diario</p><h2>El ritmo al corte.</h2><p>Los últimos 14 días disponibles dentro de tu selección.</p></div><span className="status-chip">{lastPoint ? shortDate(lastPoint.date) : 'Sin corte'}</span></div><TrendChart points={dailyPoints} metric={metric} /></article>
        <article className="panel focus-panel"><div><p className="eyebrow">Siguiente conversación</p><h2>{bestDm?.dm ?? 'Sin selección'}</h2><p>{bestDm ? `Lidera el alcance con ${formatMetric(metric,metricValue(metric,bestDm.units,bestDm.usd))} ${metricLabel(metric)}.` : 'Ajusta los filtros para encontrar el foco.'}</p></div><div className="focus-stat"><Sparkles size={22} /><span><strong>{bestDm ? `${bestDm.activeStores}/${bestDm.stores}` : '—'}</strong><small>tiendas con impulso</small></span></div><p className="focus-note">Reconoce el avance, valida la ejecución y acuerda una acción simple para el siguiente corte.</p></article>
      </section>

      {view === 'dm' ? <DmTable scores={dmScores} metric={metric} /> : <StoreTable scores={storeScores} metric={metric} title={view === 'merch' ? 'Tiendas que están impulsando Merch' : 'Ranking de impulso'} description="Ordenado con los filtros y la métrica activa." />}
      {view !== 'dm' && <StoreTable scores={storeScores} metric={metric} title="15 tiendas para acompañar" description="Menor impulso dentro del mismo periodo y alcance. Incluye tiendas en cero." ascending />}

      {view === 'merch' && <section className="merch-guide panel"><img src={`${import.meta.env.BASE_URL}assets/impulso_merch.png`} alt="Impulso Merch de la semana: conecta, impulsa, comparte, recomienda y facilita" loading="lazy" decoding="async" /><div><p className="eyebrow">Apoyo a la operación</p><h2>Conecta, recomienda e impulsa.</h2><p>Usa la lectura como punto de partida: valida disponibilidad, visibilidad y conversación con el equipo.</p><ul><li>Comparte Best Practices.</li><li>Mantén el producto visible sin saturar el POS.</li><li>Facilita llaves de mobiliario y reabastecimiento.</li></ul></div></section>}
    </main>

    <footer><div><strong>Esfuerzo Operativo</strong><p>Herramienta interna para facilitar lectura, conversación y mejora continua.</p></div><p>JUNTÉMONOS MÁS · #GreenApronService</p><span>Motor validado · {data.directory.length} CeCo</span></footer>
  </div>
}
