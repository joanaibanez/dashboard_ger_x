// Importa as respostas do Google Forms (CSV em data/) para o Supabase.
// Uso: node --env-file=.env.local scripts/import-responses.mjs [--schema] [caminho.csv]
//   --schema  recria a tabela a partir de supabase/schema.sql antes de importar
// A tabela é sempre zerada antes da carga; os indicadores são calculados pelo trigger no banco.
import { readFileSync, readdirSync } from 'node:fs'
import pg from 'pg'

const args = process.argv.slice(2)
const withSchema = args.includes('--schema')
const csvPath = args.find((arg) => !arg.startsWith('--'))
  ?? `data/${readdirSync('data').find((file) => file.endsWith('.csv'))}`

if (!process.env.SUPABASE_DB_URL) throw new Error('Defina SUPABASE_DB_URL em .env.local')

function parseCsv(text) {
  const rows = [[]]
  let field = '', quoted = false
  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') { field += '"'; i++ }
      else if (char === '"') quoted = false
      else field += char
    } else if (char === '"') quoted = true
    else if (char === ',') { rows.at(-1).push(field); field = '' }
    else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[i + 1] === '\n') i++
      rows.at(-1).push(field); field = ''; rows.push([])
    } else field += char
  }
  if (field || rows.at(-1).length) rows.at(-1).push(field)
  return rows.filter((row) => row.some((value) => value.trim()))
}

const [header, ...records] = parseCsv(readFileSync(csvPath, 'utf8').replace(/^﻿/, ''))
const headers = header.map((title) => title.replace(/\s+/g, ' ').trim())

/** Índice da coluna cujo título começa com `question` (e contém `[item]`, para matrizes). */
function column(question, item) {
  const index = headers.findIndex((title) => title.startsWith(question) && (!item || title.includes(`[${item}`)))
  if (index < 0) throw new Error(`Coluna não encontrada: ${question} ${item ?? ''}`)
  return index
}

const text = (value) => value?.trim() || null
// Múltipla escolha do Forms: opções separadas por ", " seguidas de maiúscula
const list = (value) => value?.trim() ? value.split(/, (?=[A-ZÁÉÍÓÚÂÊÔÃÕÇ])/).map((option) => option.trim()) : []
const matrixItems = (question) => headers.flatMap((title) => {
  const match = title.startsWith(question) && title.match(/\[(.+?)\s*\]$/)
  return match ? [match[1].trim()] : []
})
function matrix(row, question, parse = text) {
  return Object.fromEntries(matrixItems(question).flatMap((item) => {
    const value = parse(row[column(question, item)])
    return value === null || (Array.isArray(value) && !value.length) ? [] : [[item, value]]
  }))
}

const Q = {
  timestamp: 'Carimbo de data/hora',
  age: 'Qual sua faixa de idade?',
  region: 'Em qual região do município',
  employment: 'Qual alternativa melhor representa sua situação profissional',
  income: 'Qual é a renda mensal total',
  dependencyFactors: 'Pensando no bairro onde você mora',
  commute: 'Em um dia comum',
  walking: 'Considerando seus deslocamentos do dia a dia',
  walkAccess: 'Pensando nesse limite de tempo',
  relationship: 'Atualmente, qual situação melhor descreve sua relação',
  acquisition: 'Como você adquiriu seu veículo atual?',
  transportModes: 'Quais meios de transporte você utiliza',
  noCarReason: 'Qual é o principal motivo para você não utilizar carro',
  carTriggers: 'O que poderia fazer você considerar ter acesso regular',
  futureStance: 'Pensando nos próximos 3 anos, como você se posiciona',
  vehicleType: 'Pensando no veículo que você utiliza regularmente, qual tipo',
  powertrain: 'Qual é a motorização',
  vehicleYear: 'Qual é aproximadamente o ano',
  sharing: 'Além de você, quantas outras pessoas',
  monthlyCost: 'Pensando no carro que você utiliza atualmente, aproximadamente',
  weeklyUse: 'Em uma semana comum',
  agreement: 'Pensando nos seus deslocamentos atuais, indique',
  requiredActivities: 'Para quais atividades o uso de um veículo',
  alternatives: 'Se você não pudesse utilizar um carro',
  alternativeFactors: 'Quais fatores mais influenciariam sua escolha',
  intentions: 'Pensando nos próximos 3 anos, qual é a probabilidade',
  ownership: 'Para você, quão importante é ser proprietário',
  financingFactors: 'Se você considerasse financiar um carro, qual seria a relevância',
  payment: 'Se você considerasse financiar um carro, qual faixa de parcela',
  downPayment: 'Se você considerasse financiar um carro, qual percentual',
  trust: 'Qual é a relevância de cada fator abaixo para que você confie',
  journey: 'Em cada etapa de um financiamento',
  digitalChannels: 'Quais canais digitais você preferiria',
  institutions: 'Para cada instituição financeira abaixo',
  benefits: 'Quais dos benefícios abaixo aumentariam',
  evAccess: 'Se você tivesse interesse em utilizar um veículo eletrificado',
  evAttitudes: 'Indique o quanto você concorda ou discorda',
  homeCharging: 'Pensando na sua residência atual',
  evSolutions: 'Quais soluções ou benefícios relacionados',
}

