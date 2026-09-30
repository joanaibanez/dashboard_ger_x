'use client'

import { FormEvent, useEffect, useState } from 'react'
import {
  Activity, ArrowUpRight, BarChart3, BatteryCharging, Car, Check,
  ChevronDown, CircleDollarSign, ClipboardList, Gauge, Info, LayoutDashboard,
  Menu, Plus, Radio, Send, Settings2, ShieldCheck, Sparkles, Users, X,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'

const navItems = [
  { label: 'Visão geral', icon: LayoutDashboard },
  { label: 'Monitoramento', icon: Activity },
  { label: 'Perfil dos respondentes', icon: Users },
  { label: 'Mobilidade & território', icon: Radio },
  { label: 'Veículos', icon: Car },
  { label: 'Financiamento', icon: CircleDollarSign },
  { label: 'Veículos elétricos', icon: BatteryCharging },
]

const bars = [
  { label: 'Acesso ao transporte público', value: 78, color: 'orange' },
  { label: 'Custo e previsibilidade', value: 64, color: 'blue' },
  { label: 'Tempo de deslocamento', value: 57, color: 'teal' },
  { label: 'Conforto e segurança', value: 45, color: 'slate' },
]

const initialForm = {
  name: '', age: '', region: '', income: '', employment: '', vehicle: '', commute: '',
  evInterest: '', payment: '', consent: false,
}

type DashboardData = {
  count: number
  idaAvg: number | null
  evReadiness: number | null
  carUse: number | null
  avgAge: number | null
  connection: 'loading' | 'connected' | 'error' | 'unconfigured'
  regions: { label: string; value: number }[]
}

const emptyDashboard: DashboardData = {
  count: 0, idaAvg: null, evReadiness: null, carUse: null, avgAge: null,
  connection: 'loading', regions: [],
}

export default function Home() {
  const [activeView, setActiveView] = useState('Visão geral')
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [form, setForm] = useState(initialForm)
  const [status, setStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle')
  const [dashboardData, setDashboardData] = useState(emptyDashboard)

  useEffect(() => {
    if (!supabase) {
      setDashboardData((current) => ({ ...current, connection: 'unconfigured' }))
      return
    }
    supabase.from('responses').select('id, age, region, ida_score, ev_readiness_score, vehicle_relationship, created_at').eq('is_eligible', true).then(({ data, error }) => {
      if (error || !data) {
        setDashboardData((current) => ({ ...current, connection: 'error' }))
        return
      }
      const average = (values: number[]) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null
      const regions = data.reduce<Record<string, number>>((result, row) => {
        result[row.region] = (result[row.region] ?? 0) + 1
        return result
      }, {})
      setDashboardData({
        count: data.length,
        idaAvg: average(data.flatMap((row) => typeof row.ida_score === 'number' ? [row.ida_score] : [])),
        evReadiness: average(data.flatMap((row) => typeof row.ev_readiness_score === 'number' ? [row.ev_readiness_score] : [])),
        carUse: data.length ? data.filter((row) => row.vehicle_relationship === 'Tenho e uso regularmente').length / data.length * 100 : null,
        avgAge: average(data.map((row) => row.age)),
        connection: 'connected',
        regions: Object.entries(regions).map(([label, value]) => ({ label, value })).sort((left, right) => right.value - left.value),
      })
    })
  }, [])

  const updateForm = (key: keyof typeof initialForm, value: string | boolean) => {
    setForm((current) => ({ ...current, [key]: value }))
    if (status !== 'idle') setStatus('idle')
  }

  async function submitForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!form.consent) return
    setStatus('saving')
    const { consent: _consent, ...response } = form
    const { error } = supabase ? await supabase.from('responses').insert({
      respondent_name: response.name,
      age: Number(response.age),
      region: response.region,
      household_income: response.income || null,
      employment_status: response.employment || null,
      vehicle_relationship: response.vehicle || null,
      daily_commute_time: response.commute || null,
      ev_interest: response.evInterest || null,
      compatible_monthly_payment: response.payment || null,
    }) : { error: new Error('Supabase não configurado') }
    if (error) {
      setStatus('error')
      return
    }
    setDashboardData((current) => ({ ...current, count: current.count + 1 }))
    setStatus('success')
    setForm(initialForm)
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand"><span className="brand-mark"><Gauge size={18} /></span><span>norte<span className="brand-dot">.</span></span></div>
        <div className="workspace-switcher"><span className="workspace-avatar">GX</span><span><strong>Geração X</strong><small>Pesquisa São Paulo</small></span><ChevronDown size={15} /></div>
        <nav className="main-nav">
          <span className="nav-caption">PAINEL</span>
          {navItems.map(({ label, icon: Icon }) => <button key={label} className={activeView === label ? 'nav-item active' : 'nav-item'} onClick={() => setActiveView(label)}><Icon size={17} />{label}</button>)}
          <span className="nav-caption">AÇÕES</span>
          <button className={activeView === 'Novo formulário' ? 'nav-item active' : 'nav-item'} onClick={() => setActiveView('Novo formulário')}><ClipboardList size={17} />Novo formulário</button>
          <button className="nav-item" onClick={() => setFiltersOpen(true)}><Settings2 size={17} />Configurações</button>
        </nav>
        <div className="sidebar-footer"><div className="live-dot"><span /> coleta ativa</div><small>Atualizado agora</small><div className="user-profile"><span className="profile-avatar">JS</span><span><strong>Joana Silva</strong><small>Analista</small></span><ChevronDown size={14} /></div></div>
      </aside>

      <section className="content-area">
        <header className="topbar"><button className="mobile-menu" aria-label="Abrir menu"><Menu size={21} /></button><div className="breadcrumb">Pesquisa <span>/</span> <strong>{activeView}</strong></div><div className="top-actions"><span className="sync-status"><span /> Supabase conectado</span><button className="icon-button" aria-label="Configurações" onClick={() => setFiltersOpen(true)}><Settings2 size={19} /></button><button className="new-response" onClick={() => setActiveView('Novo formulário')}><Plus size={16} /> Responder pesquisa</button></div></header>
        {activeView === 'Novo formulário' ? <SurveyForm form={form} status={status} updateForm={updateForm} submitForm={submitForm} /> : <Dashboard data={dashboardData} filtersOpen={filtersOpen} setFiltersOpen={setFiltersOpen} />}
      </section>
    </main>
  )
}

