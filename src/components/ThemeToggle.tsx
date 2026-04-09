import React, { useEffect, useState } from 'react';
import { Sun, Moon } from 'lucide-react';

const ThemeToggle: React.FC = () => {
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  useEffect(() => {
    // Escuta mudanças de tema se outro componente alterar, ou lê a inicial
    const current = document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
    setTheme(current);

    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.attributeName === 'data-theme') {
          const newTheme = document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
          setTheme(newTheme);
        }
      });
    });

    observer.observe(document.documentElement, { attributes: true });
    return () => observer.disconnect();
  }, []);

  const toggle = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('theme', next);
  };

  return (
    <button
      onClick={toggle}
      title={`Alternar para modo ${theme === 'dark' ? 'claro' : 'escuro'}`}
      style={{
        width: 38, height: 38, borderRadius: '50%',
        border: '1px solid var(--color-border)',
        background: 'var(--color-bg-input)',
        color: 'var(--color-text-primary)',
        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'all 0.2s', flexShrink: 0,
      }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--color-brand-cyan)'; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--color-border)'; }}
    >
      {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
    </button>
  );
};

export default ThemeToggle;
