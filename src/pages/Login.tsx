import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Mail, Lock, LogIn, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { authHelpers } from '../lib/supabase';

interface LoginProps {
  onSignUp: () => void;
  onLoginSuccess?: () => void;
  externalError?: string;
  onClearExternalError?: () => void;
  isProcessingAuth?: boolean;
}

const LoginPage: React.FC<LoginProps> = ({ onSignUp, onLoginSuccess, externalError, onClearExternalError, isProcessingAuth = false }) => {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Exibe erro externo (ex: conta inativada) vindo do App.tsx
  React.useEffect(() => {
    if (externalError) {
      setError(externalError);
      onClearExternalError?.();
    }
  }, [externalError, onClearExternalError]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email || !password) {
      setError('Preencha e-mail e senha para continuar.');
      return;
    }

    setLoading(true);
    try {
      await authHelpers.signIn(email, password);
      onLoginSuccess?.();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao fazer login.';
      // Mensagens amigáveis em português
      if (msg.includes('Invalid login credentials')) {
        setError('E-mail ou senha incorretos. Verifique e tente novamente.');
      } else if (msg.includes('Email not confirmed')) {
        setError('Confirme seu e-mail antes de acessar. Verifique sua caixa de entrada.');
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  const isLocked = loading || isProcessingAuth;

  /* ── Framer Motion ── */
  const cardVariants = {
    hidden:  { opacity: 0, y: 28, scale: 0.97 },
    visible: { opacity: 1, y: 0, scale: 1,
      transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] } },
  };

  const itemVariants = {
    hidden:  { opacity: 0, y: 12 },
    visible: (i: number) => ({
      opacity: 1, y: 0,
      transition: { delay: i * 0.08, duration: 0.4, ease: 'easeOut' },
    }),
  };

  return (
    <div className="page-center">
      <motion.div className="card" variants={cardVariants} initial="hidden" animate="visible">

        {/* ── Brand ── */}
        <motion.div className="brand" custom={0} variants={itemVariants} initial="hidden" animate="visible">
          <img src="/logo_meuBolso.png" alt="MeuBolso.digital" className="brand__logo" />
          <span className="brand__tagline">Bem-vindo de volta! Faça login para continuar</span>
        </motion.div>

        {/* ── Formulário ── */}
        <form onSubmit={handleSubmit} noValidate>

          {/* Alerta de erro */}
          {error && (
            <motion.div className="alert alert--error" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
              <AlertCircle size={14} /> {error}
            </motion.div>
          )}

          {/* Email */}
          <motion.div className="form-group" custom={1} variants={itemVariants} initial="hidden" animate="visible">
            <label className="form-label" htmlFor="login-email">Email</label>
            <div className="input-wrapper">
              <span className="input-icon"><Mail size={16} /></span>
              <input
                id="login-email"
                type="email"
                className="form-input"
                placeholder="voce@exemplo.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                autoComplete="email"
                aria-label="Email"
                disabled={isLocked}
              />
            </div>
          </motion.div>

          {/* Senha */}
          <motion.div className="form-group" custom={2} variants={itemVariants} initial="hidden" animate="visible">
            <label className="form-label" htmlFor="login-password">Senha</label>
            <div className="input-wrapper">
              <span className="input-icon"><Lock size={16} /></span>
              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                className="form-input"
                style={{ paddingRight: '42px' }}
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                autoComplete="current-password"
                aria-label="Senha"
                disabled={isLocked}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{ position: 'absolute', right: '16px', background: 'none', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer', padding: 0 }}
                tabIndex={-1}
                disabled={isLocked}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </motion.div>

          {/* Botão */}
          <motion.div custom={3} variants={itemVariants} initial="hidden" animate="visible" style={{ marginTop: '8px' }}>
            <button
              id="btn-login"
              type="submit"
              className="btn btn--primary"
              disabled={isLocked}
              style={isLocked ? { opacity: 0.72, cursor: 'not-allowed' } : {}}
            >
              {isLocked
                ? <><Spinner /> Autenticando...</>
                : <><LogIn size={17} /> Acessar</>
              }
            </button>
          </motion.div>
        </form>

        {/* ── Cadastro ── */}
        <motion.p className="text-helper" custom={4} variants={itemVariants} initial="hidden" animate="visible">
          Não tem uma conta?{' '}
          <button
            type="button"
            onClick={onSignUp}
            className="link"
            style={{ background: 'none', border: 'none', cursor: 'pointer', font: 'inherit', padding: 0 }}
          >
            Cadastre-se
          </button>
        </motion.p>

        {/* ── Footer ── */}
        <motion.div className="card-footer" custom={5} variants={itemVariants} initial="hidden" animate="visible">
          By Technocode · Paulo Tillmann · versão Nov.25
        </motion.div>

      </motion.div>
    </div>
  );
};

/* Spinner */
const Spinner: React.FC = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
    style={{ animation: 'spin 0.8s linear infinite' }}>
    <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
  </svg>
);

export default LoginPage;
