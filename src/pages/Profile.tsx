import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowLeft, User, Phone, DollarSign, Target, Camera,
  Save, Trash2, Eye, EyeOff, AlertTriangle, CheckCircle, Loader,
} from 'lucide-react';
import { supabase, authHelpers } from '../lib/supabase';
import type { Session } from '@supabase/supabase-js';
import type { Profile } from '../lib/supabase';
import ThemeToggle from '../components/ThemeToggle';

interface ProfilePageProps {
  session: Session;
  onBack: () => void;
}

// ── Máscara telefone ────────────────────────────────────────────
function maskPhone(v: string) {
  const d = v.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 10) return d.replace(/(\d{2})(\d{4})(\d{0,4})/, '($1) $2-$3');
  return d.replace(/(\d{2})(\d{5})(\d{0,4})/, '($1) $2-$3');
}

// ── Máscara moeda BRL ───────────────────────────────────────────
function maskCurrency(v: string) {
  const digits = v.replace(/\D/g, '');
  const num = parseFloat(digits) / 100;
  if (isNaN(num)) return '';
  return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
function parseCurrency(v: string) {
  return parseFloat(v.replace(/[^\d,]/g, '').replace(',', '.')) || 0;
}

const SUPABASE_URL = 'https://abkyvggiydvigugltboe.supabase.co';

const ProfilePage: React.FC<ProfilePageProps> = ({ session, onBack }) => {
  const fileRef = useRef<HTMLInputElement>(null);
  const [profile, setProfile] = useState<Profile | null>(null);

  // Campos editáveis
  const [nome, setNome]           = useState('');
  const [celular, setCelular]     = useState('');
  const [renda, setRenda]         = useState('');
  const [objetivo, setObjetivo]   = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);

  // UI states
  const [saving, setSaving]         = useState(false);
  const [uploading, setUploading]   = useState(false);
  const [toast, setToast]           = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirm, setDeleteConfirm]     = useState('');
  const [deleting, setDeleting]               = useState(false);

  // ── Carrega perfil ao montar ────────────────────────────────
  useEffect(() => {
    const load = async () => {
      const p = await authHelpers.getProfile(session.user.id);
      if (p) {
        setProfile(p);
        setNome(p.nome_completo ?? '');
        setCelular(p.celular ?? '');
        setRenda(p.renda_mensal ? maskCurrency(String(p.renda_mensal * 100)) : '');
        setObjetivo(p.objetivo_principal ?? '');
        setAvatarUrl(p.avatar_url);
      }
    };
    load();
  }, [session.user.id]);

  const showToast = (type: 'success' | 'error', msg: string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3500);
  };

  // ── Seleciona arquivo de avatar ────────────────────────────
  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      showToast('error', 'Imagem muito grande. Limite: 2 MB'); return;
    }
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  };

  // ── Faz upload do avatar ───────────────────────────────────
  const uploadAvatar = async (): Promise<string | null> => {
    if (!avatarFile) return avatarUrl;
    setUploading(true);
    try {
      const ext  = avatarFile.name.split('.').pop();
      const path = `${session.user.id}/avatar.${ext}`;
      const { error } = await supabase.storage
        .from('avatars')
        .upload(path, avatarFile, { upsert: true });
      if (error) throw error;
      return `${SUPABASE_URL}/storage/v1/object/public/avatars/${path}?t=${Date.now()}`;
    } finally {
      setUploading(false);
    }
  };

  // ── Salva perfil ───────────────────────────────────────────
  const handleSave = async () => {
    setSaving(true);
    try {
      const newAvatarUrl = await uploadAvatar();
      await authHelpers.updateProfile(session.user.id, {
        nome_completo: nome,
        celular,
        renda_mensal: parseCurrency(renda),
        objetivo_principal: objetivo,
        avatar_url: newAvatarUrl ?? avatarUrl,
        updated_at: new Date().toISOString(),
      });
      if (newAvatarUrl) setAvatarUrl(newAvatarUrl);
      setAvatarFile(null);
      setAvatarPreview(null);
      showToast('success', 'Perfil atualizado com sucesso!');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao salvar.';
      showToast('error', msg);
    } finally {
      setSaving(false);
    }
  };

  // ── Desativa conta (soft delete) ───────────────────────────
  const handleDeactivate = async () => {
    setDeleting(true);
    try {
      await authHelpers.updateProfile(session.user.id, {
        is_active: false,
        updated_at: new Date().toISOString(),
      } as Partial<Profile> & { is_active: boolean });
      await authHelpers.signOut();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao desativar conta.';
      showToast('error', msg);
      setDeleting(false);
    }
  };

  // ── Iniciais (fallback avatar) ────────────────────────────
  const initials = nome ? nome.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : '?';
  const displayAvatar = avatarPreview ?? avatarUrl;

  const fadeUp = {
    hidden:  { opacity: 0, y: 20 },
    visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.07, duration: 0.4 } }),
  };

  return (
    <div className="dashboard-shell">

      {/* ════ HEADER ════ */}
      <header className="dashboard-header">
        <div className="dashboard-header__brand">
          <img src="/logo_meuBolso.png" alt="MeuBolso.digital"
            style={{ height: 50, objectFit: 'contain' }} />
        </div>
        <div className="dashboard-header__title">
          <User size={18} style={{ color: 'var(--color-brand-cyan)' }} />
          <span style={{ fontSize: '18px', fontWeight: 600, color: 'var(--color-text-primary)' }}>
            Meu Perfil
          </span>
        </div>
        <div className="dashboard-header__right" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <ThemeToggle />
          <button className="btn btn--ghost btn--auto" onClick={onBack}>
            <ArrowLeft size={14} /> Voltar
          </button>
        </div>
      </header>

      {/* ════ CONTEÚDO ════ */}
      <main className="dashboard-main" style={{ maxWidth: 680 }}>

        {/* ── Avatar ── */}
        <motion.div className="chart-card" style={{ alignItems: 'center', paddingTop: 40, paddingBottom: 40 }}
          variants={fadeUp} custom={0} initial="hidden" animate="visible">

          {/* Foto circular */}
          <div style={{ position: 'relative', marginBottom: 16 }}>
            <div style={{
              width: 110, height: 110, borderRadius: '50%',
              background: 'linear-gradient(135deg, #00c896, #22d3ee)',
              border: '3px solid var(--color-border)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              overflow: 'hidden', cursor: 'pointer',
            }} onClick={() => fileRef.current?.click()}>
              {displayAvatar ? (
                <img src={displayAvatar} alt="Avatar"
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <span style={{ fontSize: 36, fontWeight: 700, color: '#fff' }}>{initials}</span>
              )}
            </div>

            {/* Botão câmera */}
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              style={{
                position: 'absolute', bottom: 4, right: 4,
                width: 30, height: 30, borderRadius: '50%',
                background: 'var(--color-brand-cyan)', border: '2px solid var(--color-bg-page)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', color: '#fff',
              }}
            >
              {uploading ? <Loader size={13} className="spin" /> : <Camera size={13} />}
            </button>
            <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }}
              onChange={handleAvatarChange} />
          </div>

          <p style={{ fontWeight: 700, fontSize: 20, color: 'var(--color-text-primary)' }}>
            {nome || session.user.email}
          </p>
          <p style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 4 }}>
            {session.user.email}
          </p>
          {avatarFile && (
            <p style={{ fontSize: 11, color: 'var(--color-brand-cyan)', marginTop: 8 }}>
              Nova foto selecionada — clique em Salvar para confirmar
            </p>
          )}
        </motion.div>

        {/* ── Dados pessoais ── */}
        <motion.div className="chart-card" variants={fadeUp} custom={1} initial="hidden" animate="visible">
          <div className="chart-card__header">
            <div>
              <h2 className="chart-card__title">Dados Pessoais</h2>
              <p className="chart-card__subtitle">Atualize suas informações de perfil</p>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

            {/* Nome */}
            <div className="form-field">
              <label className="form-label">
                <User size={14} /> Nome completo
              </label>
              <div className="input-wrapper">
                <User size={16} className="input-icon" />
                <input className="form-input"
                  value={nome} onChange={e => setNome(e.target.value)}
                  placeholder="Seu nome completo" />
              </div>
            </div>

            {/* Celular */}
            <div className="form-field">
              <label className="form-label">
                <Phone size={14} /> Celular
              </label>
              <div className="input-wrapper">
                <Phone size={16} className="input-icon" />
                <input className="form-input"
                  value={celular}
                  onChange={e => setCelular(maskPhone(e.target.value))}
                  placeholder="(00) 00000-0000"
                  maxLength={16} />
              </div>
            </div>

            {/* Renda mensal */}
            <div className="form-field">
              <label className="form-label">
                <DollarSign size={14} /> Renda mensal
              </label>
              <div className="input-wrapper">
                <DollarSign size={16} className="input-icon" />
                <input className="form-input"
                  value={renda}
                  onChange={e => setRenda(maskCurrency(e.target.value))}
                  placeholder="R$ 0,00" />
              </div>
            </div>

            {/* Objetivo */}
            <div className="form-field">
              <label className="form-label">
                <Target size={14} /> Objetivo financeiro
              </label>
              <div className="input-wrapper">
                <Target size={16} className="input-icon" />
                <input className="form-input"
                  value={objetivo}
                  onChange={e => setObjetivo(maskCurrency(e.target.value))}
                  placeholder="R$ 0,00 (meta)"/>
              </div>
            </div>

            {/* Info imutável */}
            <div style={{
              background: 'rgba(0,200,150,0.06)',
              border: '1px solid rgba(0,200,150,0.15)',
              borderRadius: 'var(--radius-md)',
              padding: '10px 14px', fontSize: 12,
              color: 'var(--color-text-muted)',
            }}>
              📅 Membro desde: {profile
                ? new Date(profile.created_at).toLocaleDateString('pt-BR', { dateStyle: 'long' })
                : '—'}
            </div>

            {/* Botão salvar */}
            <button className="btn btn--primary"
              onClick={handleSave}
              disabled={saving || uploading}
              style={{ marginTop: 4 }}>
              {saving ? <><Loader size={14} className="spin" /> Salvando...</>
                       : <><Save size={14} /> Salvar alterações</>}
            </button>

          </div>
        </motion.div>

        {/* ── Zona de perigo ── */}
        <motion.div className="chart-card" variants={fadeUp} custom={2} initial="hidden" animate="visible"
          style={{ border: '1px solid rgba(248,113,113,0.3)' }}>
          <div className="chart-card__header">
            <div>
              <h2 className="chart-card__title" style={{ color: '#f87171' }}>
                Zona de Perigo
              </h2>
              <p className="chart-card__subtitle">
                Esta ação desativa seu acesso. Seus dados e transações são preservados.
              </p>
            </div>
            <AlertTriangle size={20} style={{ color: '#f87171', flexShrink: 0 }} />
          </div>

          <button
            className="btn btn--auto"
            onClick={() => setShowDeleteModal(true)}
            style={{
              background: 'rgba(248,113,113,0.1)',
              border: '1px solid rgba(248,113,113,0.4)',
              color: '#f87171',
              marginTop: 8,
            }}>
            <Trash2 size={14} /> Desativar minha conta
          </button>
        </motion.div>

      </main>

      {/* ════ MODAL CONFIRMAÇÃO ════ */}
      {showDeleteModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999,
          padding: '24px',
        }}>
          <motion.div
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            style={{
              background: 'var(--color-bg-card)',
              border: '1px solid rgba(248,113,113,0.4)',
              borderRadius: 'var(--radius-lg)',
              padding: 32, maxWidth: 440, width: '100%',
            }}>
            <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
              <AlertTriangle size={24} style={{ color: '#f87171', flexShrink: 0 }} />
              <div>
                <h3 style={{ fontSize: 18, fontWeight: 700, color: '#f0f4ff', marginBottom: 6 }}>
                  Desativar conta?
                </h3>
                <p style={{ fontSize: 13, color: 'var(--color-text-muted)', lineHeight: 1.6 }}>
                  Seu acesso será bloqueado imediatamente. Todos os seus dados e transações
                  são mantidos com segurança e podem ser restaurados pelo suporte.
                </p>
              </div>
            </div>

            <p style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 10 }}>
              Digite <strong style={{ color: '#f87171' }}>DESATIVAR</strong> para confirmar:
            </p>
            <input
              className="form-input"
              value={deleteConfirm}
              onChange={e => setDeleteConfirm(e.target.value.toUpperCase())}
              placeholder="DESATIVAR"
              style={{ marginBottom: 20, borderColor: deleteConfirm === 'DESATIVAR' ? '#f87171' : undefined }}
            />

            <div style={{ display: 'flex', gap: 12 }}>
              <button className="btn btn--ghost btn--auto"
                onClick={() => { setShowDeleteModal(false); setDeleteConfirm(''); }}>
                Cancelar
              </button>
              <button
                className="btn btn--auto"
                onClick={handleDeactivate}
                disabled={deleteConfirm !== 'DESATIVAR' || deleting}
                style={{
                  background: deleteConfirm === 'DESATIVAR' ? 'rgba(248,113,113,0.15)' : 'rgba(248,113,113,0.05)',
                  border: '1px solid rgba(248,113,113,0.4)',
                  color: '#f87171',
                  opacity: deleteConfirm !== 'DESATIVAR' ? 0.5 : 1,
                }}>
                {deleting ? <><Loader size={14} className="spin" /> Desativando...</>
                           : <><Trash2 size={14} /> Confirmar desativação</>}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* ════ TOAST ════ */}
      {toast && (
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          style={{
            position: 'fixed', bottom: 28, right: 28, zIndex: 9999,
            background: toast.type === 'success' ? 'rgba(0,200,150,0.15)' : 'rgba(248,113,113,0.15)',
            border: `1px solid ${toast.type === 'success' ? 'rgba(0,200,150,0.4)' : 'rgba(248,113,113,0.4)'}`,
            borderRadius: 'var(--radius-md)',
            padding: '12px 20px',
            display: 'flex', alignItems: 'center', gap: 10,
            color: toast.type === 'success' ? '#00c896' : '#f87171',
            fontSize: 14, fontWeight: 500,
            backdropFilter: 'blur(12px)',
          }}>
          {toast.type === 'success'
            ? <CheckCircle size={16} />
            : <AlertTriangle size={16} />}
          {toast.msg}
        </motion.div>
      )}
    </div>
  );
};

export default ProfilePage;
