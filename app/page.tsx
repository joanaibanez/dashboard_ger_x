'use client'

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react'
import {
  Activity, BatteryCharging, Car, Check, CircleDollarSign, ClipboardList, Download, Flame, Gauge as GaugeIcon,
  Info, LayoutDashboard, Lock, LogOut, Menu, RefreshCw, Route, Send, SlidersHorizontal, Users, X,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import {
  FILTER_FIELDS, ORDER, SCALES, applyFilters, answered, countBy, crossTab, dailyCounts, fetchCollectionSummary, fetchResponses,
  formatNumber, formatPercent, matrixCrossTab, matrixMean, matrixShare, mean, meanBy, optionsFor, share, toCsv,
  type Filters, type ResponseRow, type RowKey,
} from '@/lib/survey'
import { BarList, DailyColumns, Donut, Gauge, Heatmap, Panel } from './components/charts'

const views = [
  { id: 'overview', label: 'Visão geral', icon: LayoutDashboard },
  { id: 'monitoring', label: 'Monitoramento', icon: Activity },
  { id: 'profile', label: 'Perfil dos respondentes', icon: Users },
  { id: 'mobility', label: 'Mobilidade & território', icon: Route },
  { id: 'vehicles', label: 'Veículos', icon: Car },
  { id: 'financing', label: 'Financiamento', icon: CircleDollarSign },
  { id: 'ev', label: 'Veículos elétricos', icon: BatteryCharging },
] as const

type ViewId = typeof views[number]['id'] | 'form'
type Connection = 'loading' | 'connected' | 'error' | 'unconfigured'
type Summary = Awaited<ReturnType<typeof fetchCollectionSummary>>

const SMALL_SAMPLE = 30
// Barreira apenas de interface: num site estático o token fica no bundle e não protege os dados.
const DASHBOARD_TOKEN = '010101'
const UNLOCK_KEY = 'gx-dashboard-unlocked'

export default function Home() {
  const [unlocked, setUnlocked] = useState(false)
  const [tokenOpen, setTokenOpen] = useState(false)
  const [view, setView] = useState<ViewId>('overview')
  const [menuOpen, setMenuOpen] = useState(false)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [rows, setRows] = useState<ResponseRow[]>([])
  const [connection, setConnection] = useState<Connection>('loading')
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null)
  const [filters, setFilters] = useState<Filters>({})
  const [summary, setSummary] = useState<Summary>(null)

  const load = useCallback(async () => {
    setConnection((current) => current === 'connected' ? current : 'loading')
    try {
      const [responses, collection] = await Promise.all([fetchResponses(), fetchCollectionSummary()])
      setRows(responses)
      setSummary(collection)
      setConnection('connected')
      setUpdatedAt(new Date())
    } catch (error) {
      setConnection(error instanceof Error && error.message === 'unconfigured' ? 'unconfigured' : 'error')
    }
  }, [])

  useEffect(() => {
    try { if (sessionStorage.getItem(UNLOCK_KEY) === '1') setUnlocked(true) } catch {}
  }, [])

  const unlock = () => {
    try { sessionStorage.setItem(UNLOCK_KEY, '1') } catch {}
    setUnlocked(true)
    setView('overview')
    setTokenOpen(false)
  }

  const lock = () => {
    try { sessionStorage.removeItem(UNLOCK_KEY) } catch {}
    setUnlocked(false)
    setMenuOpen(false)
  }

  useEffect(() => {
    if (!unlocked) return
    load()
    if (!supabase) return
    const client = supabase
    // Atualiza sozinho quando chegam novas respostas (requer Realtime habilitado na tabela)
    const channel = client.channel('responses-feed')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'responses' }, () => load())
      .subscribe()
    return () => { client.removeChannel(channel) }
  }, [load, unlocked])

  const filtered = useMemo(() => applyFilters(rows, filters), [rows, filters])
  const activeFilters = Object.entries(filters).filter(([, value]) => value) as [RowKey, string][]
  const current = views.find((item) => item.id === view)

  const go = (next: ViewId) => { setView(next); setMenuOpen(false); window.scrollTo({ top: 0 }) }

  const exportCsv = () => {
    const blob = new Blob(['﻿' + toCsv(filtered)], { type: 'text/csv;charset=utf-8' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `geracao-x-respostas-${new Date().toISOString().slice(0, 10)}.csv`
    link.click()
    URL.revokeObjectURL(link.href)
  }

  if (!unlocked) return (
    <main className="public-shell">
      <header className="topbar public-topbar">
        <div className="brand"><span className="brand-mark"><Flame size={18} /></span><span>Geração X<small>Pesquisa São Paulo · 45–61 anos</small></span></div>
        <div className="top-actions"><button className="ghost-button" onClick={() => setTokenOpen(true)}><Lock size={15} /> Acessar dashboard</button></div>
      </header>
      <SurveyForm onSaved={() => {}} />
      {tokenOpen && <TokenDialog onUnlock={unlock} onClose={() => setTokenOpen(false)} />}
    </main>
  )

  return (
    <main className="app-shell">
      <aside className={menuOpen ? 'sidebar open' : 'sidebar'}>
        <div className="brand"><span className="brand-mark"><Flame size={18} /></span><span>Geração X<small>Pesquisa São Paulo · 45–61 anos</small></span></div>
        <nav className="main-nav">
          <span className="nav-caption">Painel</span>
          {views.map(({ id, label, icon: Icon }) => <button key={id} className={view === id ? 'nav-item active' : 'nav-item'} onClick={() => go(id)}><Icon size={17} />{label}</button>)}
          <span className="nav-caption">Ações</span>
          <button className={view === 'form' ? 'nav-item active' : 'nav-item'} onClick={() => go('form')}><ClipboardList size={17} />Responder pesquisa</button>
          <button className="nav-item" onClick={() => { setFiltersOpen(true); setMenuOpen(false) }}><SlidersHorizontal size={17} />Filtros</button>
        </nav>
        <div className="sidebar-footer">
          <ConnectionBadge connection={connection} />
          <button className="logout" onClick={lock}><LogOut size={14} /> Sair do dashboard</button>
          <small>{updatedAt ? `Atualizado às ${updatedAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}` : 'Aguardando dados'}</small>
        </div>
      </aside>
      {menuOpen && <div className="sidebar-backdrop" onClick={() => setMenuOpen(false)} />}

      <section className="content-area">
        <header className="topbar">
          <button className="mobile-menu" aria-label="Abrir menu" onClick={() => setMenuOpen(true)}><Menu size={21} /></button>
          <div className="breadcrumb">Pesquisa <span>/</span> <strong>{view === 'form' ? 'Responder pesquisa' : current?.label}</strong></div>
          <div className="top-actions">
            <button className="icon-button" aria-label="Recarregar dados" title="Recarregar dados" onClick={load}><RefreshCw size={17} /></button>
            {view !== 'form' && <button className="ghost-button" onClick={exportCsv} disabled={!filtered.length}><Download size={15} /> Exportar CSV</button>}
            <button className="primary-button" onClick={() => go('form')}><ClipboardList size={15} /> Responder</button>
          </div>
        </header>

        {view === 'form'
          ? <SurveyForm onSaved={load} />
          : <>
            <div className="page-heading">
              <div className="eyebrow">Painel analítico da pesquisa</div>
              <h1>{current?.label}</h1>
              <p>Hábitos, necessidades, uso de veículos, financiamento e novas soluções de mobilidade entre pessoas da Geração X (45 a 61 anos) no município de São Paulo.</p>
            </div>
            <div className="filter-strip">
              <button className="filter-open" onClick={() => setFiltersOpen(true)}><SlidersHorizontal size={15} /> Filtros{activeFilters.length ? ` (${activeFilters.length})` : ''}</button>
              {activeFilters.length
                ? activeFilters.map(([key, value]) => <button key={key} className="filter-pill" onClick={() => setFilters((old) => ({ ...old, [key]: '' }))}>{value}<X size={13} /></button>)
                : <span className="filter-empty">Nenhum filtro ativo — exibindo toda a base elegível.</span>}
              {activeFilters.length > 0 && <button className="filter-clear" onClick={() => setFilters({})}>Limpar tudo</button>}
              <span className="sample-count"><strong>{filtered.length}</strong> de {rows.length} respostas</span>
            </div>
            <div className="dashboard-body">
              {connection === 'error' && <div className="alert">Não foi possível consultar a tabela <code>responses</code> no Supabase. <button onClick={load}>Tentar de novo</button></div>}
              {connection === 'unconfigured' && <div className="alert">Supabase não configurado: defina <code>NEXT_PUBLIC_SUPABASE_URL</code> e <code>NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY</code> em <code>.env.local</code>.</div>}
              {connection === 'connected' && filtered.length > 0 && filtered.length < SMALL_SAMPLE && <div className="alert soft"><Info size={15} /> Base atual pequena ({filtered.length} respostas) — os resultados podem não ser representativos.</div>}
              {connection === 'loading' && !rows.length
                ? <div className="loading">Consultando Supabase…</div>
                : <ViewContent view={view} rows={filtered} summary={summary} />}
            </div>
          </>}
      </section>

      {filtersOpen && <FiltersDrawer rows={rows} filters={filters} onChange={setFilters} onClose={() => setFiltersOpen(false)} />}
    </main>
  )
}

function TokenDialog({ onUnlock, onClose }: { onUnlock: () => void; onClose: () => void }) {
  const [token, setToken] = useState('')
  const [invalid, setInvalid] = useState(false)
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (token.trim() === DASHBOARD_TOKEN) onUnlock()
    else setInvalid(true)
  }
  return <div className="modal-backdrop center" onClick={onClose}>
    <form className="token-dialog" onSubmit={submit} onClick={(event) => event.stopPropagation()}>
      <div className="drawer-heading"><div><span className="panel-label">Área restrita</span><h2>Acessar dashboard</h2></div><button type="button" className="icon-button" aria-label="Fechar" onClick={onClose}><X size={19} /></button></div>
      <label className="field"><span>Token de acesso</span><input type="password" inputMode="numeric" autoFocus value={token} onChange={(event) => { setToken(event.target.value); setInvalid(false) }} placeholder="••••••" /></label>
      {invalid && <span className="error-message">Token inválido.</span>}
      <button className="primary-button" type="submit" disabled={!token}>Entrar</button>
    </form>
  </div>
}

