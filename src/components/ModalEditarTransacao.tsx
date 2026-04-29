import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, PlusCircle, MinusCircle, AlertCircle, Save } from 'lucide-react';
import { supabase } from '../lib/supabase';

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

interface ModalEditarTransacaoProps {
  transacao: Transacao;
  onClose: () => void;
  onSuccess: () => void;
}



// ── Helpers Máscara Moeda ──────────────────────────────────────
const maskCurrency = (v: string) => {
  const digits = v.replace(/\D/g, '');
  const num = parseFloat(digits) / 100;
  if (isNaN(num)) return '';
  return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};
const parseCurrency = (v: string) => {
  return parseFloat(v.replace(/[^\d,]/g, '').replace(',', '.')) || 0;
};

const ModalEditarTransacao: React.FC<ModalEditarTransacaoProps> = ({ transacao, onClose, onSuccess }) => {
  const [tipo, setTipo]                 = useState<'DESPESAS' | 'RECEITAS'>(transacao.tipo_transacao);
  const [referente, setReferente]       = useState(transacao.referente);
  // Inicializa com o valor formatado. Multiplicamos por 100 para converter para centavos para a máscara.
  const [valor, setValor]               = useState(maskCurrency(String(transacao.valor * 100)));
  const [categoriaNome, setCategoriaNome] = useState(transacao.categoria_nome ?? '');
  const [especie, setEspecie]           = useState(transacao.especie ?? 'PIX');
  const [dataStr, setDataStr]           = useState(transacao.data ? transacao.data.split('T')[0] : '');
  const [loading, setLoading]           = useState(false);
  const [error, setError]               = useState('');
  const [especiesValidas, setEspeciesValidas] = useState<{id: string; descricao: string}[]>([]);

  // Bloqueia scroll do body e carrega espécies do banco
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    supabase.from('especies').select('id,descricao').order('descricao').then(({ data }) => {
      if (data) setEspeciesValidas(data);
    });
    return () => { document.body.style.overflow = ''; };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!referente.trim())                                         return setError('Informe a descrição (referente).');
    const valorNum = parseCurrency(valor);
    if (valorNum <= 0)                                             return setError('Informe um valor numérico válido.');
    if (!categoriaNome.trim())                                     return setError('Informe a categoria.');
    if (!dataStr)                                                  return setError('Informe a data.');

    setLoading(true);
    try {
      const especieObj = especiesValidas.find(e => e.descricao === especie);
      const updates = {
        tipo_transacao: tipo,
        referente: referente.trim(),
        valor: valorNum,
        categoria_nome: categoriaNome.trim(),
        especie,
        especie_id: especieObj?.id ?? null,
        data: dataStr,
        data_text: new Date(dataStr + 'T12:00:00').toLocaleDateString('pt-BR'),
      };

      const { error: updateError } = await supabase
        .from('transacoes')
        .update(updates)
        .eq('id', transacao.id);

      if (updateError) throw updateError;
      onSuccess();
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Erro ao atualizar transação.');
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      <div style={overlayStyle} onClick={onClose}>
        <motion.div
          onClick={e => e.stopPropagation()}
          initial={{ opacity: 0, y: 30, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.95 }}
          transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          style={modalStyle}
          className="card"
        >
          {/* Header */}
          <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <div>
              <h2 style={{ fontSize: 18, color: 'var(--color-text-primary)', margin: 0 }}>Editar Transação</h2>
            </div>
            <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer', padding: 4 }}>
              <X size={20} />
            </button>
          </header>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {error && (
              <div className="alert alert--error">
                <AlertCircle size={14} /> {error}
              </div>
            )}

            {/* Tipo */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <button type="button" onClick={() => setTipo('RECEITAS')} style={{
                ...typeBtnStyle,
                borderColor: tipo === 'RECEITAS' ? 'var(--color-brand-cyan)' : 'var(--color-border)',
                color:       tipo === 'RECEITAS' ? 'var(--color-brand-cyan)' : 'var(--color-text-muted)',
                background:  tipo === 'RECEITAS' ? '#00c89615' : 'transparent',
              }}>
                <PlusCircle size={16} /> Receita
              </button>
              <button type="button" onClick={() => setTipo('DESPESAS')} style={{
                ...typeBtnStyle,
                borderColor: tipo === 'DESPESAS' ? '#f87171' : 'var(--color-border)',
                color:       tipo === 'DESPESAS' ? '#f87171' : 'var(--color-text-muted)',
                background:  tipo === 'DESPESAS' ? '#f8717115' : 'transparent',
              }}>
                <MinusCircle size={16} /> Despesa
              </button>
            </div>

            {/* Referente */}
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Descrição (Referente)</label>
              <input
                type="text" className="form-input"
                value={referente} onChange={e => setReferente(e.target.value)}
                placeholder="Ex: Conta de Luz"
                style={{ paddingLeft: 'var(--spacing-md)' }}
              />
            </div>

            {/* Valor + Data */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Valor (R$)</label>
                <input
                  type="text" className="form-input"
                  value={valor} onChange={e => setValor(maskCurrency(e.target.value))}
                  placeholder="R$ 0,00"
                  style={{ paddingLeft: 'var(--spacing-md)' }}
                />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Data</label>
                <input
                  type="date" className="form-input"
                  value={dataStr} onChange={e => setDataStr(e.target.value)}
                  style={{ paddingLeft: 'var(--spacing-md)' }}
                />
              </div>
            </div>

            {/* Categoria + Espécie */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Categoria</label>
                <input
                  type="text" className="form-input"
                  list="cat-list-edit"
                  value={categoriaNome} onChange={e => setCategoriaNome(e.target.value)}
                  placeholder="Ex: Casa, Lazer"
                  style={{ paddingLeft: 'var(--spacing-md)' }}
                />
                <datalist id="cat-list-edit">
                  <option value="Alimentação" />
                  <option value="Casa" />
                  <option value="Transporte" />
                  <option value="Lazer" />
                  <option value="Salário" />
                  <option value="Saúde" />
                  <option value="Educação" />
                </datalist>
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Espécie</label>
                <select
                  className="form-input"
                  value={especie} onChange={e => setEspecie(e.target.value)}
                  style={{ paddingLeft: 'var(--spacing-md)' }}
                >
                  {especiesValidas.map(esp => (
                    <option key={esp.id} value={esp.descricao}>{esp.descricao}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Ações */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 8 }}>
              <button type="button" className="btn btn--ghost" onClick={onClose} disabled={loading}>
                Cancelar
              </button>
              <button type="submit" className="btn btn--primary btn--auto" disabled={loading}
                style={{ gap: 8, padding: '12px 24px' }}>
                <Save size={15} />
                {loading ? 'Salvando...' : 'Salvar Alterações'}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default ModalEditarTransacao;

// ── Estilos
const overlayStyle: React.CSSProperties = {
  position: 'fixed',
  top: 0, left: 0, right: 0, bottom: 0,
  backgroundColor: 'rgba(5, 11, 20, 0.80)',
  backdropFilter: 'blur(5px)',
  zIndex: 9999,
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  padding: 16,
};

const modalStyle: React.CSSProperties = {
  width: '100%',
  maxWidth: 500,
  maxHeight: '90vh',
  overflowY: 'auto',
};

const typeBtnStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8,
  padding: '12px',
  borderRadius: 8,
  border: '1px solid',
  cursor: 'pointer',
  transition: 'all 0.2s',
  fontWeight: 600,
  fontFamily: 'var(--font-family)',
};
