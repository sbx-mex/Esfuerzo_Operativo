import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { DashboardData, DirectoryStore, Metric, ProductGroup, View } from './types'

const columns:Record<ProductGroup,4|5|6> = { "Cake Pop's":4, Galletas:5, 'Dona G&G':6 }
const number = new Intl.NumberFormat('es-MX',{ maximumFractionDigits:1 })
const whole = new Intl.NumberFormat('es-MX',{ maximumFractionDigits:0 })

interface PdfInput {
  data:DashboardData; view:View; metric:Metric; month:string; weeks:Set<number>
  region:string; dm:string; cc:string; groups:Set<ProductGroup>; stores:DirectoryStore[]
}

export function createExecutivePdf(input:PdfInput) {
  const { data,view,metric,month,weeks,region,dm,cc,groups,stores } = input
  const operational = view === 'operativo'
  const rows = operational ? data.daily : data.merch
  const matches = (row:DashboardData['daily'][number] | DashboardData['merch'][number]) =>
    (month === 'Todos' || row[1] === month) && (!weeks.size || weeks.has(row[2]))
  const storeSet = new Set(stores.map(store => store.cc))
  const dates = [...new Set(rows.filter(row => matches(row) && storeSet.has(row[3])).map(row => row[0]))].sort()
  const visibleWeeks = [...new Set(rows.filter(row => matches(row) && storeSet.has(row[3])).map(row => row[2]))].sort((a,b) => a-b)
  const selectedColumns = [...groups].map(group => columns[group])
  const unitsFor = (row:DashboardData['daily'][number] | DashboardData['merch'][number], family?:ProductGroup) =>
    operational
      ? family ? Number(row[columns[family]]) : selectedColumns.reduce((sum,column) => sum + Number(row[column]),0)
      : Number(row[4])
  const totals = new Map<string,number>(stores.map(store => [store.cc,0]))
  rows.forEach(row => { if (matches(row) && storeSet.has(row[3])) totals.set(row[3],(totals.get(row[3]) ?? 0) + unitsFor(row)) })
  const score = (store:DirectoryStore) => {
    const units = totals.get(store.cc) ?? 0
    return { ...store, units, usd:dates.length ? units / dates.length : 0 }
  }
  const scores = stores.map(score)
  const value = (item:{units:number;usd:number}) => metric === 'usd' ? item.usd : item.units
  const fmt = (amount:number) => metric === 'usd' ? number.format(amount) : whole.format(amount)
  const totalUnits = scores.reduce((sum,item) => sum + item.units,0)
  const totalUsd = dates.length && stores.length ? totalUnits / dates.length / stores.length : 0
  const doc = new jsPDF({ orientation:'landscape', unit:'mm', format:'letter', compress:true })
  const width = doc.internal.pageSize.getWidth(), height = doc.internal.pageSize.getHeight(), margin = 10
  const deep:[number,number,number]=[0,76,52], green:[number,number,number]=[0,98,65], cream:[number,number,number]=[248,245,237]
  const scope = cc !== 'Todos' ? scores[0]?.store ?? cc : dm !== 'Todos' ? `DM · ${dm}` : region !== 'Todas' ? `Región · ${region}` : 'Nacional · todas las regiones'
  const period = visibleWeeks.length ? visibleWeeks.map(week => `S${week}`).join(', ') : 'Sin semanas'
  doc.setFillColor(...deep); doc.rect(0,0,width,31,'F')
  doc.setTextColor(255,255,255); doc.setFont('helvetica','bold'); doc.setFontSize(17); doc.text(operational ? 'Esfuerzo Operativo' : 'Impulso Merch',margin,12)
  doc.setFont('helvetica','normal'); doc.setFontSize(7.5); doc.text(`${scope} · ${period} · corte ${dates.at(-1) ?? '—'}`,margin,19)
  doc.text('Consulta ejecutiva para reconocer, comparar y actuar',margin,24)
  const kpis = [[metric === 'usd' ? number.format(totalUsd) : whole.format(totalUnits),metric === 'usd' ? 'USD' : 'UNIDADES'],[`${stores.filter(item => (totals.get(item.cc) ?? 0)>0).length}/${stores.length}`,'COBERTURA'],[String(dates.length),'DÍAS']]
  kpis.forEach(([amount,label],index) => { const x=width-92+index*27; doc.setFillColor(255,255,255); doc.roundedRect(x,7,24,17,2,2,'F'); doc.setTextColor(...green); doc.setFont('helvetica','bold'); doc.setFontSize(10); doc.text(amount,x+12,14,{align:'center'}); doc.setFontSize(5.5); doc.text(label,x+12,19,{align:'center'}) })
  let y=36
  const section=(title:string,note:string) => { doc.setTextColor(...deep); doc.setFont('helvetica','bold'); doc.setFontSize(9); doc.text(title,margin,y); doc.setTextColor(91,108,100); doc.setFont('helvetica','normal'); doc.setFontSize(6.2); doc.text(note,margin,y+3.5); y+=6 }
  const table=(head:string[][],body:(string|number)[][],options:Record<string,unknown>={}) => { autoTable(doc,{ startY:y, head, body, margin:{left:margin,right:margin,bottom:15}, styles:{fontSize:6,cellPadding:1.15,textColor:[30,58,49],lineColor:[224,231,227],lineWidth:.12,overflow:'ellipsize'},headStyles:{fillColor:deep,textColor:[255,255,255],fontStyle:'bold',halign:'center'},alternateRowStyles:{fillColor:[248,250,248]},pageBreak:'avoid',rowPageBreak:'avoid',...options }); y=(doc as jsPDF & {lastAutoTable?:{finalY:number}}).lastAutoTable?.finalY ?? y }
  const weeklyValue=(subset:typeof scores,week:number,family?:ProductGroup) => {
    const ccs=new Set(subset.map(item=>item.cc)); const weekRows=rows.filter(row=>matches(row)&&row[2]===week&&ccs.has(row[3])); const units=weekRows.reduce((sum,row)=>sum+unitsFor(row,family),0); const days=new Set(weekRows.map(row=>row[0])).size
    return metric==='usd' ? units/Math.max(1,days)/Math.max(1,subset.length) : units
  }
  const rankingRows=(items:typeof scores) => [...items].sort((a,b)=>value(b)-value(a))

  if (cc !== 'Todos') {
    section('Despliegue diario','Una sola tienda · lectura por día y familia.')
    const body=dates.slice(-14).map(date => { const same=rows.filter(row=>row[3]===cc&&row[0]===date&&matches(row)); return operational ? [date,...data.meta.groups.map(group=>whole.format(same.reduce((sum,row)=>sum+unitsFor(row,group),0))),whole.format(same.reduce((sum,row)=>sum+unitsFor(row),0))] : [date,whole.format(same.reduce((sum,row)=>sum+unitsFor(row),0))] })
    table([operational?['Fecha',"Cake Pop's",'Galletas','Dona G&G','Total']:['Fecha','Unidades Merch']],body)
    const selected=scores[0]; if(selected?.benchmark){ y+=4; doc.setFillColor(...cream); doc.roundedRect(margin,y,width-margin*2,12,2,2,'F'); doc.setTextColor(...deep); doc.setFont('helvetica','bold'); doc.setFontSize(7); doc.text('LO QUE FUNCIONA',margin+4,y+5); doc.setFont('helvetica','normal'); doc.text(selected.benchmark,margin+38,y+5,{maxWidth:width-margin*2-42}) }
  } else if (dm !== 'Todos') {
    section('Tendencia semanal por tienda','Todo el portafolio del DM; tres familias separadas para decidir con claridad.')
    table([['Tienda',...visibleWeeks.slice(-6).map(week=>`S${week}`),'Total']],rankingRows(scores).slice(0,16).map(item=>[item.store,...visibleWeeks.slice(-6).map(week=>fmt(weeklyValue([item],week))),fmt(value(item))]))
    if(operational){
      y+=4
      section('Portafolio por artículo','Top 5 de cada familia dentro del DM.')
      const ranked=data.meta.groups.map(group => rankingRows(scores.map(item => {
        const units=rows.filter(row=>row[3]===item.cc&&matches(row)).reduce((sum,row)=>sum+unitsFor(row,group),0)
        return {...item,units,usd:dates.length?units/dates.length:0}
      })).slice(0,5))
      table([["Cake Pop's",'Valor','Galletas','Valor','Dona G&G','Valor']],Array.from({length:5},(_,i)=>data.meta.groups.flatMap((_,g)=>[ranked[g][i]?.store??'—',ranked[g][i]?fmt(value(ranked[g][i])):'—'])))
    }
  } else {
    const national=region==='Todas'; const names=national?[...new Set(scores.map(item=>item.region))]:[...new Set(scores.map(item=>item.dm))]
    section(`Tendencia semanal por ${national?'región':'DM'}`,'Benchmark del mismo alcance; preparado para incorporar nuevas regiones y filas.')
    const grouped=names.map(name=>({name,items:scores.filter(item=>national?item.region===name:item.dm===name)}))
    table([[national?'Región':'DM',...visibleWeeks.slice(-6).map(week=>`S${week}`),'Total']],grouped.slice(0,12).map(group=>[group.name,...visibleWeeks.slice(-6).map(week=>fmt(weeklyValue(group.items,week))),fmt(group.items.reduce((sum,item)=>sum+value(item),0)/(metric==='usd'?Math.max(1,group.items.length):1))]))
    y+=4; const districtNames=[...new Set(scores.map(item=>item.dm))]; const districtScores=districtNames.map(name=>{const items=scores.filter(item=>item.dm===name);return{name,value:items.reduce((sum,item)=>sum+value(item),0)/(metric==='usd'?Math.max(1,items.length):1)}}); const storeRanking=rankingRows(scores); const ranked=national?[...districtScores].sort((a,b)=>b.value-a.value):storeRanking.map(item=>({name:item.store,value:value(item)})); const bottom=[...ranked].sort((a,b)=>a.value-b.value)
    section(`Top 5 y Bottom 5 de ${national?'DM':'tiendas'}`,'Reconoce el avance y enfoca la siguiente conversación.')
    table([['Top 5','Valor','Bottom 5','Valor']],Array.from({length:5},(_,i)=>[ranked[i]?.name??'—',ranked[i]?fmt(ranked[i].value):'—',bottom[i]?.name??'—',bottom[i]?fmt(bottom[i].value):'—']))
  }
  const footerY=height-9; doc.setDrawColor(204,218,211); doc.line(margin,footerY-4,width-margin,footerY-4); doc.setTextColor(65,89,79); doc.setFont('helvetica','normal'); doc.setFontSize(6); doc.text('Diseñado por Jorge Alcantar Aguiar & Enrique César Flores',margin,footerY); doc.setFont('helvetica','bold'); doc.setTextColor(...green); doc.text('#GreenApronService · JUNTÉMONOS MÁS',width-margin,footerY,{align:'right'})
  const safe=(text:string)=>text.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9]+/g,'_').replace(/^_|_$/g,'')
  doc.save(`Reporte_${safe(scope)}_${safe(period)}.pdf`)
}