function ConnectionBadge({ connection }: { connection: Connection }) {
  const label = { loading: 'Conectando…', connected: 'Supabase conectado', error: 'Falha na consulta', unconfigured: 'Supabase não configurado' }[connection]
  return <div className={`connection ${connection}`}><span />{label}</div>
}

function FiltersDrawer({ rows, filters, onChange, onClose }: { rows: ResponseRow[]; filters: Filters; onChange: (filters: Filters) => void; onClose: () => void }) {
  const [draft, setDraft] = useState(filters)
  return <div className="modal-backdrop" onClick={onClose}>
    <aside className="filters-drawer" onClick={(event) => event.stopPropagation()}>
      <div className="drawer-heading"><div><span className="panel-label">Recorte</span><h2>Filtrar respostas</h2></div><button className="icon-button" aria-label="Fechar" onClick={onClose}><X size={19} /></button></div>
      {FILTER_FIELDS.map(({ key, label }) => <label key={key}>{label}
        <select value={draft[key] ?? ''} onChange={(event) => setDraft({ ...draft, [key]: event.target.value })}>
          <option value="">Todos</option>
          {optionsFor(rows, key).map((option) => <option key={option}>{option}</option>)}
        </select>
      </label>)}
      <div className="drawer-actions">
        <button className="ghost-button" onClick={() => setDraft({})}>Limpar</button>
        <button className="primary-button" onClick={() => { onChange(draft); onClose() }}>Aplicar filtros</button>
      </div>
    </aside>
  </div>
}

