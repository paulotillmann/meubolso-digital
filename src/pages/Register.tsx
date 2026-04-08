import React, { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowLeft, User, Phone, Mail, Lock, DollarSign,
  Target, Camera, ShieldCheck, Sparkles, LogIn, AlertCircle, CheckCircle, Eye, EyeOff
} from 'lucide-react';
import { authHelpers } from '../lib/supabase';

interface RegisterProps {
  onBack: () => void;
  onRegisterSuccess?: () => void;
}

// Helpers de Máscara (PT-BR)
const maskPhoneNum = (value: string) => {
  let v = value.replace(/\D/g, '');
  if (v.length > 11) v = v.substring(0, 11);
  if (v.length > 2) v = `(${v.substring(0,2)}) ${v.substring(2)}`;
  if (v.length > 10) v = `${v.substring(0,10)}-${v.substring(10)}`;
  return v;
};

const maskMoney = (value: string) => {
  const v = value.replace(/\D/g, '');
  if (!v) return '';
  const parsed = (parseInt(v, 10) / 100).toFixed(2);
  return parsed.replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
};

const RegisterPage: React.FC<RegisterProps> = ({ onBack, onRegisterSuccess }) => {
  const [photo, setPhoto]       = useState<string | null>(null);
  const [name, setName]         = useState('');
  const [phone, setPhone]       = useState('');
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm]   = useState('');
  const [income, setIncome]     = useState('');
  const [goal, setGoal]         = useState('');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [success, setSuccess]   = useState(false);
  const [showPwd, setShowPwd]   = useState(false);
  const [showConf, setShowConf] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handlePhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setPhoto(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!name.trim()) { setError('Informe seu nome completo.'); return; }
    if (!email.trim()) { setError('Informe seu e-mail.'); return; }
    if (!password) { setError('Crie uma senha.'); return; }
    if (password.length < 6) { setError('A senha deve ter pelo menos 6 caracteres.'); return; }
    if (password !== confirm) { setError('As senhas não coincidem.'); return; }

    setLoading(true);
    try {
      // Remover pontos e manter apenas a vírgula para conversão
      const cleanIncome = income ? parseFloat(income.replace(/\./g, '').replace(',', '.')) : 0;
      // Tratar o objetivo se também estiver seguindo a máscara de moeda ou não
      const cleanGoal = goal ? goal.trim() : undefined;

      await authHelpers.signUp(email, password, {
        nome_completo: name.trim(),
        celular: phone.trim(),
        renda_mensal: cleanIncome,
        objetivo_principal: cleanGoal,
      });
      setSuccess(true);
      setTimeout(() => onRegisterSuccess?.() ?? onBack(), 3000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao criar conta.';
      if (msg.includes('User already registered') || msg.includes('already been registered')) {
        setError('Este e-mail já está cadastrado. Faça login ou recupere sua senha.');
      } else if (msg.includes('Password should be')) {
        setError('A senha deve ter pelo menos 6 caracteres.');
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  /* ── Framer Motion ── */
  const pageVariants = {
    hidden:  { opacity: 0, x: 40 },
    visible: { opacity: 1, x: 0, transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] } },
  };

  const itemVariants = {
    hidden:  { opacity: 0, y: 10 },
    visible: (i: number) => ({
      opacity: 1, y: 0,
      transition: { delay: i * 0.06, duration: 0.35, ease: 'easeOut' },
    }),
  };

  /* Tela de sucesso */
  if (success) {
    return (
      <div className="page-center">
        <motion.div className="card" style={{ textAlign: 'center', padding: '48px 32px' }}
          initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}>
          <div style={{ color: 'var(--color-brand-green)', marginBottom: 16 }}>
            <CheckCircle size={56} strokeWidth={1.5} />
          </div>
          <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: 8 }}>Conta criada com sucesso!</h2>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: '14px' }}>
            Verifique seu e-mail para confirmar o cadastro e depois faça login.
          </p>
          <button className="btn btn--primary" style={{ marginTop: 24 }} onClick={onBack}>
            Ir para o Login
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <motion.div className="register-page" variants={pageVariants} initial="hidden" animate="visible">

      {/* ════ PAINEL ESQUERDO ════ */}
      <aside className="register-sidebar">
        <button className="btn-back" onClick={onBack} id="btn-back">
          <ArrowLeft size={16} />
          <span>voltar</span>
        </button>

        <div className="register-sidebar__content">
          <motion.div custom={0} variants={itemVariants} initial="hidden" animate="visible">
            <h1 className="register-sidebar__title">Criar Perfil</h1>
            <p className="register-sidebar__desc">
              Configure sua conta para receber insights personalizados sobre suas finanças.
            </p>
          </motion.div>

          <motion.div custom={1} variants={itemVariants} initial="hidden" animate="visible" className="feature-card">
            <div className="feature-card__icon feature-card__icon--green">
              <ShieldCheck size={22} />
            </div>
            <div>
              <h3 className="feature-card__title">Segurança Total</h3>
              <p className="feature-card__desc">
                Seus dados são criptografados de ponta a ponta. Usamos tecnologia bancária para proteger suas informações.
              </p>
            </div>
          </motion.div>

          <motion.div custom={2} variants={itemVariants} initial="hidden" animate="visible" className="feature-card">
            <div className="feature-card__icon feature-card__icon--purple">
              <Sparkles size={22} />
            </div>
            <div>
              <h3 className="feature-card__title">IA Gestão Inteligente</h3>
              <p className="feature-card__desc">
                Preencha sua renda e objetivo para que a nossa IA gere análises inteligentes.
              </p>
            </div>
          </motion.div>
        </div>
      </aside>

      {/* ════ PAINEL DIREITO ════ */}
      <div className="register-form-panel">
        <form onSubmit={handleSubmit} noValidate className="register-form">

          {/* Alerta de erro */}
          {error && (
            <motion.div className="alert alert--error" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}>
              <AlertCircle size={13} /> {error}
            </motion.div>
          )}

          {/* ── Foto ── */}
          <motion.div custom={0} variants={itemVariants} initial="hidden" animate="visible"
            className="photo-upload" onClick={() => fileRef.current?.click()}>
            <div className="photo-upload__avatar">
              {photo
                ? <img src={photo} alt="Avatar" className="photo-upload__img" />
                : <User size={36} color="var(--color-text-muted)" />
              }
              <span className="photo-upload__badge"><Camera size={13} /></span>
            </div>
            <div>
              <p className="photo-upload__label">Sua foto</p>
              <p className="photo-upload__hint">clique para adcionar a foto (JPG ou PNG)</p>
            </div>
            <input ref={fileRef} type="file" accept="image/jpeg,image/png" style={{ display: 'none' }} onChange={handlePhoto} />
          </motion.div>

          {/* ── Nome ── */}
          <motion.div custom={1} variants={itemVariants} initial="hidden" animate="visible" className="form-group">
            <label className="form-label" htmlFor="reg-name">Nome completo <span style={{ color: 'var(--color-brand-green)' }}>*</span></label>
            <div className="input-wrapper">
              <span className="input-icon"><User size={15} /></span>
              <input id="reg-name" type="text" className="form-input" placeholder="Seu nome completo"
                value={name} onChange={e => setName(e.target.value)} />
            </div>
          </motion.div>

          {/* ── Celular ── */}
          <motion.div custom={2} variants={itemVariants} initial="hidden" animate="visible" className="form-group">
            <label className="form-label" htmlFor="reg-phone">Celular</label>
            <div className="input-wrapper">
              <span className="input-icon"><Phone size={15} /></span>
              <input id="reg-phone" type="tel" className="form-input" placeholder="(34) 99999-9999"
                value={phone} onChange={e => setPhone(maskPhoneNum(e.target.value))} />
            </div>
          </motion.div>

          {/* ── Email ── */}
          <motion.div custom={3} variants={itemVariants} initial="hidden" animate="visible" className="form-group">
            <label className="form-label" htmlFor="reg-email">Email principal <span style={{ color: 'var(--color-brand-green)' }}>*</span></label>
            <div className="input-wrapper">
              <span className="input-icon"><Mail size={15} /></span>
              <input id="reg-email" type="email" className="form-input" placeholder="voce@exemplo.com"
                value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" />
            </div>
          </motion.div>

          {/* ── Senha + Confirma ── */}
          <motion.div custom={4} variants={itemVariants} initial="hidden" animate="visible" className="form-row">
            <div className="form-group" style={{ flex: 1 }}>
              <label className="form-label" htmlFor="reg-pwd">Senha <span style={{ color: 'var(--color-brand-green)' }}>*</span></label>
              <div className="input-wrapper">
                <span className="input-icon"><Lock size={15} /></span>
                <input id="reg-pwd" type={showPwd ? 'text' : 'password'} className="form-input" style={{ paddingRight: '42px' }} placeholder="mín. 6 caracteres"
                  value={password} onChange={e => setPassword(e.target.value)} autoComplete="new-password" />
                <button type="button" onClick={() => setShowPwd(!showPwd)} style={{ position: 'absolute', right: '16px', background: 'none', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer', padding: 0 }} tabIndex={-1}>
                  {showPwd ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>
            <div className="form-group" style={{ flex: 1 }}>
              <label className="form-label" htmlFor="reg-confirm">Confirma senha <span style={{ color: 'var(--color-brand-green)' }}>*</span></label>
              <div className="input-wrapper">
                <span className="input-icon"><Lock size={15} /></span>
                <input id="reg-confirm" type={showConf ? 'text' : 'password'} className="form-input" style={{ paddingRight: '42px' }} placeholder="repita a senha"
                  value={confirm} onChange={e => setConfirm(e.target.value)} autoComplete="new-password" />
                <button type="button" onClick={() => setShowConf(!showConf)} style={{ position: 'absolute', right: '16px', background: 'none', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer', padding: 0 }} tabIndex={-1}>
                  {showConf ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>
          </motion.div>

          {/* ── Perfil Financeiro ── */}
          <motion.div custom={5} variants={itemVariants} initial="hidden" animate="visible" className="financial-section">
            <div className="financial-section__header">
              <div className="financial-section__title-row">
                <div className="financial-section__icon"><DollarSign size={17} /></div>
                <span className="financial-section__title">Perfil Financeiro</span>
              </div>
              <button type="button" className="ai-analyze-btn">
                <Sparkles size={13} /><span>Analisar com IA</span>
              </button>
            </div>

            <div className="form-row">
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label" htmlFor="reg-income">Renda mensal estimada</label>
                <div className="input-wrapper">
                  <span className="input-icon"><DollarSign size={15} /></span>
                  <input id="reg-income" type="text" className="form-input" placeholder="Ex: 5.000,00"
                    value={income} onChange={e => setIncome(maskMoney(e.target.value))} />
                </div>
              </div>
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label" htmlFor="reg-goal">Objetivo principal</label>
                <div className="input-wrapper">
                  <span className="input-icon"><Target size={15} /></span>
                  <input id="reg-goal" type="text" className="form-input" placeholder="Ex: 15.000,00"
                    value={goal} onChange={e => setGoal(maskMoney(e.target.value))} />
                </div>
              </div>
            </div>
          </motion.div>

          {/* ── Ações ── */}
          <motion.div custom={6} variants={itemVariants} initial="hidden" animate="visible" className="register-actions">
            <button type="button" className="btn btn--secondary btn--auto" id="btn-cancel" onClick={onBack}>
              Cancelar
            </button>
            <button type="submit" className="btn btn--primary btn--auto" id="btn-criar-conta"
              disabled={loading} style={loading ? { opacity: 0.7, cursor: 'not-allowed' } : {}}>
              {loading ? <><Spinner /> Criando conta...</> : <><LogIn size={16} /> Criar conta</>}
            </button>
          </motion.div>

        </form>
      </div>
    </motion.div>
  );
};

/* Spinner */
const Spinner: React.FC = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
    style={{ animation: 'spin 0.8s linear infinite' }}>
    <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
  </svg>
);

export default RegisterPage;
