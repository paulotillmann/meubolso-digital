import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL  = 'https://abkyvggiydvigugltboe.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFia3l2Z2dpeWR2aWd1Z2x0Ym9lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUyMzM1NjAsImV4cCI6MjA5MDgwOTU2MH0.VJr5knSwBHRFWLZDx5cowxJWdjD1ejKrmGjm9ncymCI';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});

// ── Tipos do domínio ─────────────────────────────────────────
export interface Profile {
  id: string;
  nome_completo: string | null;
  celular: string | null;
  avatar_url: string | null;
  renda_mensal: number;
  objetivo_principal: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Transacao {
  id: string;
  user_id: string;
  tipo_transacao: 'DESPESAS' | 'RECEITAS';
  referente: string;
  categoria_id: string | null;
  categoria_nome: string | null;
  especie: string | null;
  valor: number;
  data: string | null;
  data_text: string | null;
  created_at: string;
}

export interface Categoria {
  id: string;
  descricao: string;
  created_at: string;
}

// ── Helpers de Auth ──────────────────────────────────────────
export const authHelpers = {
  /** Login com email/senha */
  async signIn(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  },

  /** Cadastro de novo usuário */
  async signUp(email: string, password: string, meta: {
    nome_completo: string;
    celular?: string;
    avatar_url?: string;
    renda_mensal?: number;
    objetivo_principal?: string;
  }) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: meta },
    });
    if (error) throw error;
    return data;
  },

  /** Logout */
  async signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  },

  /** Sessão atual */
  async getSession() {
    const { data } = await supabase.auth.getSession();
    return data.session;
  },

  /** Usuário atual */
  async getUser() {
    const { data } = await supabase.auth.getUser();
    return data.user;
  },

  /** Busca profile do usuário */
  async getProfile(userId: string): Promise<Profile | null> {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    if (error) return null;
    return data;
  },

  /** Atualiza profile */
  async updateProfile(userId: string, updates: Partial<Profile>) {
    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', userId)
      .select()
      .single();
    if (error) throw error;
    return data;
  },
};

console.log('supabase lib evaluated', supabase);
