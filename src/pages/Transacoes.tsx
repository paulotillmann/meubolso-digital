import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Search, Calendar, Filter, CreditCard,
  Pencil, Trash2, ChevronLeft, ChevronRight, RefreshCw,
  ArrowUpRight, ArrowDownRight, AlertTriangle, X,
  ListFilter, TrendingUp, TrendingDown, FileText, FileDown,
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { supabase } from '../lib/supabase';
import type { Session } from '@supabase/supabase-js';
import ModalEditarTransacao from '../components/ModalEditarTransacao';
import ThemeToggle from '../components/ThemeToggle';

// ── Tipos ──────────────────────────────────────────────────────
interface Transacao {
  id: string;
  tipo_transacao: 'DESPESAS' | 'RECEITAS';
  referente: string;
  categoria_nome: string | null;
  especie: string | null;
  especie_id: string | null;
  valor: number;
  data: string | null;
  data_text: string | null;
  created_at: string;
}

interface Especie {
  id: string;
  descricao: string;
  nao_calcula_saldo: boolean;
}

interface TransacoesProps {
  session: Session;
  onBack: () => void;
}

// ── Helpers ────────────────────────────────────────────────────
const fmt = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

const ITEMS_PER_PAGE = 15;

// ── Componente Principal ───────────────────────────────────────
const Transacoes: React.FC<TransacoesProps> = ({ session, onBack }) => {
  // Estado de dados
  const [transacoes, setTransacoes] = useState<Transacao[]>([]);
  const [especiesList, setEspeciesList] = useState<Especie[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Helper timezone-safe YYYY-MM-DD
  const getLocalDateString = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  // Filtros — padrão: Mês atual
  const [startDate, setStartDate] = useState(() => {
    const now = new Date();
    return getLocalDateString(new Date(now.getFullYear(), now.getMonth(), 1));
  });
  const [endDate, setEndDate] = useState(() => {
    const now = new Date();
    return getLocalDateString(new Date(now.getFullYear(), now.getMonth() + 1, 0));
  });

  const handleMesAtual = () => {
    const now = new Date();
    setStartDate(getLocalDateString(new Date(now.getFullYear(), now.getMonth(), 1)));
    setEndDate(getLocalDateString(new Date(now.getFullYear(), now.getMonth() + 1, 0)));
  };
  const [busca, setBusca] = useState('');
  const [selectedTipo, setSelectedTipo] = useState('');   // '' | 'RECEITAS' | 'DESPESAS'
  const [selectedCat, setSelectedCat] = useState('');
  const [selectedEsp, setSelectedEsp] = useState('');

  // Paginação
  const [currentPage, setCurrentPage] = useState(1);

  // Modais
  const [editando, setEditando] = useState<Transacao | null>(null);
  const [excluindo, setExcluindo] = useState<Transacao | null>(null);
  const [loadingDelete, setLoadingDelete] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  // ── Busca ─────────────────────────────────────────────────────
  const fetchTransacoes = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [resTrans, resEsp] = await Promise.all([
        supabase
          .from('transacoes')
          .select('id,tipo_transacao,referente,categoria_nome,especie,especie_id,valor,data,data_text,created_at')
          .gte('data', `${startDate}T00:00:00+00:00`)
          .lte('data', `${endDate}T23:59:59+00:00`)
          .order('data', { ascending: false }),
        supabase
          .from('especies')
          .select('id,descricao,nao_calcula_saldo')
      ]);

      if (resTrans.error) throw resTrans.error;
      if (resEsp.error) throw resEsp.error;

      setTransacoes((resTrans.data ?? []) as Transacao[]);
      setEspeciesList((resEsp.data ?? []) as Especie[]);
      setCurrentPage(1);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Erro ao carregar transações.');
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate]);

  useEffect(() => { fetchTransacoes(); }, [fetchTransacoes]);

  // ── Derivações ────────────────────────────────────────────────
  const availableCats = useMemo(() => {
    const set = new Set<string>();
    transacoes.forEach(t => { if (t.categoria_nome) set.add(t.categoria_nome); });
    return Array.from(set).sort();
  }, [transacoes]);

  const availableEsps = useMemo(() => {
    const set = new Set<string>();
    transacoes.forEach(t => { if (t.especie) set.add(t.especie); });
    return Array.from(set).sort();
  }, [transacoes]);

  // Filtragem client-side (busca por referente + tipo + cat + esp)
  const filtered = useMemo(() => {
    const termo = busca.toLowerCase().trim();
    return transacoes.filter(t => {
      const matchBusca = termo ? t.referente.toLowerCase().includes(termo) : true;
      const matchTipo = selectedTipo ? t.tipo_transacao === selectedTipo : true;
      const matchCat = selectedCat ? t.categoria_nome === selectedCat : true;
      const matchEsp = selectedEsp ? t.especie === selectedEsp : true;
      return matchBusca && matchTipo && matchCat && matchEsp;
    });
  }, [transacoes, busca, selectedTipo, selectedCat, selectedEsp]);

  // ── IDs de espécies que não devem compor saldo (via FK) ─────
  const ignoredEspecieIds = React.useMemo(() => {
    return new Set(especiesList.filter(e => e.nao_calcula_saldo).map(e => e.id));
  }, [especiesList]);

  const isIgnoredTx = (t: Transacao) => t.especie_id != null && ignoredEspecieIds.has(t.especie_id);

  // Totais do filtro para Exibição (mostra TUDO que está filtrado)
  const { totalReceitas, receitasCount } = useMemo(() => {
    const recs = filtered.filter(t => t.tipo_transacao === 'RECEITAS');
    return {
      totalReceitas: recs.reduce((s, t) => s + Number(t.valor), 0),
      receitasCount: recs.length
    };
  }, [filtered]);

  const { totalDespesas, despesasCount } = useMemo(() => {
    const desps = filtered.filter(t => t.tipo_transacao === 'DESPESAS');
    return {
      totalDespesas: desps.reduce((s, t) => s + Number(t.valor), 0),
      despesasCount: desps.length
    };
  }, [filtered]);

  // Totais para calcular o Saldo (ignora as espécies configuradas como nao_calcula_saldo)
  const saldoCalculado = useMemo(() => {
    const rec = filtered
      .filter(t => t.tipo_transacao === 'RECEITAS' && !isIgnoredTx(t))
      .reduce((s, t) => s + Number(t.valor), 0);
    const desp = filtered
      .filter(t => t.tipo_transacao === 'DESPESAS' && !isIgnoredTx(t))
      .reduce((s, t) => s + Number(t.valor), 0);
    return rec - desp;
  }, [filtered, ignoredEspecieIds]);

  // ── Exportação ────────────────────────────────────────────────
  const exportarCSV = () => {
    if (filtered.length === 0) return;
    const headers = ['Data', 'Referente', 'Categoria', 'Espécie', 'Tipo', 'Valor'];
    const rows = filtered.map(t => {
      const val = t.data ?? t.created_at;
      let dataTx = t.data_text ?? '-';
      if (val) {
        const d = new Date(val.includes('T') ? val : `${val}T12:00:00`);
        if (!isNaN(d.getTime())) dataTx = d.toLocaleDateString('pt-BR');
      }
      return [
        dataTx,
        `"${t.referente}"`,
        `"${t.categoria_nome || ''}"`,
        `"${t.especie || ''}"`,
        t.tipo_transacao === 'RECEITAS' ? 'Receita' : 'Despesa',
        `"${fmt(Number(t.valor)).replace(/\u00A0/g, ' ')}"`
      ];
    });
    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + [headers.join(';'), ...rows.map(e => e.join(';'))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `extrato_${new Date().toISOString().substring(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportarPDF = () => {
    if (filtered.length === 0) return;
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text('Extrato de Movimentações - MeuBolso.digital', 14, 20);
    doc.setFontSize(10);
    doc.text(`Período selecionado: ${startDate.split('-').reverse().join('/')} a ${endDate.split('-').reverse().join('/')}`, 14, 28);
    
    // Resume totais
    doc.text(`Total Filtrado: ${filtered.length} transações`, 14, 34);
    doc.text(`Receitas: ${fmt(totalReceitas)}`, 14, 40);
    doc.text(`Despesas: ${fmt(totalDespesas)}`, 14, 46);
    doc.text(`Saldo do Período: ${fmt(saldoCalculado)}`, 14, 52);

    const tableColumn = ["Data", "Referente", "Categoria", "Espécie", "Tipo", "Valor"];
    const tableRows = filtered.map(t => {
      const val = t.data ?? t.created_at;
      let dataTx = t.data_text ?? '-';
      if (val) {
        const d = new Date(val.includes('T') ? val : `${val}T12:00:00`);
        if (!isNaN(d.getTime())) dataTx = d.toLocaleDateString('pt-BR');
      }
      return [
        dataTx,
        t.referente,
        t.categoria_nome || '-',
        t.especie || '-',
        t.tipo_transacao === 'RECEITAS' ? 'Receita' : 'Despesa',
        fmt(Number(t.valor)).replace(/\u00A0/g, ' ')
      ];
    });

    autoTable(doc, {
      startY: 60,
      head: [tableColumn],
      body: tableRows,
      theme: 'grid',
      headStyles: { fillColor: [15, 30, 53] },
      alternateRowStyles: { fillColor: [244, 246, 248] },
      styles: { fontSize: 8 },
    });

    doc.save(`extrato_${new Date().toISOString().substring(0, 10)}.pdf`);
  };

  // Paginação
  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  const paginated = filtered.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  // Reset de página ao filtrar
  useEffect(() => { setCurrentPage(1); }, [busca, selectedTipo, selectedCat, selectedEsp]);

  // ── Exclusão ──────────────────────────────────────────────────
  const handleDelete = async () => {
    if (!excluindo) return;
    setLoadingDelete(true);
    setDeleteError('');
    try {
      const { error: deleteErr } = await supabase
        .from('transacoes')
        .delete()
        .eq('id', excluindo.id);
      if (deleteErr) throw deleteErr;
      setExcluindo(null);
      fetchTransacoes();
    } catch (err: any) {
      setDeleteError(err.message || 'Erro ao excluir.');
    } finally {
      setLoadingDelete(false);
    }
  };

  // ── Animações ──────────────────────────────────────────────────
  const fadeUp = {
    hidden: { opacity: 0, y: 16 },
    visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.05, duration: 0.35 } }),
  };

  // ── Render ────────────────────────────────────────────────────
  return (
    <div className="dashboard-shell">

      {/* ════ HEADER ════ */}
      <header className="dashboard-header">
        <div className="dashboard-header__brand">
          <img src="/logo_meuBolso.png" alt="MeuBolso.digital" style={{ height: 50, objectFit: 'contain' }} />
        </div>

        <div className="dashboard-header__title">
          <ListFilter size={18} style={{ color: 'var(--color-brand-cyan)' }} />
          <span style={{ fontSize: '18px', fontWeight: 600, color: 'var(--color-text-primary)' }}>
            Gerenciar Transações
          </span>
        </div>

        <div className="dashboard-header__right" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <ThemeToggle />
          <button className="btn-back" onClick={onBack} style={{ marginRight: 8 }}>
            <ArrowLeft size={15} />
            Voltar ao Dashboard
          </button>
        </div>
      </header>

      <main className="dashboard-main">


        {/* ════ BARRA DE FILTROS ════ */}
        <motion.div
          className="tx-filters-bar"
          variants={fadeUp} custom={0} initial="hidden" animate="visible"
        >
          {/* Busca por referente */}
          <div className="tx-search-wrapper" style={{ minWidth: 'auto', flex: '0 0 180px' }}>
            <Search size={15} className="tx-search-icon" />
            <input
              id="tx-busca"
              type="text"
              className="filter-input tx-search-input"
              placeholder="Buscar..."
              value={busca}
              onChange={e => setBusca(e.target.value)}
            />
            {busca && (
              <button className="tx-search-clear" onClick={() => setBusca('')}>
                <X size={13} />
              </button>
            )}
          </div>

          {/* Data De */}
          <div className="filter-group">
            <Calendar size={14} style={{ color: 'var(--color-brand-cyan)' }} />
            <label>De</label>
            <input
              type="date" className="filter-input"
              value={startDate} onChange={e => setStartDate(e.target.value)}
            />
          </div>

          {/* Data Até */}
          <div className="filter-group">
            <Calendar size={14} style={{ color: 'var(--color-brand-cyan)' }} />
            <label>Até</label>
            <input
              type="date" className="filter-input"
              value={endDate} onChange={e => setEndDate(e.target.value)}
            />
          </div>

          {/* Tipo */}
          <div className="filter-group">
            <Filter size={13} style={{ color: 'var(--color-brand-cyan)' }} />
            <label>Tipo</label>
            <select
              className="filter-input"
              value={selectedTipo}
              onChange={e => setSelectedTipo(e.target.value)}
              style={{ minWidth: 120 }}
            >
              <option value="">Todos</option>
              <option value="RECEITAS">Receitas</option>
              <option value="DESPESAS">Despesas</option>
            </select>
          </div>

          {/* Categoria */}
          <div className="filter-group">
            <Filter size={13} style={{ color: 'var(--color-brand-cyan)' }} />
            <label>Categoria</label>
            <select
              className="filter-input"
              value={selectedCat}
              onChange={e => setSelectedCat(e.target.value)}
              style={{ minWidth: 140 }}
            >
              <option value="">Todas</option>
              {availableCats.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          {/* Espécie */}
          <div className="filter-group">
            <CreditCard size={13} style={{ color: 'var(--color-brand-cyan)' }} />
            <label>Espécie</label>
            <select
              className="filter-input"
              value={selectedEsp}
              onChange={e => setSelectedEsp(e.target.value)}
              style={{ minWidth: 130 }}
            >
              <option value="">Todas</option>
              {availableEsps.map(e => <option key={e} value={e}>{e}</option>)}
            </select>
          </div>
        </motion.div>

        {/* ════ RESUMO E AÇÕES ════ */}
        <motion.div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '24px' }} variants={fadeUp} custom={1} initial="hidden" animate="visible">
          
          {/* CARDS */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px' }}>
            {/* RECEITAS CARD */}
            <div className="kpi-card" style={{ padding: '20px 24px', minWidth: '240px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '24px' }}>
                <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-secondary)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                  Receitas
                </span>
                <div style={{ background: '#00c89615', borderRadius: '10px', width: '34px', height: '34px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <TrendingUp size={18} style={{ color: '#00c896' }} />
                </div>
              </div>
              <div style={{ marginTop: '12px' }}>
                <div style={{ fontSize: '28px', fontWeight: 800, color: '#00c896', letterSpacing: '-0.02em', whiteSpace: 'nowrap' }}>
                  {fmt(totalReceitas)}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '8px' }}>
                  <ArrowUpRight size={14} style={{ color: '#00c896' }} />
                  <span style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>
                    {receitasCount} lançamentos
                  </span>
                </div>
              </div>
            </div>

            {/* DESPESAS CARD */}
            <div className="kpi-card" style={{ padding: '20px 24px', minWidth: '240px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '24px' }}>
                <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-secondary)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                  Despesas
                </span>
                <div style={{ background: '#f8717115', borderRadius: '10px', width: '34px', height: '34px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <TrendingDown size={18} style={{ color: '#f87171' }} />
                </div>
              </div>
              <div style={{ marginTop: '12px' }}>
                <div style={{ fontSize: '28px', fontWeight: 800, color: '#f87171', letterSpacing: '-0.02em', whiteSpace: 'nowrap' }}>
                  {fmt(totalDespesas)}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '8px' }}>
                  <ArrowUpRight size={14} style={{ color: '#f87171' }} />
                  <span style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>
                    {despesasCount} lançamentos
                  </span>
                </div>
              </div>
            </div>
          </div>

        </motion.div>

        {/* ════ TABELA ════ */}
        <motion.div className="chart-card tx-table-card" variants={fadeUp} custom={2} initial="hidden" animate="visible">

          {/* Erro de carregamento */}
          {error && (
            <div className="alert alert--error" style={{ marginBottom: 16 }}>
              <AlertTriangle size={14} /> {error}
            </div>
          )}

          {/* Loading skeleton */}
          {loading ? (
            <div className="tx-loading">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="tx-skeleton-row" style={{ animationDelay: `${i * 0.06}s` }} />
              ))}
            </div>
          ) : paginated.length === 0 ? (
            <div className="tx-empty-state">
              <ListFilter size={40} strokeWidth={1} style={{ color: 'var(--color-text-muted)', opacity: 0.4 }} />
              <p style={{ color: 'var(--color-text-muted)', fontSize: 14, marginTop: 12 }}>
                {filtered.length === 0 && transacoes.length > 0
                  ? 'Nenhuma transação corresponde aos filtros aplicados.'
                  : 'Nenhuma transação encontrada no período selecionado.'}
              </p>
              {(busca || selectedTipo || selectedCat || selectedEsp) && (
                <button
                  className="btn btn--ghost btn--auto"
                  style={{ marginTop: 12, fontSize: 13 }}
                  onClick={() => { setBusca(''); setSelectedTipo(''); setSelectedCat(''); setSelectedEsp(''); }}
                >
                  <X size={13} /> Limpar filtros
                </button>
              )}
            </div>
          ) : (
            <>
              {/* Cabeçalho da tabela */}
              <div className="tx-table-header">
                <span className="tx-th" style={{ flex: '0 0 38px' }}></span>
                <span className="tx-th" style={{ flex: 2 }}>Referente</span>
                <span className="tx-th" style={{ flex: 1 }}>Categoria</span>
                <span className="tx-th" style={{ flex: 1 }}>Espécie</span>
                <span className="tx-th tx-th--center" style={{ flex: '0 0 110px' }}>Data</span>
                <span className="tx-th tx-th--right" style={{ flex: '0 0 140px' }}>Valor</span>
                <span className="tx-th tx-th--center" style={{ flex: '0 0 100px' }}>Ações</span>
              </div>

              {/* Linhas */}
              <AnimatePresence mode="popLayout">
                {paginated.map((t, i) => {
                  const isRec = t.tipo_transacao === 'RECEITAS';
                  const dataTx = (() => {
                    const val = t.data ?? t.created_at;
                    if (!val) return t.data_text ?? '—';
                    const dateVal = val.includes('T') ? val : `${val}T12:00:00`;
                    const d = new Date(dateVal);
                    return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('pt-BR');
                  })();

                  return (
                    <motion.div
                      key={t.id}
                      className="tx-table-row"
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 8 }}
                      transition={{ delay: i * 0.02, duration: 0.25 }}
                      layout
                      style={{ opacity: isIgnoredTx(t) ? 0.7 : 1 }}
                    >
                      {/* Ícone tipo */}
                      <div style={{ flex: '0 0 38px', display: 'flex', alignItems: 'center' }}>
                        <div className="tx-type-icon" style={{
                          background: isRec ? '#00c89620' : '#f8717120',
                          color: isRec ? '#00c896' : '#f87171',
                        }}>
                          {isRec ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
                        </div>
                      </div>
 
                      {/* Referente */}
                      <div style={{ flex: 2, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <p className="tx-cell-label">{t.referente}</p>
                          {isIgnoredTx(t) && (
                            <span style={{ fontSize: 9, background: 'var(--color-bg-body)', border: '1px solid var(--color-border)', color: 'var(--color-text-muted)', padding: '1px 5px', borderRadius: 4, textTransform: 'uppercase' }}>
                              Off-Saldo
                            </span>
                          )}
                        </div>
                      </div>
 
                      {/* Categoria */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        {t.categoria_nome ? (
                          <span className="tx-badge">{t.categoria_nome}</span>
                        ) : (
                          <span style={{ color: 'var(--color-text-muted)', fontSize: 12 }}>—</span>
                        )}
                      </div>
 
                      {/* Espécie */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
                          {t.especie ?? '—'}
                        </span>
                      </div>
 
                      {/* Data */}
                      <div style={{ flex: '0 0 110px', textAlign: 'center' }}>
                        <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>{dataTx}</span>
                      </div>
 
                      {/* Valor */}
                      <div style={{ flex: '0 0 140px', textAlign: 'right' }}>
                        <span className="tx-value" style={{ 
                          color: isRec ? '#00c896' : '#f87171',
                          textDecoration: isIgnoredTx(t) ? 'line-through' : 'none',
                          opacity: isIgnoredTx(t) ? 0.6 : 1
                        }}>
                          {isRec ? '+' : '-'}{fmt(Number(t.valor))}
                        </span>
                      </div>
 
                      {/* Ações */}
                      <div style={{ flex: '0 0 100px', display: 'flex', justifyContent: 'center', gap: 6 }}>
                        <button
                          className="tx-action-btn tx-action-btn--edit"
                          onClick={() => setEditando(t)}
                          title="Editar transação"
                        >
                          <Pencil size={13} />
                        </button>
                        <button
                          className="tx-action-btn tx-action-btn--delete"
                          onClick={() => { setExcluindo(t); setDeleteError(''); }}
                          title="Excluir transação"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </>
          )}
        </motion.div>

        {/* ════ PAGINAÇÃO ════ */}
        {!loading && filtered.length > ITEMS_PER_PAGE && (
          <motion.div
            className="tx-pagination"
            variants={fadeUp} custom={3} initial="hidden" animate="visible"
          >
            <span className="tx-pagination__info">
              Página <strong>{currentPage}</strong> de <strong>{totalPages}</strong>
              &nbsp;·&nbsp;{filtered.length} registros
            </span>

            <div className="tx-pagination__controls">
              <button
                className="tx-pag-btn"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              >
                <ChevronLeft size={16} />
              </button>

              {/* Páginas numéricas */}
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter(p => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 2)
                .reduce<(number | '...')[]>((acc, p, idx, arr) => {
                  if (idx > 0 && p - (arr[idx - 1] as number) > 1) acc.push('...');
                  acc.push(p);
                  return acc;
                }, [])
                .map((p, idx) =>
                  p === '...'
                    ? <span key={`dots-${idx}`} className="tx-pag-dots">…</span>
                    : (
                      <button
                        key={p}
                        className={`tx-pag-btn ${currentPage === p ? 'tx-pag-btn--active' : ''}`}
                        onClick={() => setCurrentPage(p as number)}
                      >
                        {p}
                      </button>
                    )
                )
              }

              <button
                className="tx-pag-btn"
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </motion.div>
        )}

      </main>

      {/* ════ MODAL EDITAR ════ */}
      {editando && (
        <ModalEditarTransacao
          transacao={editando}
          onClose={() => setEditando(null)}
          onSuccess={() => {
            setEditando(null);
            fetchTransacoes();
          }}
        />
      )}

      {/* ════ MODAL CONFIRMAR EXCLUSÃO ════ */}
      <AnimatePresence>
        {excluindo && (
          <div
            style={{
              position: 'fixed', inset: 0,
              background: 'rgba(5,11,20,0.82)',
              backdropFilter: 'blur(5px)',
              zIndex: 9999,
              display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
            }}
            onClick={() => setExcluindo(null)}
          >
            <motion.div
              onClick={e => e.stopPropagation()}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.25 }}
              className="card"
              style={{ maxWidth: 400 }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {/* Ícone de aviso */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{
                    width: 44, height: 44, borderRadius: 12,
                    background: 'rgba(248,113,113,0.12)',
                    border: '1px solid rgba(248,113,113,0.25)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    <AlertTriangle size={20} style={{ color: '#f87171' }} />
                  </div>
                  <div>
                    <h3 style={{ color: 'var(--color-text-primary)', fontSize: 16, fontWeight: 700 }}>
                      Excluir Transação
                    </h3>
                    <p style={{ color: 'var(--color-text-muted)', fontSize: 12, marginTop: 2 }}>
                      Esta ação não pode ser desfeita.
                    </p>
                  </div>
                </div>

                {/* Detalhes da transação */}
                <div style={{
                  background: 'var(--color-bg-input)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 10, padding: '12px 14px',
                }}>
                  <p style={{ color: 'var(--color-text-primary)', fontSize: 14, fontWeight: 600 }}>
                    {excluindo.referente}
                  </p>
                  <p style={{ color: 'var(--color-text-muted)', fontSize: 12, marginTop: 4 }}>
                    {excluindo.tipo_transacao === 'RECEITAS' ? '+ ' : '- '}
                    {fmt(Number(excluindo.valor))}
                    {excluindo.data && ` · ${new Date(excluindo.data + 'T12:00:00').toLocaleDateString('pt-BR')}`}
                  </p>
                </div>

                {deleteError && (
                  <div className="alert alert--error">
                    <AlertTriangle size={13} /> {deleteError}
                  </div>
                )}

                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                  <button
                    className="btn btn--ghost btn--auto"
                    onClick={() => setExcluindo(null)}
                    disabled={loadingDelete}
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleDelete}
                    disabled={loadingDelete}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 7,
                      padding: '11px 20px', borderRadius: 8,
                      background: loadingDelete ? '#7f1d1d' : '#ef4444',
                      color: '#fff', border: 'none', fontWeight: 600,
                      fontSize: 14, cursor: loadingDelete ? 'not-allowed' : 'pointer',
                      fontFamily: 'var(--font-family)',
                      transition: 'background 0.2s',
                    }}
                  >
                    <Trash2 size={14} />
                    {loadingDelete ? 'Excluindo…' : 'Confirmar Exclusão'}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Transacoes;