function ViewContent({ view, rows, summary }: { view: ViewId; rows: ResponseRow[]; summary: Summary }) {
  if (!rows.length) return <div className="panel empty-state">Nenhuma resposta no recorte selecionado.</div>
  switch (view) {
    case 'monitoring': return <Monitoring rows={rows} summary={summary} />
    case 'profile': return <Profile rows={rows} />
    case 'mobility': return <Mobility rows={rows} />
    case 'vehicles': return <Vehicles rows={rows} />
    case 'financing': return <Financing rows={rows} />
    case 'ev': return <ElectricVehicles rows={rows} />
    default: return <Overview rows={rows} />
  }
}

function Metric({ label, value, detail, icon }: { label: string; value: string; detail: string; icon: React.ReactNode }) {
  return <div className="metric-card"><div className="metric-top"><span className="metric-label">{label}</span><span className="metric-icon">{icon}</span></div><strong className="metric-value">{value}</strong><span className="metric-detail">{detail}</span></div>
}

function Section({ kicker, title, note, children }: { kicker: string; title: string; note?: string; children: React.ReactNode }) {
  return <section className="section"><div className="section-intro"><span className="section-kicker">{kicker}</span><h2>{title}</h2>{note && <p>{note}</p>}</div><div className="panel-grid">{children}</div></section>
}

