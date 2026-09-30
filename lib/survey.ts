import { supabase } from '@/lib/supabase'

type Matrix = Record<string, string>

export type ResponseRow = {
  id: number
  submitted_at: string
  source: string
  age_band: string
  region: string | null
  employment_status: string | null
  household_income: string | null
  car_dependency_factors: string[]
  daily_commute_time: string | null
  walking_willingness: string | null
  walk_access: string[]
  vehicle_relationship: string | null
  vehicle_acquisition: string | null
  vehicle_type: string | null
  vehicle_powertrain: string | null
  vehicle_year_range: string | null
  vehicle_sharing: string | null
  monthly_vehicle_cost: string | null
  weekly_vehicle_use: string | null
  routine_depends_on_car: string | null
  can_use_alternatives: string | null
  car_required_activities: string[]
  alternative_modes: string[]
  alternative_transport_factors: string[]
  mobility_intentions: Matrix
  ownership_importance: number | null
  financing_factors: Matrix
  compatible_monthly_payment: string | null
  acceptable_down_payment: string | null
  trust_drivers: Matrix
  financing_journey: Matrix
  digital_channels: string[]
  institutions: Record<string, string[]>
  benefits: Matrix
  ev_access_options: string[]
  ev_attitudes: Matrix
  home_charging_status: string | null
  ev_solutions: string[]
  ida_score: number | null
  ida_band: string | null
  financing_propensity: number | null
  ev_readiness_score: number | null
  ev_readiness_band: string | null
  potential_duplicate: boolean
}

export type RowKey = keyof ResponseRow
export type MatrixKey = 'mobility_intentions' | 'financing_factors' | 'trust_drivers' | 'financing_journey' | 'institutions' | 'benefits' | 'ev_attitudes'
export type Item = { label: string; value: number; n?: number }

/** Ordem das escalas ordinais (rótulos exatos do Google Forms); categorias fora da lista vão para o fim. */
export const ORDER: Partial<Record<RowKey, string[]>> = {
  age_band: ['45 a 49 anos', '50 a 54 anos', '55 a 61 anos'],
  region: ['Centro', 'Zona Norte', 'Zona Sul', 'Zona Leste', 'Zona Oeste'],
  household_income: ['Até 2 salários mínimos', 'De 2 a 5 salários mínimos', 'De 5 a 10 salários mínimos', 'Mais de 10 salários mínimos', 'Prefiro não informar'],
  daily_commute_time: ['Até 30 minutos', 'De 30 minutos a 1 hora', 'De 1 a 2 horas', 'De 2 a 3 horas', 'Mais de 3 horas', 'Varia muito de um dia para outro'],
  walking_willingness: ['Não estou disposto(a) a caminhar', 'Até 10 minutos', 'De 10 a 20 minutos', 'De 20 a 30 minutos', 'Acima de 30 minutos'],
  weekly_vehicle_use: ['Nenhum dia', '1 a 2 dias', '3 a 4 dias', '5 a 6 dias', 'Todos os dias'],
  vehicle_year_range: ['Até 2015', '2016 a 2018', '2019 a 2021', '2022 a 2024', '2025 ou mais recente'],
  vehicle_sharing: ['Somente eu', '1 pessoa', '2 pessoas', '3 ou mais pessoas'],
  monthly_vehicle_cost: ['Até R$ 500', 'De R$ 501 a R$ 1.000', 'De R$ 1.001 a R$ 1.500', 'De R$ 1.501 a R$ 2.000', 'De R$ 2.001 a R$ 3.000', 'Mais de R$ 3.000'],
  compatible_monthly_payment: ['Até R$ 500', 'De R$ 501 a R$ 1.000', 'Até R$ 1.000', 'De R$ 1.001 a R$ 1.500', 'De R$ 1.501 a R$ 2.000', 'De R$ 2.001 a R$ 3.000', 'Mais de R$ 3.000'],
  acceptable_down_payment: ['Nenhuma entrada', 'Até 10%', 'De 11% a 20%', 'De 21% a 30%', 'Mais de 30%'],
  routine_depends_on_car: ['Discordo Totalmente', 'Discordo', 'Neutro', 'Concordo', 'Concordo Totalmente'],
  can_use_alternatives: ['Discordo Totalmente', 'Discordo', 'Neutro', 'Concordo', 'Concordo Totalmente'],
  ownership_importance: ['1', '2', '3', '4', '5'],
  ida_band: ['Baixa', 'Média', 'Alta'],
  ev_readiness_band: ['Baixa', 'Média', 'Alta'],
}

/** Escalas das perguntas em matriz. */
export const SCALES = {
  relevance: { Irrelevante: 1, 'Pouco relevante': 2, 'Moderadamente relevante': 3, Relevante: 4, 'Muito relevante': 5 } as Record<string, number>,
  probability: { Improvável: 0, 'Pouco provável': 25, Possivelmente: 50, Provável: 75, 'Muito provável': 100 } as Record<string, number>,
}