function Dashboard({ data, filtersOpen, setFiltersOpen }: { data: DashboardData; filtersOpen: boolean; setFiltersOpen: (open: boolean) => void }) {
  const [activeFilter, setActiveFilter] = useState('Todos os respondentes')
  const formatScore = (value: number | null) => value === null ? '—' : value.toFixed(1).replace('.', ',')
  const formatPercent = (value: number | null) => value === null ? '—' : `${Math.round(value)}%`
  const connectionLabel = data.connection === 'connected' ? 'Supabase conectado' : data.connection === 'loading' ? 'Consultando Supabase...' : data.connection === 'error' ? 'Falha na consulta' : 'Supabase não configurado'
  return <>
    <div className="page-heading"><div><div className="eyebrow"><span className="eyebrow-line" /> PAINEL ANALÍTICO <span className="updated">• atualizado há 2 min</span></div><h1>Mobilidade sem <em>achismo.</em></h1><p>Uma leitura viva dos hábitos, necessidades e possibilidades da Geração X em São Paulo.</p></div><button className="export-button"><ArrowUpRight size={16} /> Exportar dados</button></div>
    <div className="filter-strip"><div className="filter-label"><Sparkles size={16} /> filtros ativos</div>{['Todos os respondentes', 'São Paulo', '45–61 anos'].map((item, index) => <button key={item} className={activeFilter === item ? 'filter-pill selected' : 'filter-pill'} onClick={() => setActiveFilter(item)}>{item}{index > 0 && <X size={13} />}</button>)}<button className="filter-more" onClick={() => setFiltersOpen(true)}>+ filtros <ChevronDown size={14} /></button></div>
    <div className="dashboard-body">
      <div className="section-intro"><div><span className="section-kicker">01 / Visão geral</span><h2>O retrato em uma página</h2></div><span className={`sample-note connection-${data.connection}`}><Info size={15} /> {connectionLabel} <strong>{data.count} respostas válidas</strong></span></div>
      <div className="metric-grid"><Metric label="IDA médio" value={formatScore(data.idaAvg)} delta="ao vivo" tone="orange" detail="dependência do automóvel" icon={<Gauge size={18} />} /><Metric label="Readiness EV" value={formatPercent(data.evReadiness)} delta="ao vivo" tone="teal" detail="prontos para elétricos" icon={<BatteryCharging size={18} />} /><Metric label="Usam carro" value={formatPercent(data.carUse)} delta="ao vivo" tone="blue" detail="com frequência regular" icon={<Car size={18} />} /><Metric label="Idade média" value={formatScore(data.avgAge)} delta="base elegível" tone="yellow" detail="anos no recorte" icon={<Users size={18} />} progress={data.avgAge ? Math.min(100, data.avgAge / 61 * 100) : undefined} /></div>
      <div className="content-grid"><article className="panel hero-chart"><div className="panel-heading"><div><span className="panel-label">DEPENDÊNCIA DO AUTOMÓVEL</span><h3>O carro ainda é o eixo central</h3></div><button className="period-select">Últimos 30 dias <ChevronDown size={14} /></button></div><div className="chart-stat"><strong>61,4</strong><span>IDA médio no recorte <b>↗ 4,2%</b></span></div><div className="line-chart"><div className="chart-y"><span>80</span><span>60</span><span>40</span><span>20</span><span>0</span></div><div className="chart-area"><div className="grid-lines" /><svg viewBox="0 0 620 170" preserveAspectRatio="none" role="img" aria-label="Evolução do IDA médio"><defs><linearGradient id="area" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#f3a33a" stopOpacity=".29" /><stop offset="1" stopColor="#f3a33a" stopOpacity="0" /></linearGradient></defs><path d="M0,126 C45,119 55,112 92,118 S145,96 177,105 S230,76 265,86 S312,65 346,76 S395,49 428,58 S475,42 506,51 S560,26 620,35 L620,170 L0,170 Z" fill="url(#area)" /><path d="M0,126 C45,119 55,112 92,118 S145,96 177,105 S230,76 265,86 S312,65 346,76 S395,49 428,58 S475,42 506,51 S560,26 620,35" fill="none" stroke="#e28724" strokeWidth="3" strokeLinecap="round" /></svg><div className="chart-x"><span>01 mai</span><span>08 mai</span><span>15 mai</span><span>22 mai</span><span>30 mai</span></div></div></div></article><article className="panel insight-panel"><div className="panel-heading"><div><span className="panel-label">LEITURA RÁPIDA</span><h3>O que está chamando atenção</h3></div><Sparkles size={20} className="sparkle" /></div><div className="insight-highlight"><span className="insight-number">01</span><div><h4>O acesso muda a escolha</h4><p>Quem leva mais de 60 min no deslocamento tem IDA <strong>21% maior</strong> que a média.</p></div></div><div className="insight-highlight"><span className="insight-number">02</span><div><h4>Elétrico ainda é possibilidade</h4><p><strong>42%</strong> já demonstra readiness, mas recarga é a principal barreira.</p></div></div><button className="text-link">Ver todos os insights <ArrowUpRight size={15} /></button></article></div>
      <div className="content-grid lower-grid"><article className="panel bars-panel"><div className="panel-heading"><div><span className="panel-label">DISTRIBUIÇÃO GEOGRÁFICA</span><h3>Onde a base está</h3></div><span className="live-tag">dados reais</span></div><div className="bar-list">{data.regions.slice(0, 4).map((region, index) => <div className="bar-row" key={region.label}><div><span>{region.label}</span><strong>{data.count ? Math.round(region.value / data.count * 100) : 0}%</strong></div><div className="bar-track"><span className={`bar-fill ${['orange', 'blue', 'teal', 'slate'][index]}`} style={{ width: `${data.count ? region.value / data.count * 100 : 0}%` }} /></div></div>)}</div><div className="panel-footnote"><Info size={14} /> região das respostas elegíveis</div></article><article className="panel segments-panel"><div className="panel-heading"><div><span className="panel-label">PERFIL DA BASE</span><h3>Quem está respondendo</h3></div><span className="live-tag">Supabase</span></div><div className="segment-chart"><div className="donut"><div className="donut-inner"><strong>{data.count}</strong><span>respostas</span></div></div><div className="legend">{data.regions.slice(0, 4).map((region, index) => <Legend key={region.label} color={['orange', 'blue', 'teal', 'slate'][index]} label={region.label} value={`${data.count ? Math.round(region.value / data.count * 100) : 0}%`} />)}</div></div><button className="text-link">Dados atualizados pelo BaaS <Check size={15} /></button></article></div>
    </div>
    {filtersOpen && <div className="modal-backdrop" onClick={() => setFiltersOpen(false)}><aside className="filters-drawer" onClick={(event) => event.stopPropagation()}><div className="drawer-heading"><div><span className="panel-label">CONFIGURAÇÃO</span><h2>Refine o recorte</h2></div><button className="icon-button" onClick={() => setFiltersOpen(false)}><X size={19} /></button></div><label>Região de São Paulo<select><option>Todas as regiões</option><option>Centro expandido</option><option>Zona leste</option><option>Zona sul</option></select></label><label>Renda domiciliar<select><option>Todas as faixas</option><option>Até R$ 4.000</option><option>R$ 4.001 a R$ 10.000</option><option>Acima de R$ 10.000</option></select></label><label>Relação com veículo<select><option>Todos</option><option>Possui e usa carro</option><option>Possui, não usa regularmente</option><option>Não possui</option></select></label><button className="apply-button" onClick={() => setFiltersOpen(false)}>Aplicar filtros <ArrowUpRight size={16} /></button></aside></div>}
  </>
}