const at = (row, question) => row[column(question)]

function parseTimestamp(value) {
  const [date, time] = value.trim().split(' ')
  const [day, month, year] = date.split('/')
  return `${year}-${month}-${day}T${time}-03:00` // horário de Brasília
}

const seen = new Map()
const responses = records.map((row) => {
  const submittedAt = parseTimestamp(at(row, Q.timestamp))
  seen.set(submittedAt, (seen.get(submittedAt) ?? 0) + 1)
  return {
    submitted_at: submittedAt,
    source: 'google_forms',
    age_band: text(at(row, Q.age)),
    region: text(at(row, Q.region))?.split(' — ')[0] ?? null,
    employment_status: text(at(row, Q.employment)),
    household_income: text(at(row, Q.income)),
    car_dependency_factors: list(at(row, Q.dependencyFactors)),
    daily_commute_time: text(at(row, Q.commute)),
    walking_willingness: text(at(row, Q.walking)),
    walk_access: list(at(row, Q.walkAccess)),
    vehicle_relationship: text(at(row, Q.relationship)),
    vehicle_acquisition: text(at(row, Q.acquisition)),
    transport_modes: list(at(row, Q.transportModes)),
    no_car_reason: text(at(row, Q.noCarReason)),
    car_access_triggers: list(at(row, Q.carTriggers)),
    future_vehicle_stance: text(at(row, Q.futureStance)),
    vehicle_type: text(at(row, Q.vehicleType)),
    vehicle_powertrain: text(at(row, Q.powertrain)),
    vehicle_year_range: text(at(row, Q.vehicleYear)),
    vehicle_sharing: text(at(row, Q.sharing)),
    monthly_vehicle_cost: text(at(row, Q.monthlyCost)),
    weekly_vehicle_use: text(at(row, Q.weeklyUse)),
    routine_depends_on_car: text(row[column(Q.agreement, 'Minha rotina depende')]),
    can_use_alternatives: text(row[column(Q.agreement, 'Consigo realizar')]),
    car_required_activities: list(at(row, Q.requiredActivities)),
    alternative_modes: list(at(row, Q.alternatives)),
    alternative_transport_factors: list(at(row, Q.alternativeFactors)),
    mobility_intentions: matrix(row, Q.intentions),
    ownership_importance: text(at(row, Q.ownership)) ? Number(at(row, Q.ownership)) : null,
    financing_factors: matrix(row, Q.financingFactors),
    compatible_monthly_payment: text(at(row, Q.payment)),
    acceptable_down_payment: text(at(row, Q.downPayment)),
    trust_drivers: matrix(row, Q.trust),
    financing_journey: matrix(row, Q.journey),
    digital_channels: list(at(row, Q.digitalChannels)),
    institutions: matrix(row, Q.institutions, list),
    benefits: matrix(row, Q.benefits),
    ev_access_options: list(at(row, Q.evAccess)),
    ev_attitudes: matrix(row, Q.evAttitudes),
    home_charging_status: text(at(row, Q.homeCharging)),
    ev_solutions: list(at(row, Q.evSolutions)),
  }
})
for (const response of responses) response.potential_duplicate = seen.get(response.submitted_at) > 1

const client = new pg.Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } })
await client.connect()
try {
  await client.query('begin')
  if (withSchema) await client.query(readFileSync('supabase/schema.sql', 'utf8'))
  else await client.query('truncate public.responses restart identity')
  for (const response of responses) {
    const keys = Object.keys(response)
    await client.query(
      `insert into public.responses (${keys.join(', ')}) values (${keys.map((_, index) => `$${index + 1}`).join(', ')})`,
      keys.map((key) => response[key]),
    )
  }
  await client.query('commit')
  const { rows: [summary] } = await client.query('select * from public.collection_summary()')
  console.log(`Importadas ${responses.length} respostas de ${csvPath}: ${summary.eligible} elegíveis, ${summary.ineligible} fora do perfil.`)
} catch (error) {
  await client.query('rollback')
  throw error
} finally {
  await client.end()
}