function Overview({ rows }: { rows: ResponseRow[] }) {
  const frequentUsers = rows.filter((row) => row.weekly_vehicle_use === '5 a 6 dias' || row.weekly_vehicle_use === 'Todos os dias').length
  return <>
    <div className="metric-grid">
      <Metric label="Respostas elegíveis" value={String(rows.length)} detail="no recorte atual" icon={<Users size={17} />} />
      <Metric label="IDA médio" value={formatNumber(mean(rows, 'ida_score'))} detail="dependência do automóvel (0–100)" icon={<GaugeIcon size={17} />} />
      <Metric label="Usam carro 5+ dias/semana" value={formatPercent(share(frequentUsers, answered(rows, 'weekly_vehicle_use')))} detail="entre quem respondeu" icon={<Car size={17} />} />
      <Metric label="Readiness EV médio" value={formatNumber(mean(rows, 'ev_readiness_score'))} detail="prontidão para elétricos (0–100)" icon={<BatteryCharging size={17} />} />
    </div>
    <Section kicker="01 · Visão geral" title="O retrato do recorte" note="Indicadores recalculados automaticamente conforme os filtros ativos.">
      <Panel label="Coleta" title="Respostas nos últimos 30 dias" wide><DailyColumns items={dailyCounts(rows)} /></Panel>
      <Panel label="Leitura rápida" title="Principais insights" note="Não estabelecem causalidade."><Insights rows={rows} /></Panel>
      <Panel label="Dependência do automóvel" title="Distribuição por faixa IDA"><Donut items={countBy(rows, 'ida_band')} center={formatNumber(mean(rows, 'ida_score'))} caption="IDA médio" sequential /></Panel>
      <Panel label="Território" title="Respostas por região"><BarList items={countBy(rows, 'region')} base={answered(rows, 'region')} /></Panel>
      <Panel label="Propensão futura" title="Ranking de alternativas (próximos 3 anos)" note="Probabilidade média declarada: Improvável = 0 · Muito provável = 100."><BarList items={matrixMean(rows, 'mobility_intentions', SCALES.probability)} format="score" max={100} /></Panel>
    </Section>
  </>
}

function Insights({ rows }: { rows: ResponseRow[] }) {
  const insights: React.ReactNode[] = []
  const idaAvg = mean(rows, 'ida_score')
  const idaByRegion = meanBy(rows, 'region', 'ida_score').filter((item) => (item.n ?? 0) >= 3).sort((a, b) => b.value - a.value)
  if (idaAvg !== null && idaByRegion.length > 1) {
    insights.push(<><strong>{idaByRegion[0].label}</strong> tem o maior IDA médio ({formatNumber(idaByRegion[0].value)}), contra {formatNumber(idaAvg)} no recorte.</>)
  }
  const topFactor = matrixMean(rows, 'financing_factors', SCALES.relevance)[0]
  if (topFactor) insights.push(<>No financiamento, o fator mais relevante é <strong>{topFactor.label.toLowerCase()}</strong> (média {formatNumber(topFactor.value, 2)} de 5).</>)
  const negotiation = matrixCrossTab(rows, 'financing_journey')
  const inPerson = negotiation.cells['Negociar']?.['Presencial em concessionária/loja'] ?? 0
  const negotiationTotal = Object.values(negotiation.cells['Negociar'] ?? {}).reduce((sum, value) => sum + value, 0)
  if (negotiationTotal) insights.push(<><strong>{formatPercent(share(inPerson, negotiationTotal))}</strong> preferem negociar o financiamento presencialmente, mesmo usando canais digitais para pesquisar.</>)
  const evHigh = share(rows.filter((row) => row.ev_readiness_band === 'Alta').length, answered(rows, 'ev_readiness_band'))
  const charging = matrixShare(rows, 'ev_attitudes', ['Concordo parcialmente', 'Concordo totalmente']).find((item) => item.label.startsWith('Ter possibilidade de recarregar em casa'))
  if (evHigh !== null) insights.push(<><strong>{formatPercent(evHigh)}</strong> têm readiness EV alta{charging ? <>; <strong>{formatPercent(charging.value)}</strong> dizem que recarregar em casa aumentaria o interesse</> : null}.</>)
  if (!insights.length) return <p className="empty">Dados insuficientes para gerar insights.</p>
  return <ol className="insights">{insights.map((text, index) => <li key={index}><span>{String(index + 1).padStart(2, '0')}</span><p>{text}</p></li>)}</ol>
}

