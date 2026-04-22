import React, { useState } from 'react';

export default function Login({ onLogin }) {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [twoFactorToken, setTwoFactorToken] = useState('');
  const [require2FA, setRequire2FA] = useState(false);
  const [userIdFor2FA, setUserIdFor2FA] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const apiBase = '';
      
      if (require2FA) {
        // Verificar Token 2FA
        const res = await fetch(`${apiBase}/api/auth/login/2fa/verify`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: userIdFor2FA, token: twoFactorToken })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.erro || 'Código inválido');
        onLogin(data.token, data.usuario);
        return;
      }

      const res = await fetch(`${apiBase}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, senha })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.erro || 'Falha no login');
      }

      if (data.require2FA) {
        setRequire2FA(true);
        setUserIdFor2FA(data.userId);
        return;
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
        <div className="login-icon">
          <img src="/icon.png" alt="KUMBUKA" style={{width:'120px', marginBottom:'1.5rem'}} />
        </div>
        <h1 className="login-title">KUMBUKA Events</h1>

        <form onSubmit={handleSubmit}>
          {!require2FA ? (
            <>
              <div className="input-group">
                <label className="input-label">E-mail Administrativo</label>
                <input 
                  type="email" 
                  className="auth-input" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Ex: admin@kumbuka.com"
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
            </>
          ) : (
            <div className="input-group" style={{animation:'fadeIn 0.5s'}}>
              <label className="input-label">Código de Autenticação (2FA)</label>
              <input 
                type="text" 
                className="auth-input" 
                style={{textAlign:'center', fontSize:'1.5rem', letterSpacing:'0.5rem'}}
                value={twoFactorToken}
                onChange={(e) => setTwoFactorToken(e.target.value.replace(/\D/g,'').substring(0,6))}
                placeholder="000 000"
                autoFocus
                required 
              />
              <p style={{fontSize:'0.75rem', color:'#64748b', marginTop:'0.5rem'}}>Insira o código do seu Google Authenticator ou similar.</p>
            </div>
          )}

          {error && <div className="error-msg">{error}</div>}

          <button type="submit" className="btn-primary" disabled={loading} style={{ marginTop: '1.5rem' }}>
            {loading ? 'A processar...' : (require2FA ? 'Verificar Código' : 'Entrar no Sistema')}
          </button>
          
          {require2FA && (
            <button type="button" className="btn-action" onClick={() => setRequire2FA(false)} style={{width:'100%', marginTop:'1rem', fontSize:'0.8rem'}}>
              Voltar ao Login
            </button>
          )}
        </form>
      </div>
    </div>
  );
}
