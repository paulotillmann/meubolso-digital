import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Plus, Edit2, Check, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';

export interface Especie {
  id: string;
  descricao: string;
  nao_calcula_saldo: boolean;
  created_at: string;
}

interface ModalEspeciesProps {
  onClose: () => void;
}

const ModalEspecies: React.FC<ModalEspeciesProps> = ({ onClose }) => {
  const [especies, setEspecies] = useState<Especie[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Estados de nova espécie
  const [novaDescricao, setNovaDescricao] = useState('');
  const [novaNaoCalculaSaldo, setNovaNaoCalculaSaldo] = useState(false);
  const [inserindo, setInserindo] = useState(false);

  // Estados de edição
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [editDescricao, setEditDescricao] = useState('');
  const [editNaoCalculaSaldo, setEditNaoCalculaSaldo] = useState(false);
  const [salvandoEdicao, setSalvandoEdicao] = useState(false);

  const carregarEspecies = async () => {
    setLoading(true);
    setError('');
    try {
      const { data, error: err } = await supabase
        .from('especies')
        .select('*')
        .order('descricao', { ascending: true });

      if (err) throw err;
      setEspecies(data as Especie[]);
    } catch (err: any) {
      console.error(err);
      setError('Erro ao carregar as espécies.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarEspecies();
  }, []);

  const handleNovaEspecie = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!novaDescricao.trim()) {
      setError('Informe a descrição da espécie.');
      return;
    }

    setInserindo(true);
    try {
      const { error: insertError } = await supabase.from('especies').insert([
        {
          descricao: novaDescricao.trim(),
          nao_calcula_saldo: novaNaoCalculaSaldo,
        },
      ]);
      if (insertError) {
        if (insertError.code === '23505') throw new Error('Já existe uma espécie com este nome.');
        throw insertError;
      }
      setNovaDescricao('');
      setNovaNaoCalculaSaldo(false);
      carregarEspecies();
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Erro ao inserir espécie.');
    } finally {
      setInserindo(false);
    }
  };

  const iniciarEdicao = (esp: Especie) => {
    setEditandoId(esp.id);
    setEditDescricao(esp.descricao);
    setEditNaoCalculaSaldo(esp.nao_calcula_saldo);
  };

  const cancelarEdicao = () => {
    setEditandoId(null);
  };

  const salvarEdicao = async () => {
    if (!editDescricao.trim()) return;

    setSalvandoEdicao(true);
    setError('');
    try {
      const { error: updateError } = await supabase
        .from('especies')
        .update({
          descricao: editDescricao.trim(),
          nao_calcula_saldo: editNaoCalculaSaldo,
        })
        .eq('id', editandoId);

      if (updateError) {
        if (updateError.code === '23505') throw new Error('Já existe outra espécie com este nome.');
        throw updateError;
      }
      setEditandoId(null);
      carregarEspecies();
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Erro ao atualizar espécie.');
    } finally {
      setSalvandoEdicao(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="modal-overlay" onClick={onClose} style={overlayStyle}>
        <motion.div
          className="modal-content card"
          onClick={(e) => e.stopPropagation()}
          initial={{ opacity: 0, y: 30, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.95 }}
          transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          style={modalStyle}
        >
          <header className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <h2 style={{ fontSize: 18, color: 'var(--color-text-primary)', margin: 0 }}>Manutenção de Espécies</h2>
            <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer', padding: 4 }}>
              <X size={20} />
            </button>
          </header>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {error && (
              <div className="alert alert--error" style={{ padding: '10px 14px', borderRadius: 8, fontSize: 13, display: 'flex', alignItems: 'center', gap: 8, background: '#f8717120', color: '#f87171' }}>
                <AlertCircle size={16} /> {error}
              </div>
            )}

            {/* Inclusão */}
            <form onSubmit={handleNovaEspecie} style={{ display: 'flex', flexDirection: 'column', gap: 12, background: 'var(--color-bg-body)', padding: 16, borderRadius: 8, border: '1px solid var(--color-border)' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Nova Espécie</label>
                <input
                  type="text"
                  className="form-input"
                  value={novaDescricao}
                  onChange={(e) => setNovaDescricao(e.target.value)}
                  placeholder="Descrição"
                  disabled={inserindo}
                />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--color-text-primary)', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={novaNaoCalculaSaldo}
                    onChange={(e) => setNovaNaoCalculaSaldo(e.target.checked)}
                    disabled={inserindo}
                    style={{ width: 16, height: 16, accentColor: 'var(--color-brand-cyan)' }}
                  />
                  Não calcula saldo?
                </label>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-start', marginTop: 4 }}>
                <button type="submit" className="btn btn--primary" style={{ padding: '0 24px', height: 42 }} disabled={inserindo}>
                  <Plus size={16} /> Adicionar
                </button>
              </div>
            </form>

            <hr style={{ borderTop: '1px solid var(--color-border)', margin: '4px 0' }} />

            {/* Listagem / Alteração */}
            {loading ? (
              <div style={{ textAlign: 'center', padding: 20, color: 'var(--color-text-muted)' }}>Carregando...</div>
            ) : especies.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 20, color: 'var(--color-text-muted)' }}>Nenhuma espécie cadastrada.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 300, overflowY: 'auto', paddingRight: 4 }}>
                {especies.map((esp) => (
                  <div key={esp.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 12, background: 'var(--color-bg-body)', borderRadius: 8, border: '1px solid var(--color-border)' }}>
                    
                    {editandoId === esp.id ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
                        <input
                          type="text"
                          className="form-input"
                          value={editDescricao}
                          onChange={(e) => setEditDescricao(e.target.value)}
                          autoFocus
                          disabled={salvandoEdicao}
                        />
                        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--color-text-primary)', cursor: 'pointer' }}>
                          <input
                            type="checkbox"
                            checked={editNaoCalculaSaldo}
                            onChange={(e) => setEditNaoCalculaSaldo(e.target.checked)}
                            style={{ width: 16, height: 16, accentColor: 'var(--color-brand-cyan)' }}
                            disabled={salvandoEdicao}
                          />
                          Não calcula saldo?
                        </label>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1 }}>
                        <span style={{ color: 'var(--color-text-primary)', fontWeight: 500 }}>{esp.descricao}</span>
                        {esp.nao_calcula_saldo && (
                          <span style={{ fontSize: 11, background: '#f8717120', color: '#f87171', padding: '2px 8px', borderRadius: 12 }}>
                            Não compõe saldo
                          </span>
                        )}
                      </div>
                    )}

                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 16 }}>
                      {editandoId === esp.id ? (
                        <>
                          <button onClick={cancelarEdicao} disabled={salvandoEdicao} className="btn btn--ghost" style={{ padding: '6px 12px' }}>Cancelar</button>
                          <button onClick={salvarEdicao} disabled={salvandoEdicao} className="btn btn--primary" style={{ padding: '6px 12px' }}>
                            <Check size={16} /> Salvar
                          </button>
                        </>
                      ) : (
                        <button onClick={() => iniciarEdicao(esp)} className="btn btn--ghost" style={{ padding: 8, color: 'var(--color-brand-cyan)' }} title="Editar">
                          <Edit2 size={16} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default ModalEspecies;

// ── Estilos Inline Base
const overlayStyle: React.CSSProperties = {
  position: 'fixed',
  top: 0, left: 0, right: 0, bottom: 0,
  backgroundColor: 'rgba(5, 11, 20, 0.75)',
  backdropFilter: 'blur(4px)',
  zIndex: 9999,
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  padding: 16,
};

const modalStyle: React.CSSProperties = {
  width: '100%',
  maxWidth: 580,
  maxHeight: '90vh',
  overflowY: 'auto',
};