function Metric({ label, value, delta, detail, tone, icon, progress }: { label: string; value: string; delta: string; detail: string; tone: string; icon: React.ReactNode; progress?: number }) { return <div className={`metric-card ${tone}`}><div className="metric-top"><span className="metric-icon">{icon}</span><span className="metric-delta">↗ {delta}</span></div><span className="metric-label">{label}</span><strong className="metric-value">{value}</strong>{progress ? <div className="metric-progress"><span style={{ width: `${progress}%` }} /></div> : <span className="metric-detail">{detail}</span>}</div> }
function Legend({ color, label, value }: { color: string; label: string; value: string }) { return <div className="legend-row"><span className={`legend-dot ${color}`} />{label}<strong>{value}</strong></div> }

type SurveyProps = { form: typeof initialForm; status: 'idle' | 'saving' | 'success' | 'error'; updateForm: (key: keyof typeof initialForm, value: string | boolean) => void; submitForm: (event: FormEvent<HTMLFormElement>) => void }
function SurveyForm({ form, status, updateForm, submitForm }: SurveyProps) { return <div className="form-page"><div className="form-heading"><div><div className="eyebrow"><span className="eyebrow-line" /> FORMULÁRIO AO VIVO</div><h1>Sua mobilidade, <em>seu contexto.</em></h1><p>Leva cerca de 4 minutos. Suas respostas ajudam a desenhar soluções que façam sentido para a vida real.</p></div><div className="form-progress"><span>01</span><div><div className="progress-track"><i /></div><small>perfil e mobilidade</small></div></div></div><form className="survey-form" onSubmit={submitForm}><div className="form-section"><div className="form-section-title"><span>01</span><div><h2>Sobre você</h2><p>Começamos pelo básico para contextualizar as respostas.</p></div></div><div className="form-fields"><Field label="Como podemos te chamar?" required><input value={form.name} onChange={(event) => updateForm('name', event.target.value)} placeholder="Seu primeiro nome" required /></Field><Field label="Qual a sua idade?" required><input type="number" min="45" max="61" value={form.age} onChange={(event) => updateForm('age', event.target.value)} placeholder="45–61" required /></Field><Field label="Em qual região você mora?" required><select value={form.region} onChange={(event) => updateForm('region', event.target.value)} required><option value="">Selecione</option><option>Centro expandido</option><option>Zona norte</option><option>Zona sul</option><option>Zona leste</option><option>Zona oeste</option></select></Field><Field label="Renda domiciliar mensal"><select value={form.income} onChange={(event) => updateForm('income', event.target.value)}><option value="">Prefiro não responder</option><option>Até R$ 4.000</option><option>R$ 4.001 a R$ 10.000</option><option>R$ 10.001 a R$ 20.000</option><option>Acima de R$ 20.000</option></select></Field></div></div><div className="form-section"><div className="form-section-title"><span>02</span><div><h2>Como você se desloca</h2><p>Não existe resposta certa. Queremos entender a rotina como ela é.</p></div></div><div className="form-fields"><Field label="Qual sua situação profissional?"><select value={form.employment} onChange={(event) => updateForm('employment', event.target.value)}><option value="">Selecione</option><option>Trabalho em período integral</option><option>Trabalho em período parcial</option><option>Autônomo(a)</option><option>Aposentado(a)</option><option>Outro</option></select></Field><Field label="Qual sua relação com carro?"><select value={form.vehicle} onChange={(event) => updateForm('vehicle', event.target.value)}><option value="">Selecione</option><option>Tenho e uso regularmente</option><option>Tenho, mas uso pouco</option><option>Não tenho, mas uso de terceiros</option><option>Não tenho e não uso</option></select></Field><Field label="Quanto tempo você leva por dia em deslocamentos?"><select value={form.commute} onChange={(event) => updateForm('commute', event.target.value)}><option value="">Selecione</option><option>Até 30 minutos</option><option>31 a 60 minutos</option><option>61 a 120 minutos</option><option>Mais de 120 minutos</option></select></Field><Field label="Se pudesse escolher, consideraria um veículo elétrico?"><select value={form.evInterest} onChange={(event) => updateForm('evInterest', event.target.value)}><option value="">Selecione</option><option>Sim, com certeza</option><option>Talvez</option><option>Ainda não</option></select></Field></div></div><div className="form-section compact-section"><div className="form-section-title"><span>03</span><div><h2>Preferências financeiras</h2><p>Uma última pergunta para fechar o retrato.</p></div></div><Field label="Qual parcela mensal seria confortável para você?"><select value={form.payment} onChange={(event) => updateForm('payment', event.target.value)}><option value="">Selecione</option><option>Até R$ 1.000</option><option>R$ 1.001 a R$ 2.000</option><option>R$ 2.001 a R$ 3.500</option><option>Acima de R$ 3.500</option></select></Field></div><div className="form-submit"><label className="consent"><input type="checkbox" checked={form.consent} onChange={(event) => updateForm('consent', event.target.checked)} required /><span>Concordo em participar da pesquisa e autorizo o uso das respostas de forma agregada.</span></label><button className="submit-button" type="submit" disabled={status === 'saving'}>{status === 'saving' ? 'Salvando...' : <>Enviar respostas <Send size={16} /></>}</button>{status === 'success' && <span className="success-message"><Check size={15} /> Resposta registrada com sucesso.</span>}{status === 'error' && <span className="error-message">Não foi possível salvar. Confira a tabela `responses` no Supabase.</span>}</div></form></div> }
function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) { return <label className="field"><span>{label}{required && <b>*</b>}</span>{children}</label> }
