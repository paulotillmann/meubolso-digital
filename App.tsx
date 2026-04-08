import React, { useState, useEffect } from 'react';
import './src/styles/design-system.css';
import LoginPage      from './src/pages/Login';
import RegisterPage   from './src/pages/Register';
import Dashboard      from './src/pages/Dashboard';
import ProfilePage    from './src/pages/Profile';
import Transacoes     from './src/pages/Transacoes';
import { supabase, authHelpers } from './src/lib/supabase';
import type { Session } from '@supabase/supabase-js';

type Page = 'login' | 'register' | 'dashboard' | 'profile' | 'transacoes';

const App: React.FC = () => {
  const [page, setPage]             = useState<Page>('login');
  const [session, setSession]       = useState<Session | null>(null);
  const [loading, setLoading]       = useState(true);
  const [loginError, setLoginError] = useState('');
  const [isProcessingEntry, setIsProcessingEntry] = useState(false); // Para travar o login enquanto busca profile

  useEffect(() => {
    let isMounted = true;
    
    const initAuth = async () => {
      try {
        if (!supabase || !supabase.auth) {
          setLoginError('Erro interno: falha ao inicializar o banco de dados.');
          if (isMounted) setLoading(false);
          return;
        }

        // Timeout de fallback para destravar a tela se Supabase engasgar
        const sessionPromise = supabase.auth.getSession();
        const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 4000));
        
        const { data } = await Promise.race([sessionPromise, timeoutPromise]) as any;

        if (data?.session) {
          try {
            const profile = await authHelpers.getProfile(data.session.user.id);
            if (profile && profile.is_active === false) {
              await authHelpers.signOut();
              if (isMounted) setLoginError('Sua conta foi inativada e precisa ser liberada pelo administrador do sistema.');
              return;
            }
          } catch {}
          if (isMounted) setSession(data.session);
        }
      } catch {
        // Silenciosamente vai para o login
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    initAuth();

    const { data: listener } = supabase.auth.onAuthStateChange(async (event, s) => {
      if (event === 'SIGNED_IN' && s) {
        if (isMounted) setIsProcessingEntry(true);
        try {
          // Timeout de 5s para buscar profile - evita travar a tela de login
          const profilePromise = authHelpers.getProfile(s.user.id);
          const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 5000));
          
          const profile = await Promise.race([profilePromise, timeoutPromise]) as any;

          if (profile && profile.is_active === false) {
            await authHelpers.signOut();
            if (isMounted) {
              setLoginError('Sua conta foi inativada e precisa ser liberada pelo administrador do sistema.');
              setIsProcessingEntry(false);
            }
            return;
          }
        } catch (err) {
          console.error('[Auth Listener] Erro ao validar perfil ou timeout:', err);
        } finally {
          if (isMounted) {
            setSession(s);
            setIsProcessingEntry(false);
          }
        }
      } else if (event === 'SIGNED_OUT') {
        if (isMounted) {
          setSession(null);
          setPage('login');
          setIsProcessingEntry(false);
        }
      }
    });

    return () => {
      isMounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  if (loading) {
    return (
      <div className="page-center">
        <div style={{ color: 'var(--color-text-muted)', fontSize: '14px' }}>Carregando...</div>
      </div>
    );
  }

  if (session) {
    if (page === 'profile') {
      return (
        <ProfilePage
          session={session}
          onBack={() => setPage('dashboard')}
        />
      );
    }
    if (page === 'transacoes') {
      return (
        <Transacoes
          session={session}
          onBack={() => setPage('dashboard')}
        />
      );
    }
    return (
      <Dashboard
        session={session}
        onOpenProfile={() => setPage('profile')}
        onOpenTransacoes={() => setPage('transacoes')}
      />
    );
  }

  if (page === 'register') {
    return (
      <RegisterPage
        onBack={() => setPage('login')}
        onRegisterSuccess={() => setPage('login')}
      />
    );
  }

  return (
    <LoginPage
      onSignUp={() => setPage('register')}
      onLoginSuccess={() => { /* sessão capturada pelo listener */ }}
      externalError={loginError}
      onClearExternalError={() => setLoginError('')}
      isProcessingAuth={isProcessingEntry}
    />
  );
};

export default App;