function Monitoring({ rows, summary }: { rows: ResponseRow[]; summary: Summary }) {
  const quality = ([
    ['Região', 'region'], ['Renda domiciliar', 'household_income'], ['Relação com veículo', 'vehicle_relationship'], ['Tempo de deslocamento', 'daily_commute_time'],
    ['Score IDA', 'ida_score'], ['Propensão a financiar', 'financing_propensity'], ['Parcela compatível', 'compatible_monthly_payment'], ['Readiness EV', 'ev_readiness_score'],
  ] as [string, RowKey][]).map(([label, key]) => ({ label, value: answered(rows, key) / rows.length * 100 }))
  return <>
    <div className="metric-grid">
      <Metric label="Respostas recebidas" value={summary ? String(summary.total) : '—'} detail="total no formulário" icon={<ClipboardList size={17} />} />
      <Metric label="Elegíveis" value={summary ? String(summary.eligible) : '—'} detail="45–61 anos, município de SP" icon={<Users size={17} />} />
      <Metric label="Fora do perfil" value={summary ? String(summary.ineligible) : '—'} detail="excluídas das análises" icon={<Info size={17} />} />
      <Metric label="Últimos 7 dias" value={String(dailyCounts(rows, 7).reduce((sum, item) => sum + item.value, 0))} detail="novas respostas elegíveis" icon={<Activity size={17} />} />
    </div>
    <Section kicker="02 · Monitoramento da coleta" title="Andamento da coleta" note="Ajuda a identificar onde a divulgação deve ser reforçada.">
      <Panel label="Ritmo" title="Respostas por dia (30 dias)" wide><DailyColumns items={dailyCounts(rows)} /></Panel>
      <Panel title="Distribuição por região"><BarList items={countBy(rows, 'region')} base={answered(rows, 'region')} /></Panel>
      <Panel title="Distribuição por faixa etária"><BarList items={countBy(rows, 'age_band')} base={rows.length} /></Panel>
      <Panel label="Qualidade" title="Preenchimento dos campos-chave" note='Ausentes, "Não se aplica" e "Não sei" não são convertidos em zero.' wide><BarList items={quality} format="percent" max={100} /></Panel>
    </Section>
  </>
}

function Profile({ rows }: { rows: ResponseRow[] }) {
  return <Section kicker="03 · Perfil dos respondentes" title="Quem está respondendo" note="Distribuição da base elegível filtrada por características sociodemográficas.">
    <Panel title="Região"><BarList items={countBy(rows, 'region')} base={answered(rows, 'region')} /></Panel>
    <Panel title="Faixa etária"><Donut items={countBy(rows, 'age_band')} center={String(rows.length)} caption="respostas" sequential /></Panel>
    <Panel title="Renda domiciliar"><BarList items={countBy(rows, 'household_income')} base={answered(rows, 'household_income')} /></Panel>
    <Panel title="Situação profissional"><BarList items={countBy(rows, 'employment_status')} base={answered(rows, 'employment_status')} /></Panel>
    <Panel title="Região × faixa etária" note="Número de respondentes em cada cruzamento." wide><Heatmap table={crossTab(rows, 'region', 'age_band')} /></Panel>
  </Section>
}