export const FILTER_FIELDS: { key: RowKey; label: string }[] = [
  { key: 'age_band', label: 'Faixa etária' },
  { key: 'region', label: 'Região de São Paulo' },
  { key: 'household_income', label: 'Renda domiciliar' },
  { key: 'employment_status', label: 'Situação profissional' },
  { key: 'vehicle_relationship', label: 'Relação com veículo' },
  { key: 'ida_band', label: 'Faixa IDA' },
  { key: 'ev_readiness_band', label: 'Readiness EV' },
]

export type Filters = Partial<Record<RowKey, string>>

/** Ausência, "Não se aplica" e variações de "Não sei" nunca viram zero: ficam fora das contas. */
export const isMissing = (value: unknown) =>
  value === null || value === undefined || value === '' || (typeof value === 'string' && /^não se aplica|^não sei/i.test(value))

const NUMERIC_KEYS: RowKey[] = ['ida_score', 'financing_propensity', 'ev_readiness_score']

export async function fetchResponses(): Promise<ResponseRow[]> {
  if (!supabase) throw new Error('unconfigured')
  const { data, error } = await supabase.from('responses').select('*').eq('is_eligible', true).order('submitted_at')
  if (error) throw error
  return (data ?? []).map((row) => ({
    ...row,
    ...Object.fromEntries(NUMERIC_KEYS.map((key) => [key, row[key] === null ? null : Number(row[key])])),
  })) as ResponseRow[]
}

/** Total de respostas recebidas, incluindo as fora do perfil (que não são expostas pela RLS). */
export async function fetchCollectionSummary() {
  if (!supabase) return null
  const { data, error } = await supabase.rpc('collection_summary')
  if (error || !data?.[0]) return null
  const [summary] = data as { total: number; eligible: number; ineligible: number }[]
  return { total: Number(summary.total), eligible: Number(summary.eligible), ineligible: Number(summary.ineligible) }
}

export const applyFilters = (rows: ResponseRow[], filters: Filters) =>
  rows.filter((row) => Object.entries(filters).every(([key, value]) => !value || String(row[key as RowKey]) === value))

const rankIn = (order: string[] | undefined, label: string) => !order ? 0 : order.includes(label) ? order.indexOf(label) : order.length
const sortByOrder = (order: string[] | undefined, items: Item[]) =>
  order ? items.sort((a, b) => rankIn(order, a.label) - rankIn(order, b.label) || b.value - a.value) : items.sort((a, b) => b.value - a.value)

export const optionsFor = (rows: ResponseRow[], key: RowKey) => countBy(rows, key).map((item) => item.label)

/** Conta respondentes por categoria; em múltipla escolha conta cada opção selecionada. */
export function countBy(rows: ResponseRow[], key: RowKey): Item[] {
  const counts = new Map<string, number>()
  for (const row of rows) {
    const raw = row[key]
    for (const value of Array.isArray(raw) ? raw : [raw]) {
      if (isMissing(value)) continue
      counts.set(String(value), (counts.get(String(value)) ?? 0) + 1)
    }
  }
  return sortByOrder(ORDER[key], [...counts].map(([label, value]) => ({ label, value })))
}

/** Número de respondentes com pelo menos uma resposta válida no campo. */
export const answered = (rows: ResponseRow[], key: RowKey) => rows.filter((row) => {
  const raw = row[key]
  if (Array.isArray(raw)) return raw.some((value) => !isMissing(value))
  if (raw && typeof raw === 'object') return Object.keys(raw).length > 0
  return !isMissing(raw)
}).length

const average = (values: number[]) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null

export const mean = (rows: ResponseRow[], key: RowKey) =>
  average(rows.map((row) => row[key]).filter((value): value is number => typeof value === 'number' && !Number.isNaN(value)))

export function meanBy(rows: ResponseRow[], groupKey: RowKey, valueKey: RowKey): Item[] {
  const groups = new Map<string, ResponseRow[]>()
  for (const row of rows) {
    const group = row[groupKey]
    if (isMissing(group)) continue
    groups.set(String(group), [...(groups.get(String(group)) ?? []), row])
  }
  const items = [...groups].flatMap(([label, groupRows]) => {
    const value = mean(groupRows, valueKey)
    return value === null ? [] : [{ label, value, n: groupRows.filter((row) => typeof row[valueKey] === 'number').length }]
  })
  return sortByOrder(ORDER[groupKey], items)
}

export type CrossTab = { rows: string[]; cols: string[]; cells: Record<string, Record<string, number>>; max: number }

