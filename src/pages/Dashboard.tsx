import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import {
  TrendingUp, TrendingDown, Wallet, Target, LogOut,
  Calendar, RefreshCw, BarChart2, PieChart as PieIcon,
  ArrowUpRight, ArrowDownRight, Activity, Filter,
  CreditCard, Plus, List,
} from 'lucide-react';
import { supabase, authHelpers } from '../lib/supabase';
import type { Session } from '@supabase/supabase-js';
import ModalTransacao from '../components/ModalTransacao';

// ── Tipos ──────────────────────────────────────────────────────
interface Transacao {
  id: string;
  tipo_transacao: 'DESPESAS' | 'RECEITAS';
  referente: string;
  categoria_nome: string | null;
  especie: string | null;
  valor: number;
  data: string | null;
  data_text: string | null;
  created_at: string;
}

interface SummaryCard {
  label: string;
  value: number;
  icon: React.ReactNode;
  color: string;
  trend?: number;
  prefix?: string;
}

// ── Helpers ────────────────────────────────────────────────────
const fmt = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

const shortFmt = (v: number) => {
  if (v >= 1000) return `R$ ${(v / 1000).toFixed(1)}k`;
  return `R$ ${v.toFixed(0)}`;
};

const months = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

const COLORS_PIE = [
  '#00c896','#22d3ee','#a78bfa','#fb923c','#f472b6',
  '#34d399','#60a5fa','#facc15','#f87171','#94a3b8',
];

// ── Componente principal ───────────────────────────────────────
interface DashboardProps {
  session: Session;
  onOpenProfile: () => void;
  onOpenTransacoes: () => void;
}

