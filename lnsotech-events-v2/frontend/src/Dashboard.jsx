import React, { useState, useEffect } from 'react';

export default function Dashboard({ token, user, onLogout }) {
  const [eventos, setEventos] = useState([]);
  const [loading, setLoading] = useState(true);

  const apiBase = '';

  const fetchEventos = async () => {
    try {
      const res = await fetch(`${apiBase}/api/eventos`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) setEventos(data);
    } catch (err) {
      console.error('Erro ao buscar eventos:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEventos();
  }, []);

  const totalEventos = eventos.length;
  // Conta de casamentos (exemplo simples)
  const totalCasamentos = eventos.filter(e => e.tipo_evento === 'casamento').length;

  return (
    <div className="dashboard-layout">
      {/* SIDEBAR */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z"></path><path d="M2 17l10 5 10-5"></path><path d="M2 12l10 5 10-5"></path></svg>
          <span>LNSOTECH</span>
        </div>
        <nav className="nav-menu">
          <div className="nav-item active">
            <span>📊</span>
            <span>Dashboard</span>
          </div>
          <div className="nav-item">
            <span>👥</span>
            <span>Grupos</span>
          </div>
          <div className="nav-item">
            <span>⚙️</span>
            <span>Configurações</span>
          </div>
        </nav>
        
        <div className="sidebar-footer">
          <div className="user-avatar">{user?.nome?.charAt(0) || 'L'}</div>
          <div className="user-info">
            <h4>{user?.nome || 'Admin'}</h4>
            <p>Admin / Tailwind</p>
          </div>
          <div style={{cursor: 'pointer', marginLeft: 'auto', color: '#94a3b8'}} onClick={onLogout} title="Sair">
             🚪
          </div>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className="main-area">
        <header className="topbar">
          <div className="search-bar-container">
            <input type="text" className="search-bar" placeholder="🔍  Buscar eventos..." />
          </div>
          <div className="topbar-icons">
            <span className="icon-btn">📁</span>
            <span className="icon-btn">🔔</span>
            <div className="user-avatar" style={{width: '32px', height: '32px', fontSize: '0.8rem', background: '#e2e8f0', color: '#1e293b'}}>AD</div>
          </div>
        </header>

        <div className="content-wrapper">
          <h2 className="page-title">Dashboard</h2>
          <p className="page-subtitle">Bem-vindo(a) de volta. Aqui tens o panorama do teu bot.</p>

          {/* ESTASTÍTICAS */}
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-header">
                Total de Eventos
                <div className="stat-icon-wrapper bg-green-light">📈</div>
              </div>
              <div className="stat-value">{totalEventos}</div>
              <div className="stat-trend trend-up">↗ +12.0% <span style={{color: '#94a3b8', fontWeight: 400}}>hoje</span></div>
              <svg className="stat-chart-line" preserveAspectRatio="none" viewBox="0 0 100 20"><path d="M0,20 Q20,10 40,15 T100,5" fill="none" stroke="#10b981" strokeWidth="2"/></svg>
            </div>
            <div className="stat-card">
              <div className="stat-header">
                Bodas Ativas
                <div className="stat-icon-wrapper bg-green-light">💍</div>
              </div>
              <div className="stat-value">{totalCasamentos}</div>
              <div className="stat-trend trend-up">↗ +5.0% <span style={{color: '#94a3b8', fontWeight: 400}}>hoje</span></div>
              <svg className="stat-chart-line" preserveAspectRatio="none" viewBox="0 0 100 20"><path d="M0,15 Q20,20 40,10 T100,5" fill="none" stroke="#10b981" strokeWidth="2"/></svg>
            </div>
            <div className="stat-card">
              <div className="stat-header">
                Lembretes Enviados
                <div className="stat-icon-wrapper bg-yellow-light">🔔</div>
              </div>
              <div className="stat-value">5600</div>
              <div className="stat-trend trend-down">↘ -2.2% <span style={{color: '#94a3b8', fontWeight: 400}}>ontem</span></div>
              <svg className="stat-chart-line" preserveAspectRatio="none" viewBox="0 0 100 20"><path d="M0,5 Q20,15 40,5 T100,10" fill="none" stroke="#f59e0b" strokeWidth="2"/></svg>
            </div>
          </div>

          {/* MEIO */}
          <div className="middle-grid">
            <div className="panel-card" style={{ gap: '1rem' }}>
              <div className="panel-title">Novo Registo (Manual)</div>
              <form className="inline-form" onSubmit={(e) => { e.preventDefault(); alert("Integração com POST do Backend a ser implementada!"); }}>
                 <input type="text" className="inline-input" placeholder="Nomes (Ex: João e Maria)" required />
                 <input type="date" className="inline-input" style={{flex: '0.4'}} required />
                 <button type="submit" className="btn-submit">Adicionar</button>
              </form>

              <div className="panel-title" style={{ marginTop: '1.5rem', marginBottom: '0.5rem' }}>Últimos Registos</div>
              <table className="table-minimal">
                <thead>
                  <tr>
                    <th>Nomes</th>
                    <th style={{textAlign: 'right'}}>Data Origem</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                     <tr><td colSpan="2">A carregar...</td></tr>
                  ) : eventos.length === 0 ? (
                     <tr><td colSpan="2">Sem eventos. Usa o !reg no WhatsApp.</td></tr>
                  ) : (
                    eventos.slice(0, 3).map(ev => (
                      <tr key={ev.id}>
                        <td className="fw-bold">{ev.nomes_principais} <span className="badge-casamento" style={{marginLeft: '8px'}}>Boda</span></td>
                        <td style={{textAlign: 'right'}}>{new Date(ev.data_evento).toLocaleDateString()}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="panel-card">
               <div className="panel-title">Tipos de Lembretes</div>
               <div className="pie-container">
                  <div className="pie-chart">
                     <div className="pie-inner">
                        55%<span style={{fontSize: '0.6rem', color: '#64748b', fontWeight: 400}}>Bodas</span>
                     </div>
                  </div>
                  <div className="pie-legend">
                     <div className="legend-item"><div className="dot blue"></div> Aniversários</div>
                     <div className="legend-item"><div className="dot green"></div> Bodas</div>
                     <div className="legend-item"><div className="dot yellow"></div> Outros</div>
                  </div>
               </div>
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}
