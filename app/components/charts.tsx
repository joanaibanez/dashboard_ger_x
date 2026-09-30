import type { CrossTab, Item } from '@/lib/survey'
import { formatNumber } from '@/lib/survey'

/** Escala sequencial (claro → vermelho) para categorias ordinais como Baixa/Média/Alta. */
const SEQUENTIAL = ['var(--seq-1)', 'var(--seq-2)', 'var(--seq-3)', 'var(--seq-4)']

export const SERIES = ['var(--series-1)', 'var(--series-2)', 'var(--series-3)', 'var(--series-4)', 'var(--series-5)', 'var(--series-6)']

export function Panel({ label, title, note, wide, children }: { label?: string; title: string; note?: string; wide?: boolean; children: React.ReactNode }) {
  return <article className={wide ? 'panel wide' : 'panel'}><header className="panel-heading">{label && <span className="panel-label">{label}</span>}<h3>{title}</h3>{note && <p className="panel-note">{note}</p>}</header>{children}</article>
}

export function Empty({ text = 'Sem respostas para este recorte.' }: { text?: string }) {
  return <p className="empty">{text}</p>
}

/** Barras horizontais. `base` = respondentes do recorte (para exibir % de quem citou). */
export function BarList({ items, base, format = 'count', max, limit }: { items: Item[]; base?: number; format?: 'count' | 'score' | 'scale' | 'percent'; max?: number; limit?: number }) {
  if (!items.length) return <Empty />
  const shown = limit ? items.slice(0, limit) : items
  const scaleMax = max ?? Math.max(...shown.map((item) => item.value))
  return <div className="bar-list">{shown.map((item) => {
    const valueText = format === 'count'
      ? `${base ? Math.round(item.value / base * 100) + '% · ' : ''}${item.value}`
      : `${format === 'percent' ? Math.round(item.value) + '%' : formatNumber(item.value, format === 'scale' ? 2 : 1)}${item.n ? ` · n=${item.n}` : ''}`
    return <div className="bar-row" key={item.label}>
      <div><span>{item.label}</span><strong>{valueText}</strong></div>
      <div className="bar-track"><span className="bar-fill" style={{ width: `${scaleMax ? item.value / scaleMax * 100 : 0}%` }} /></div>
    </div>
  })}</div>
}

export function Donut({ items, center, caption, sequential }: { items: Item[]; center: string; caption: string; sequential?: boolean }) {
  const palette = sequential ? SEQUENTIAL.slice(-Math.max(2, items.length)) : SERIES
  const color = (index: number) => palette[Math.min(index, palette.length - 1)] ?? SERIES[index % SERIES.length]
  const total = items.reduce((sum, item) => sum + item.value, 0)
  if (!total) return <Empty />
  let start = 0
  const stops = items.map((item, index) => {
    const end = start + item.value / total * 100
    const stop = `${color(index)} ${start}% ${end}%`
    start = end
    return stop
  })
  return <div className="donut-chart">
    <div className="donut" style={{ background: `conic-gradient(${stops.join(', ')})` }}><div className="donut-inner"><strong>{center}</strong><span>{caption}</span></div></div>
    <div className="legend">{items.map((item, index) => <div className="legend-row" key={item.label}><span className="legend-dot" style={{ background: color(index) }} />{item.label}<strong>{Math.round(item.value / total * 100)}%</strong></div>)}</div>
  </div>
}

export function Heatmap({ table }: { table: CrossTab }) {
  if (!table.rows.length || !table.cols.length) return <Empty />
  return <div className="table-scroll"><table className="heatmap">
    <thead><tr><th />{table.cols.map((col) => <th key={col}>{col}</th>)}</tr></thead>
    <tbody>{table.rows.map((row) => <tr key={row}><th>{row}</th>{table.cols.map((col) => {
      const value = table.cells[row]?.[col] ?? 0
      const intensity = table.max ? value / table.max : 0
      return <td key={col} style={{ background: `rgba(236, 0, 0, ${0.06 + intensity * 0.84})`, color: intensity > 0.5 ? '#fff' : 'var(--ink)' }}>{value || '·'}</td>
    })}</tr>)}</tbody>
  </table></div>
}

export function DailyColumns({ items }: { items: Item[] }) {
  const max = Math.max(1, ...items.map((item) => item.value))
  const total = items.reduce((sum, item) => sum + item.value, 0)
  const day = (label: string) => new Date(`${label}T12:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
  return <div className="columns-chart">
    <div className="columns" role="img" aria-label={`${total} respostas nos últimos ${items.length} dias`}>
      {items.map((item) => <span key={item.label} className={item.value ? 'column' : 'column zero'} title={`${day(item.label)}: ${item.value}`} style={{ height: `${Math.max(item.value ? 4 : 1, item.value / max * 100)}%` }} />)}
    </div>
    <div className="columns-axis"><span>{day(items[0].label)}</span><span>{day(items[Math.floor(items.length / 2)].label)}</span><span>hoje</span></div>
  </div>
}

export function Gauge({ value, max = 100, bands }: { value: number | null; max?: number; bands: [string, number][] }) {
  const position = value === null ? 0 : Math.min(100, value / max * 100)
  return <div className="gauge">
    <strong>{formatNumber(value)}</strong>
    <div className="gauge-track">{value !== null && <span className="gauge-marker" style={{ left: `${position}%` }} />}</div>
    <div className="gauge-bands">{bands.map(([label, limit]) => <span key={label}>{label} ≤ {limit}</span>)}</div>
  </div>
}