function Mobility({ rows }: { rows: ResponseRow[] }) {
  return <>
    <Section kicker="04 · Mobilidade e território" title="Como a Geração X se desloca" note="Os resultados indicam associação de padrões, não causalidade.">
      <Panel title="Tempo diário de deslocamento"><BarList items={countBy(rows, 'daily_commute_time')} base={answered(rows, 'daily_commute_time')} /></Panel>
      <Panel title="Disposição para caminhar"><BarList items={countBy(rows, 'walking_willingness')} base={answered(rows, 'walking_willingness')} /></Panel>
      <Panel title="Tempo de deslocamento por região" wide><Heatmap table={crossTab(rows, 'region', 'daily_commute_time')} /></Panel>
      <Panel title="Acesso a pé a partir da residência" note="% de respondentes que citaram cada opção."><BarList items={countBy(rows, 'walk_access')} base={answered(rows, 'walk_access')} /></Panel>
      <Panel title="Fatores de dependência do carro no bairro"><BarList items={countBy(rows, 'car_dependency_factors')} base={answered(rows, 'car_dependency_factors')} /></Panel>
      <Panel title="Atividades que exigem veículo"><BarList items={countBy(rows, 'car_required_activities')} base={answered(rows, 'car_required_activities')} /></Panel>
      <Panel title="Alternativas se o carro não estivesse disponível"><BarList items={countBy(rows, 'alternative_modes')} base={answered(rows, 'alternative_modes')} /></Panel>
      <Panel title="Fatores de escolha de transporte alternativo" wide><BarList items={countBy(rows, 'alternative_transport_factors')} base={answered(rows, 'alternative_transport_factors')} /></Panel>
    </Section>
    <Section kicker="05 · Índice de Dependência do Automóvel" title="IDA" note="0–33 baixa · 34–66 média · 67–100 alta. Combina dependência declarada, uso semanal, disposição a caminhar e acesso a pé ao transporte coletivo.">
      <Panel title="IDA médio do recorte"><Gauge value={mean(rows, 'ida_score')} bands={[['Baixa', 33], ['Média', 66], ['Alta', 100]]} /></Panel>
      <Panel title="Distribuição por faixa IDA"><Donut items={countBy(rows, 'ida_band')} center={String(answered(rows, 'ida_band'))} caption="respostas" sequential /></Panel>
      <Panel title="“Minha rotina depende de ter acesso a um carro”"><BarList items={countBy(rows, 'routine_depends_on_car')} base={answered(rows, 'routine_depends_on_car')} /></Panel>
      <Panel title="“Consigo me deslocar com alternativas ao carro”"><BarList items={countBy(rows, 'can_use_alternatives')} base={answered(rows, 'can_use_alternatives')} /></Panel>
      <Panel title="IDA médio por região"><BarList items={meanBy(rows, 'region', 'ida_score')} format="score" max={100} /></Panel>
      <Panel title="IDA médio por renda"><BarList items={meanBy(rows, 'household_income', 'ida_score')} format="score" max={100} /></Panel>
      <Panel title="IDA médio por faixa etária"><BarList items={meanBy(rows, 'age_band', 'ida_score')} format="score" max={100} /></Panel>
      <Panel title="IDA médio por relação com veículo"><BarList items={meanBy(rows, 'vehicle_relationship', 'ida_score')} format="score" max={100} /></Panel>
    </Section>
  </>
}

function Vehicles({ rows }: { rows: ResponseRow[] }) {
  const fields: [string, RowKey][] = [
    ['Relação com o veículo', 'vehicle_relationship'], ['Forma de aquisição', 'vehicle_acquisition'], ['Tipo de veículo', 'vehicle_type'],
    ['Motorização', 'vehicle_powertrain'], ['Ano do veículo', 'vehicle_year_range'], ['Outras pessoas que usam o veículo', 'vehicle_sharing'],
    ['Gasto mensal para manter o carro', 'monthly_vehicle_cost'], ['Dias de uso por semana', 'weekly_vehicle_use'],
    ['Importância de ser proprietário (1 a 5)', 'ownership_importance'],
  ]
  return <Section kicker="06 · Relação atual com veículos" title="Como se relacionam hoje com o automóvel">
    {fields.map(([title, key]) => <Panel key={key} title={title}><BarList items={countBy(rows, key)} base={answered(rows, key)} /></Panel>)}
    <Panel title="Probabilidade de cada alternativa nos próximos 3 anos" note="Score médio 0–100 · “Não se aplica” excluído." wide><BarList items={matrixMean(rows, 'mobility_intentions', SCALES.probability)} format="score" max={100} /></Panel>
  </Section>
}

