import React, { useState } from 'react';

export default function Login({ onLogin }) {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const apiBase = import.meta.env.VITE_API_URL || 'http://167.86.89.208:3000';
      const res = await fetch(`${apiBase}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, senha })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.erro || 'Falha no login');
      }

      // Sucesso
      onLogin(data.token, data.usuario);

    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="glass-panel login-card">
        <div className="login-icon">💍</div>
        <h1 className="login-title">LNSOTECH Events</h1>
        <p className="login-subtitle">Aceda ao Painel de Administração v2</p>

        <form onSubmit={handleSubmit}>
          <div className="input-group">
            <label className="input-label">E-mail Administrativo</label>
            <input 
              type="email" 
              className="auth-input" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Ex: admin@lnsotech.com"
              required 
            />
          </div>

          <div className="input-group">
            <label className="input-label">Palavra-passe</label>
            <input 
              type="password" 
              className="auth-input" 
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              placeholder="••••••••"
              required 
            />
          </div>

          {error && <div className="error-msg">{error}</div>}

          <button type="submit" className="btn-primary" disabled={loading} style={{ marginTop: '1.5rem' }}>
            {loading ? 'A autenticar...' : 'Entrar no Sistema'}
          </button>
        </form>
      </div>
    </div>
  );
}