const Dashboard: React.FC<DashboardProps> = ({ session, onOpenProfile, onOpenTransacoes }) => {
  const [transacoes, setTransacoes] = useState<Transacao[]>([]);
  const [loading, setLoading]       = useState(true);
  const [activeChart, setActiveChart] = useState<'area' | 'bar'>('area');
  const [avatarUrl, setAvatarUrl]   = useState<string | null>(null);  // avatar do header
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Filtros — padrão: últimos 12 meses
  const now = new Date();
  const [startDate, setStartDate] = useState(() => {
    const d = new Date(now.getFullYear(), now.getMonth() - 11, 1);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate]     = useState(() => now.toISOString().split('T')[0]);
  const [selectedCat, setSelectedCat] = useState('');  // '' = todas
  const [selectedEsp, setSelectedEsp] = useState('');  // '' = todas

  // ── Busca transações ─────────────────────────────────────────
  const fetchTransacoes = useCallback(async () => {
    setLoading(true);
    try {
      // Filtra pelo campo 'data' (data real da transação)
      const { data, error } = await supabase
        .from('transacoes')
        .select('id,tipo_transacao,referente,categoria_nome,especie,valor,data,data_text,created_at')
        .gte('data', `${startDate}T00:00:00+00:00`)
        .lte('data', `${endDate}T23:59:59+00:00`)
        .order('data', { ascending: true });

      if (error) throw error;
      setTransacoes((data ?? []) as Transacao[]);
    } catch (err) {
      console.error('Erro ao buscar transações:', err);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate]);

  useEffect(() => { fetchTransacoes(); }, [fetchTransacoes]);

  // ── Carrega avatar do perfil ──────────────────────────────
  useEffect(() => {
    authHelpers.getProfile(session.user.id).then(p => {
      if (p?.avatar_url) setAvatarUrl(p.avatar_url);
    });
  }, [session.user.id]);

  // ── Categorias e Espécies disponíveis (derivadas dos dados carregados) ──
  const availableCats = React.useMemo(() => {
    const set = new Set<string>();
    transacoes.forEach(t => { if (t.categoria_nome) set.add(t.categoria_nome); });
    return Array.from(set).sort();
  }, [transacoes]);

  const availableEsps = React.useMemo(() => {
    const set = new Set<string>();
    transacoes.forEach(t => { if (t.especie) set.add(t.especie); });
    return Array.from(set).sort();
  }, [transacoes]);

  // ── Aplica filtro (Categoria e Espécie) no frontend ──────────────────
  const filteredTransacoes = transacoes.filter(t => {
    const matchCat = selectedCat ? t.categoria_nome === selectedCat : true;
    const matchEsp = selectedEsp ? t.especie === selectedEsp : true;
    return matchCat && matchEsp;
  });

  // ── Cálculos derivados (usa filteredTransacoes) ─────────────────
  const receitas  = filteredTransacoes.filter(t => t.tipo_transacao === 'RECEITAS');
  const despesas  = filteredTransacoes.filter(t => t.tipo_transacao === 'DESPESAS');

  const totalReceitas = receitas.reduce((s, t) => s + Number(t.valor), 0);
  const totalDespesas = despesas.reduce((s, t) => s + Number(t.valor), 0);
  const saldo         = totalReceitas - totalDespesas;
  const taxaEconomia  = totalReceitas > 0 ? ((saldo / totalReceitas) * 100) : 0;

  // Dados por mês (filteredTransacoes)
  const monthlyMap: Record<string, { key: string; mes: string; receitas: number; despesas: number }> = {};
  filteredTransacoes.forEach(t => {
    const d = new Date(t.data ?? t.created_at);
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
    const label = `${months[d.getUTCMonth()]}/${String(d.getUTCFullYear()).slice(2)}`;
    if (!monthlyMap[key]) monthlyMap[key] = { key, mes: label, receitas: 0, despesas: 0 };
    if (t.tipo_transacao === 'RECEITAS') monthlyMap[key].receitas += Number(t.valor);
    else                                 monthlyMap[key].despesas += Number(t.valor);
  });
  const monthlyData = Object.values(monthlyMap).sort((a, b) => a.key.localeCompare(b.key));

  // Despesas por categoria (filteredTransacoes)
  const catMap: Record<string, number> = {};
  filteredTransacoes.filter(t => t.tipo_transacao === 'DESPESAS').forEach(t => {
    const cat = t.categoria_nome ?? 'Outros';
    catMap[cat] = (catMap[cat] ?? 0) + Number(t.valor);
  });
  const pieData = Object.entries(catMap)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);

  // Últimas transações
  const recentTransacoes = [...filteredTransacoes]
    .sort((a, b) => new Date(b.data ?? b.created_at).getTime() - new Date(a.data ?? a.created_at).getTime())
    .slice(0, 7);

  // Cards sumário
  const cards: SummaryCard[] = [
    {
      label: 'Receitas',
      value: totalReceitas,
      icon: <TrendingUp size={20} />,
      color: '#00c896',
      trend: receitas.length,
      prefix: 'lançamentos',
    },
    {
      label: 'Despesas',
      value: totalDespesas,
      icon: <TrendingDown size={20} />,
      color: '#f87171',
      trend: despesas.length,
      prefix: 'lançamentos',
    },
    {
      label: 'Saldo',
      value: saldo,
      icon: <Wallet size={20} />,
      color: saldo >= 0 ? '#22d3ee' : '#fb923c',
    },
    {
      label: 'Taxa de Economia',
      value: taxaEconomia,
      icon: <Target size={20} />,
      color: '#a78bfa',
      prefix: '%',
    },
  ];

  // ── Tooltip customizado ──────────────────────────────────────
  const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string }) => {
    if (!active || !payload?.length) return null;
    return (
      <div style={{
        background: '#0f1e35', border: '1px solid #1e3255', borderRadius: 10,
        padding: '10px 14px', fontSize: 12,
      }}>
        <p style={{ color: '#8899bb', marginBottom: 6, fontWeight: 600 }}>{label}</p>
        {payload.map((p, i) => (
          <p key={i} style={{ color: p.color, marginBottom: 2 }}>
            {p.name}: <strong>{fmt(p.value)}</strong>
          </p>
        ))}
      </div>
    );
  };

  const PieTooltip = ({ active, payload }: { active?: boolean; payload?: Array<{ name: string; value: number }> }) => {
    if (!active || !payload?.length) return null;
    return (
      <div style={{ background: '#0f1e35', border: '1px solid #1e3255', borderRadius: 10, padding: '8px 12px', fontSize: 12 }}>
        <p style={{ color: '#f0f4ff', fontWeight: 600 }}>{payload[0].name}</p>
        <p style={{ color: '#00c896' }}>{fmt(payload[0].value)}</p>
      </div>
    );
  };

  // ── Animações ────────────────────────────────────────────────
  const fadeUp = {
    hidden:  { opacity: 0, y: 20 },
    visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.07, duration: 0.4 } }),
  };

  return (
    <div className="dashboard-shell">
      {/* ════ HEADER ════ */}
      <header className="dashboard-header">
        <div className="dashboard-header__brand">
          <img src="/logo_meuBolso.png" alt="MeuBolso.digital" style={{ height: 50, objectFit: 'contain' }} />
        </div>

        <div className="dashboard-header__title">
          <Activity size={18} style={{ color: 'var(--color-brand-cyan)' }} />
          <span style={{ fontSize: '18px', fontWeight: 600, color: 'var(--color-text-primary)' }}>Visão Geral Financeira</span>
        </div>

        <div className="dashboard-header__right">
          <button
            className="btn btn--primary btn--auto"
            style={{ fontSize: 13, gap: 6 }}
            onClick={() => setIsModalOpen(true)}
          >
            <Plus size={16} /> Nova Transação
          </button>

          <button
            className="btn btn--secondary btn--auto"
            style={{ fontSize: 13, gap: 6 }}
            onClick={onOpenTransacoes}
            title="Ver e gerenciar todas as transações"
          >
            <List size={16} /> Transações
          </button>

          {/* Avatar clicável */}
          <button
            onClick={onOpenProfile}
            title={`Perfil: ${session.user.email}`}
            style={{
              width: 38, height: 38, borderRadius: '50%',
              border: '2px solid var(--color-border)',
              background: 'linear-gradient(135deg, #00c896, #22d3ee)',
              cursor: 'pointer', padding: 0, overflow: 'hidden',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'border-color 0.2s, transform 0.2s',
              flexShrink: 0,
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--color-brand-cyan)'; (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1.07)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--color-border)'; (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)'; }}
          >
            {avatarUrl
              ? <img src={avatarUrl} alt="Avatar"
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : <span style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>
                  {(session.user.email?.[0] ?? '?').toUpperCase()}
                </span>
            }
          </button>
          <button
            className="btn btn--ghost btn--auto"
            onClick={() => authHelpers.signOut()}
            title="Sair"
          >
            <LogOut size={14} /> Sair
          </button>
        </div>
      </header>

      <main className="dashboard-main">

        {/* ════ FILTROS ════ */}
        <motion.div className="dashboard-filters" variants={fadeUp} custom={0} initial="hidden" animate="visible">

          {/* Data De */}
          <div className="filter-group">
            <Calendar size={14} style={{ color: 'var(--color-brand-cyan)' }} />
            <label>De</label>
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
              className="filter-input" />
          </div>

          {/* Data Até */}
          <div className="filter-group">
            <Calendar size={14} style={{ color: 'var(--color-brand-cyan)' }} />
            <label>Até</label>
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
              className="filter-input" />
          </div>

          {/* Categoria */}
          <div className="filter-group">
            <Filter size={14} style={{ color: 'var(--color-brand-cyan)' }} />
            <label>Categoria</label>
            <select
              value={selectedCat}
              onChange={e => setSelectedCat(e.target.value)}
              className="filter-input"
              style={{ minWidth: 150 }}
            >
              <option value="">Todas as categorias</option>
              {availableCats.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          {/* Espécie */}
          <div className="filter-group">
            <CreditCard size={14} style={{ color: 'var(--color-brand-cyan)' }} />
            <label>Espécie</label>
            <select
              value={selectedEsp}
              onChange={e => setSelectedEsp(e.target.value)}
              className="filter-input"
              style={{ minWidth: 140 }}
            >
              <option value="">Todas</option>
              {availableEsps.map(esp => (
                <option key={esp} value={esp}>{esp}</option>
              ))}
            </select>
          </div>

          <button className="btn btn--secondary btn--auto" onClick={fetchTransacoes} disabled={loading}>
            <RefreshCw size={14} className={loading ? 'spin' : ''} />
            {loading ? 'Carregando...' : 'Atualizar'}
          </button>

          <span className="filter-total">
            {filteredTransacoes.length} transações
            {(selectedCat || selectedEsp) && <span style={{ color: 'var(--color-brand-cyan)' }}> filtradas</span>}
          </span>

        </motion.div>

        {/* ════ CARDS INDICADORES ════ */}
        <div className="dashboard-cards">
          {cards.map((card, i) => (
            <motion.div key={card.label} className="kpi-card"
              variants={fadeUp} custom={i + 1} initial="hidden" animate="visible">
              <div className="kpi-card__header">
                <span className="kpi-card__label">{card.label}</span>
                <div className="kpi-card__icon" style={{ color: card.color, background: `${card.color}18` }}>
                  {card.icon}
                </div>
              </div>
              <div className="kpi-card__value" style={{ color: card.color }}>
                {card.label === 'Taxa de Economia'
                  ? `${card.value.toFixed(1)}%`
                  : fmt(card.value)
                }
              </div>
              {card.trend !== undefined && (
                <div className="kpi-card__trend">
                  {card.trend > 0
                    ? <ArrowUpRight size={12} style={{ color: card.color }} />
                    : <ArrowDownRight size={12} style={{ color: '#f87171' }} />
                  }
                  <span>{card.trend} {card.prefix}</span>
                </div>
              )}
              {card.label === 'Saldo' && (
                <div className="kpi-card__trend">
                  <span style={{ color: saldo >= 0 ? '#00c896' : '#f87171' }}>
                    {saldo >= 0 ? '▲ Positivo' : '▼ Negativo'}
                  </span>
                </div>
              )}
            </motion.div>
          ))}
        </div>

        {/* ════ GRÁFICO PRINCIPAL ════ */}
        <motion.div className="chart-card" variants={fadeUp} custom={5} initial="hidden" animate="visible">
          <div className="chart-card__header">
            <div>
              <h2 className="chart-card__title">Evolução Mensal</h2>
              <p className="chart-card__subtitle">Receitas vs Despesas por período</p>
            </div>
            <div className="chart-toggle">
              <button
                className={`chart-toggle__btn ${activeChart === 'area' ? 'active' : ''}`}
                onClick={() => setActiveChart('area')}
              >
                <Activity size={14} /> Área
              </button>
              <button
                className={`chart-toggle__btn ${activeChart === 'bar' ? 'active' : ''}`}
                onClick={() => setActiveChart('bar')}
              >
                <BarChart2 size={14} /> Barras
              </button>
            </div>
          </div>

          {monthlyData.length === 0 ? (
            <EmptyState message="Nenhuma transação no período selecionado" />
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              {activeChart === 'area' ? (
                <AreaChart data={monthlyData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gradReceitas" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#00c896" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#00c896" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gradDespesas" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#f87171" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#f87171" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e3255" />
                  <XAxis dataKey="mes" tick={{ fill: '#8899bb', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={shortFmt} tick={{ fill: '#8899bb', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend formatter={v => <span style={{ color: '#8899bb', fontSize: 12 }}>{v}</span>} />
                  <Area type="monotone" dataKey="receitas" name="Receitas" stroke="#00c896" strokeWidth={2} fill="url(#gradReceitas)" dot={{ r: 3, fill: '#00c896' }} />
                  <Area type="monotone" dataKey="despesas" name="Despesas" stroke="#f87171"  strokeWidth={2} fill="url(#gradDespesas)"  dot={{ r: 3, fill: '#f87171' }} />
                </AreaChart>
              ) : (
                <BarChart data={monthlyData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e3255" />
                  <XAxis dataKey="mes" tick={{ fill: '#8899bb', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={shortFmt} tick={{ fill: '#8899bb', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend formatter={v => <span style={{ color: '#8899bb', fontSize: 12 }}>{v}</span>} />
                  <Bar dataKey="receitas" name="Receitas" fill="#00c896" radius={[4,4,0,0]} />
                  <Bar dataKey="despesas" name="Despesas" fill="#f87171"  radius={[4,4,0,0]} />
                </BarChart>
              )}
            </ResponsiveContainer>
          )}
        </motion.div>

        {/* ════ LINHA INFERIOR: Pizza + Transações recentes ════ */}
        <div className="dashboard-bottom">

          {/* Pizza por categoria */}
          <motion.div className="chart-card" variants={fadeUp} custom={6} initial="hidden" animate="visible">
            <div className="chart-card__header">
              <div>
                <h2 className="chart-card__title">Despesas por Categoria</h2>
                <p className="chart-card__subtitle">Distribuição percentual</p>
              </div>
              <PieIcon size={16} style={{ color: 'var(--color-brand-cyan)' }} />
            </div>

          {pieData.length === 0 ? (
              <EmptyState message="Nenhuma despesa registrada" />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {/* Gráfico maior centralizado */}
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%" cy="50%"
                      innerRadius={80} outerRadius={130}
                      dataKey="value"
                      paddingAngle={2}
                    >
                      {pieData.map((_, i) => (
                        <Cell key={i} fill={COLORS_PIE[i % COLORS_PIE.length]} />
                      ))}
                    </Pie>
                    <Tooltip content={<PieTooltip />} />
                  </PieChart>
                </ResponsiveContainer>

                {/* Legendas em grid na parte inferior */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
                  gap: '8px 16px',
                  borderTop: '1px solid var(--color-border)',
                  paddingTop: 14,
                }}>
                  {pieData.map((item, i) => {
                    const pct = totalDespesas > 0 ? ((item.value / totalDespesas) * 100).toFixed(1) : '0';
                    return (
                      <div key={item.name} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ width: 10, height: 10, borderRadius: '50%', background: COLORS_PIE[i % COLORS_PIE.length], flexShrink: 0 }} />
                        <div style={{ minWidth: 0 }}>
                          <p style={{ fontSize: 12, color: 'var(--color-text-primary)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</p>
                          <p style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{fmt(item.value)} &bull; {pct}%</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </motion.div>

          {/* Transações recentes */}
          <motion.div className="chart-card" variants={fadeUp} custom={7} initial="hidden" animate="visible">
            <div className="chart-card__header">
              <div>
                <h2 className="chart-card__title">Últimas Transações</h2>
                <p className="chart-card__subtitle">Mais recentes do período</p>
              </div>
              <Activity size={16} style={{ color: 'var(--color-brand-cyan)' }} />
            </div>

            {recentTransacoes.length === 0 ? (
              <EmptyState message="Nenhuma transação encontrada" />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {recentTransacoes.map(t => {
                  const isRec = t.tipo_transacao === 'RECEITAS';
                  const d = (() => {
                    const val = t.data ?? t.created_at;
                    if (!val) return new Date();
                    const dateVal = val.includes('T') ? val : `${val}T12:00:00`;
                    return new Date(dateVal);
                  })();
                  return (
                    <div key={t.id} className="tx-row">
                      <div className="tx-row__icon" style={{ background: isRec ? '#00c89620' : '#f8717120', color: isRec ? '#00c896' : '#f87171' }}>
                        {isRec ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p className="tx-row__label">{t.referente}</p>
                        <p className="tx-row__cat">
                          {t.categoria_nome ?? '—'} <span style={{ opacity: 0.6 }}>({t.especie ?? '—'})</span> &bull; {d.toLocaleDateString('pt-BR')}
                        </p>
                      </div>
                      <span className="tx-row__value" style={{ color: isRec ? '#00c896' : '#f87171' }}>
                        {isRec ? '+' : '-'}{fmt(Number(t.valor))}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </motion.div>

        </div>
      </main>

      {/* Modal de Nova Transação */}
      {isModalOpen && (
        <ModalTransacao
          userId={session.user.id}
          onClose={() => setIsModalOpen(false)}
          onSuccess={() => {
            setIsModalOpen(false);
            fetchTransacoes();
          }}
        />
      )}
    </div>
  );
};

// ── Empty state ────────────────────────────────────────────────
const EmptyState: React.FC<{ message: string }> = ({ message }) => (
  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    height: 180, gap: 8, color: 'var(--color-text-muted)' }}>
    <BarChart2 size={32} strokeWidth={1} />
    <p style={{ fontSize: 13 }}>{message}</p>
  </div>
);

export default Dashboard;