function Financing({ rows }: { rows: ResponseRow[] }) {
  return <>
    <Section kicker="07 · Financiamento de veículos" title="Capacidade e disposição para financiar">
      <Panel title="Ranking dos fatores de financiamento" note="Relevância média de 1 (irrelevante) a 5 (muito relevante)." wide><BarList items={matrixMean(rows, 'financing_factors', SCALES.relevance)} format="scale" max={5} /></Panel>
      <Panel title="Parcela mensal compatível"><BarList items={countBy(rows, 'compatible_monthly_payment')} base={answered(rows, 'compatible_monthly_payment')} /></Panel>
      <Panel title="Percentual de entrada aceitável"><BarList items={countBy(rows, 'acceptable_down_payment')} base={answered(rows, 'acceptable_down_payment')} /></Panel>
      <Panel title="Renda × parcela mensal compatível" wide><Heatmap table={crossTab(rows, 'household_income', 'compatible_monthly_payment')} /></Panel>
      <Panel title="Propensão a financiar por região" note="Probabilidade de financiar um carro (0–100)."><BarList items={meanBy(rows, 'region', 'financing_propensity')} format="score" max={100} /></Panel>
      <Panel title="Propensão a financiar por faixa IDA" note="Probabilidade de financiar um carro (0–100)."><BarList items={meanBy(rows, 'ida_band', 'financing_propensity')} format="score" max={100} /></Panel>
    </Section>
    <Section kicker="08 · Confiança, jornada e canais" title="Como e onde financiar">
      <Panel title="Drivers de confiança" note="% que consideram o fator indispensável." wide><BarList items={matrixShare(rows, 'trust_drivers', ['Indispensável'])} format="percent" max={100} /></Panel>
      <Panel title="Jornada de financiamento" note="Formato preferido em cada etapa (nº de respondentes)." wide><Heatmap table={matrixCrossTab(rows, 'financing_journey')} /></Panel>
      <Panel title="Canais digitais preferidos"><BarList items={countBy(rows, 'digital_channels')} base={answered(rows, 'digital_channels')} /></Panel>
      <Panel title="Já é cliente de…" note="% da base que marcou “Já sou cliente / Possuo conta”."><BarList items={matrixShare(rows, 'institutions', ['Já sou cliente / Possuo conta'])} format="percent" max={100} /></Panel>
    </Section>
    <Section kicker="09 · Instituições e benefícios" title="Relacionamento com instituições financeiras">
      <Panel title="Relação com cada instituição" note="Nº de respondentes (múltipla escolha por instituição)." wide><Heatmap table={matrixCrossTab(rows, 'institutions', ['Já sou cliente / Possuo conta', 'Consideraria financiar um carro', 'Consideraria iniciar relacionamento por uma boa solução de mobilidade'])} /></Panel>
      <Panel title="Benefícios × tipo de solução" note="Para qual solução cada benefício aumentaria o interesse." wide><Heatmap table={matrixCrossTab(rows, 'benefits', ['Financiamento de carro', 'Aluguel/assinatura', 'Ambos', 'Não faria diferença'])} /></Panel>
    </Section>
  </>
}

function ElectricVehicles({ rows }: { rows: ResponseRow[] }) {
  return <Section kicker="10 · Veículos elétricos" title="Readiness EV" note="Média entre a viabilidade de recarga residencial e a disposição declarada a financiar um elétrico.">
    <Panel title="Readiness EV médio"><Gauge value={mean(rows, 'ev_readiness_score')} bands={[['Baixa', 33], ['Média', 66], ['Alta', 100]]} /></Panel>
    <Panel title="Faixas de readiness"><Donut items={countBy(rows, 'ev_readiness_band')} center={String(answered(rows, 'ev_readiness_band'))} caption="respostas" sequential /></Panel>
    <Panel title="Motivadores e barreiras" note="% que concordam (parcial ou totalmente) com cada afirmação." wide><BarList items={matrixShare(rows, 'ev_attitudes', ['Concordo parcialmente', 'Concordo totalmente'])} format="percent" max={100} /></Panel>
    <Panel title="Formas de acesso consideradas"><BarList items={countBy(rows, 'ev_access_options')} base={answered(rows, 'ev_access_options')} /></Panel>
    <Panel title="Situação de recarga residencial"><BarList items={countBy(rows, 'home_charging_status')} base={answered(rows, 'home_charging_status')} /></Panel>
    <Panel title="Soluções e benefícios mais relevantes" wide><BarList items={countBy(rows, 'ev_solutions')} base={answered(rows, 'ev_solutions')} /></Panel>
    <Panel title="Readiness EV × renda" wide><Heatmap table={crossTab(rows, 'household_income', 'ev_readiness_band')} /></Panel>
  </Section>
}

const initialForm = {
  ageBand: '', region: '', employment: '', income: '', vehicle: '', commute: '', weeklyUse: '', payment: '', consent: false,
}
type FormState = typeof initialForm