function buildCrossTab(pairs: [string, string][], rowOrder?: string[], colOrder?: string[]): CrossTab {
  const cells: CrossTab['cells'] = {}
  const rowTotals = new Map<string, number>()
  const colTotals = new Map<string, number>()
  let max = 0
  for (const [row, col] of pairs) {
    const line = (cells[row] ??= {})
    line[col] = (line[col] ?? 0) + 1
    max = Math.max(max, line[col])
    rowTotals.set(row, (rowTotals.get(row) ?? 0) + 1)
    colTotals.set(col, (colTotals.get(col) ?? 0) + 1)
  }
  const labels = (totals: Map<string, number>, order?: string[]) =>
    sortByOrder(order, [...totals].map(([label, value]) => ({ label, value }))).map((item) => item.label)
  return { rows: labels(rowTotals, rowOrder), cols: labels(colTotals, colOrder), cells, max }
}

export function crossTab(rows: ResponseRow[], rowKey: RowKey, colKey: RowKey): CrossTab {
  const pairs = rows.flatMap((row) => {
    const rowValue = row[rowKey]
    const colValues = Array.isArray(row[colKey]) ? row[colKey] as string[] : [row[colKey]]
    if (isMissing(rowValue)) return []
    return colValues.filter((value) => !isMissing(value)).map((value) => [String(rowValue), String(value)] as [string, string])
  })
  return buildCrossTab(pairs, ORDER[rowKey], ORDER[colKey])
}

/** Tabela item da matriz × resposta (ex.: etapa da jornada × formato preferido). */
export function matrixCrossTab(rows: ResponseRow[], key: MatrixKey, colOrder?: string[]): CrossTab {
  const pairs = rows.flatMap((row) => Object.entries(row[key] ?? {}).flatMap(([item, answer]) =>
    (Array.isArray(answer) ? answer : [answer]).filter((value) => !isMissing(value)).map((value) => [item, value] as [string, string])))
  return buildCrossTab(pairs, undefined, colOrder)
}

/** Média por item de uma matriz, convertendo a resposta pela escala informada. */
export function matrixMean(rows: ResponseRow[], key: MatrixKey, scale: Record<string, number>): Item[] {
  const values = new Map<string, number[]>()
  for (const row of rows) {
    for (const [item, answer] of Object.entries(row[key] ?? {})) {
      const score = typeof answer === 'string' ? scale[answer] : undefined
      if (score === undefined) continue
      values.set(item, [...(values.get(item) ?? []), score])
    }
  }
  return [...values].map(([label, scores]) => ({ label, value: average(scores)!, n: scores.length })).sort((a, b) => b.value - a.value)
}

/** % de quem respondeu cada item da matriz com uma das respostas indicadas. */
export function matrixShare(rows: ResponseRow[], key: MatrixKey, accepted: string[]): Item[] {
  const totals = new Map<string, [number, number]>()
  for (const row of rows) {
    for (const [item, answer] of Object.entries(row[key] ?? {})) {
      const answers = Array.isArray(answer) ? answer : [answer]
      if (answers.every(isMissing)) continue
      const [hits, total] = totals.get(item) ?? [0, 0]
      totals.set(item, [hits + (answers.some((value) => accepted.includes(value)) ? 1 : 0), total + 1])
    }
  }
  return [...totals].map(([label, [hits, total]]) => ({ label, value: hits / total * 100, n: total })).sort((a, b) => b.value - a.value)
}

export function dailyCounts(rows: ResponseRow[], days = 30): Item[] {
  const dayKey = (date: Date) => date.toLocaleDateString('sv-SE') // AAAA-MM-DD no fuso local
  const counts = new Map<string, number>()
  for (const row of rows) {
    const day = dayKey(new Date(row.submitted_at))
    counts.set(day, (counts.get(day) ?? 0) + 1)
  }
  const end = new Date()
  return Array.from({ length: days }, (_, index) => {
    const date = new Date(end)
    date.setDate(end.getDate() - (days - 1 - index))
    const key = dayKey(date)
    return { label: key, value: counts.get(key) ?? 0 }
  })
}

export const share = (part: number, total: number) => total ? part / total * 100 : null

export const formatNumber = (value: number | null, digits = 1) =>
  value === null ? '—' : value.toLocaleString('pt-BR', { minimumFractionDigits: digits, maximumFractionDigits: digits })

export const formatPercent = (value: number | null) => value === null ? '—' : `${Math.round(value)}%`

export function toCsv(rows: ResponseRow[]) {
  if (!rows.length) return ''
  const keys = Object.keys(rows[0]) as RowKey[]
  const escape = (value: unknown) => {
    const text = Array.isArray(value) ? value.join('; ') : value === null || value === undefined ? '' : typeof value === 'object' ? JSON.stringify(value) : String(value)
    return /[";\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
  }
  return [keys.join(';'), ...rows.map((row) => keys.map((key) => escape(row[key])).join(';'))].join('\n')
}