function SurveyForm({ onSaved }: { onSaved: () => void }) {
  const [form, setForm] = useState(initialForm)
  const [status, setStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle')
  const update = (key: keyof FormState, value: string | boolean) => { setForm((old) => ({ ...old, [key]: value })); if (status !== 'idle') setStatus('idle') }
  const select = (key: keyof FormState, options: string[], required = false) =>
    <select value={form[key] as string} onChange={(event) => update(key, event.target.value)} required={required}><option value="">Selecione</option>{options.map((option) => <option key={option}>{option}</option>)}</select>

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!form.consent) return
    setStatus('saving')
    const { error } = supabase ? await supabase.from('responses').insert({
      source: 'dashboard',
      age_band: form.ageBand,
      region: form.region,
      employment_status: form.employment || null,
      household_income: form.income || null,
      vehicle_relationship: form.vehicle || null,
      daily_commute_time: form.commute || null,
      weekly_vehicle_use: form.weeklyUse || null,
      compatible_monthly_payment: form.payment || null,
    }) : { error: new Error('Supabase não configurado') }
    if (error) { setStatus('error'); return }
    setStatus('success')
    setForm(initialForm)
    onSaved()
  }

  return <div className="form-page">
    <div className="page-heading"><div className="eyebrow">Pesquisa Geração X · São Paulo</div><h1>Sua mobilidade, seu contexto.</h1><p>Leva cerca de 2 minutos. Queremos entender como pessoas de 45 a 61 anos que moram na cidade de São Paulo se deslocam e o que esperam de soluções de mobilidade e financiamento. As respostas são analisadas apenas de forma agregada.</p></div>
    <form className="survey-form" onSubmit={submit}>
      <fieldset className="form-section"><legend><span>01</span>Sobre você</legend><div className="form-fields">
        <Field label="Qual sua faixa de idade?" required>{select('ageBand', ['44 anos ou menos', ...ORDER.age_band!, '62 anos ou mais'], true)}</Field>
        <Field label="Em qual região você mora?" required>{select('region', [...ORDER.region!, 'Não moro no município de São Paulo'], true)}</Field>
        <Field label="Situação profissional">{select('employment', ['Empregado(a) com carteira assinada (CLT)', 'Servidor(a)/Funcionário(a) público(a)', 'Profissional autônomo(a)', 'Empresário(a)', 'Aposentado(a)', 'Atualmente não exerço nenhuma atividade remunerada'])}</Field>
        <Field label="Renda mensal do domicílio">{select('income', ORDER.household_income!)}</Field>
      </div></fieldset>
      <fieldset className="form-section"><legend><span>02</span>Como você se desloca</legend><div className="form-fields">
        <Field label="Relação com o veículo que mais utiliza">{select('vehicle', ['Possuo 1 veículo próprio', 'Possuo 2 ou mais veículos próprios', 'Não possuo veículo próprio, mas utilizo veículo por assinatura', 'Não possuo veículo próprio, mas utilizo veículo por aluguel de longo prazo', 'Não possuo veículo próprio, mas utilizo regularmente veículo de familiares ou amigos', 'Não possuo nem utilizo veículo regularmente'])}</Field>
        <Field label="Tempo diário em deslocamentos">{select('commute', ORDER.daily_commute_time!)}</Field>
        <Field label="Dias por semana usando veículo particular">{select('weeklyUse', ORDER.weekly_vehicle_use!)}</Field>
        <Field label="Parcela mensal compatível (se financiasse)">{select('payment', ORDER.compatible_monthly_payment!)}</Field>
      </div></fieldset>
      <div className="form-submit">
        <label className="consent"><input type="checkbox" checked={form.consent} onChange={(event) => update('consent', event.target.checked)} required /><span>Concordo em participar da pesquisa e autorizo o uso das respostas de forma agregada.</span></label>
        <button className="primary-button" type="submit" disabled={status === 'saving'}>{status === 'saving' ? 'Salvando…' : <>Enviar respostas <Send size={15} /></>}</button>
        {status === 'success' && <span className="success-message"><Check size={15} /> Resposta registrada com sucesso.</span>}
        {status === 'error' && <span className="error-message">Não foi possível salvar. Confira a conexão e a tabela <code>responses</code> no Supabase.</span>}
      </div>
    </form>
  </div>
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return <label className="field"><span>{label}{required && <b>*</b>}</span>{children}</label>
}
