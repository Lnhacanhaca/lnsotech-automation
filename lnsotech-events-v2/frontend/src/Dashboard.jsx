import React, { useState, useEffect } from 'react';

export default function Dashboard({ token, user, onLogout }) {
  const [eventos, setEventos] = useState([]);
  const [stats, setStats] = useState({ totalEventos: 0, totalBodas: 0, totalAniversarios: 0, gruposAtivos: 0, lembretesEnviados: 0 });
  const [loading, setLoading] = useState(true);
  
  // States para o form de adição manual
  const [formNomes, setFormNomes] = useState('');
  const [formData, setFormData] = useState('');

  const apiBase = '';

  const fetchData = async () => {
    try {
      setLoading(true);
      // Busca Eventos
      const resEv = await fetch(`${apiBase}/api/eventos`, { headers: { 'Authorization': `Bearer ${token}` } });
      if (resEv.ok) setEventos(await resEv.json());

      // Busca Estatisticas
      const resStats = await fetch(`${apiBase}/api/eventos/stats`, { headers: { 'Authorization': `Bearer ${token}` } });
      if (resStats.ok) setStats(await resStats.json());

    } catch (err) {
      console.error('Erro ao buscar dados:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleCreateEvento = async (e) => {
    e.preventDefault();
    if (user.nivel_acesso !== 'admin' && user.nivel_acesso !== 'editor') {
        alert("Não tens permissões suficientes para adicionar eventos!");
        return;
    }
    
    try {
      const payload = {
          nomes_principais: formNomes,
          data_evento: formData,
          tipo_evento: 'casamento', // assume casamento por predefinição do painel antigo, pode ser escalado
          grupo_id: 'Registo_Via_Painel_Web',
          criado_por: user.id
      };
      
      const res = await fetch(`${apiBase}/api/eventos`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
      
      if (res.ok) {
          setFormNomes(''); setFormData('');
          fetchData(); // atualiza a tabela e as stats!
      } else {
          alert('Erro ao guardar!');
      }
    } catch (error) {
      alert("Falha fatal na comunicação.");
    }
  };

  const percBodas = stats.totalEventos > 0 ? Math.round((stats.totalBodas / stats.totalEventos) * 100) : 0;

  return (
    <div className="dashboard-layout">
      {/* SIDEBAR */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z"></path><path d="M2 17l10 5 10-5"></path><path d="M2 12l10 5 10-5"></path></svg>
          <span>LNSOTECH</span>
        </div>
        <nav className="nav-menu">
          <div className="nav-item active"><span>📊</span><span>Dashboard</span></div>
          <div className="nav-item"><span>👥</span><span>Grupos ({stats.gruposAtivos})</span></div>
          <div className="nav-item" onClick={() => alert("Módulo em desenvolvimento!")}><span>⚙️</span><span>Configurações</span></div>
        </nav>
        
        <div className="sidebar-footer">
          <div className="user-avatar">{user?.nome?.charAt(0) || 'L'}</div>
          <div className="user-info">
            <h4>{user?.nome || 'Admin'}</h4>
            <p>{user?.nivel_acesso === 'admin' ? 'Administrador' : 'Editor'}</p>
          </div>
          <div style={{cursor: 'pointer', marginLeft: 'auto', color: '#94a3b8'}} onClick={onLogout} title="Sair">🚪</div>
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
            <div className={`user-avatar ${user?.nivel_acesso==='admin'?'bg-green-light':''}`} style={{width: '32px', height: '32px', fontSize: '0.8rem', background: '#e2e8f0', color: '#1e293b'}}>AD</div>
          </div>
        </header>

        <div className="content-wrapper">
          <h2 className="page-title">Dashboard</h2>
          <p className="page-subtitle">O motor já está configurado. Lembretes automáticos diários 8AM!</p>

          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-header">Total de Eventos<div className="stat-icon-wrapper bg-green-light">📈</div></div>
              <div className="stat-value">{stats.totalEventos}</div>
            </div>
            <div className="stat-card">
              <div className="stat-header">Grupos Geridos<div className="stat-icon-wrapper bg-green-light">💍</div></div>
              <div className="stat-value">{stats.gruposAtivos}</div>
            </div>
            <div className="stat-card">
              <div className="stat-header">Lembretes Enviados<div className="stat-icon-wrapper bg-yellow-light">🔔</div></div>
              <div className="stat-value">{stats.lembretesEnviados + 5600} <span style={{fontSize: '0.8rem', color: '#94a3b8'}}>(Histórico)</span></div>
            </div>
          </div>

          <div className="middle-grid">
            <div className="panel-card" style={{ gap: '1rem' }}>
              <div className="panel-title">Novo Registo (Manual)</div>
              {user?.nivel_acesso === 'admin' ? (
                  <form className="inline-form" onSubmit={handleCreateEvento}>
                    <input type="text" className="inline-input" placeholder="Nomes (Ex: João e Maria)" value={formNomes} onChange={e => setFormNomes(e.target.value)} required />
                    <input type="date" className="inline-input" style={{flex: '0.4'}} value={formData} onChange={e => setFormData(e.target.value)} required />
                    <button type="submit" className="btn-submit" disabled={loading}>+ Adicionar</button>
                  </form>
              ) : (
                  <div style={{color: '#94a3b8', fontSize: '0.9rem', fontStyle: 'italic'}}>Apenas admins podem inserir dados manuais direto no servidor.</div>
              )}

              <div className="panel-title" style={{ marginTop: '1.5rem', marginBottom: '0.5rem' }}>Últimos Registos</div>
              <table className="table-minimal">
                <thead><tr><th>Nomes / Casal</th><th style={{textAlign: 'right'}}>Data Origem</th></tr></thead>
                <tbody>
                  {loading ? ( <tr><td colSpan="2">A carregar banco de dados...</td></tr> ) : eventos.length === 0 ? ( <tr><td colSpan="2">Sem eventos na V2. O Bot aguarda o uso de !reg.</td></tr> ) : (
                    eventos.slice(0, 5).map(ev => (
                      <tr key={ev.id}>
                        <td className="fw-bold">{ev.nomes_principais} 
                          <span className={ev.tipo_evento === 'casamento' ? 'badge-casamento' : ''} style={{marginLeft: '8px', fontSize:'0.7rem', fontWeight:'normal', color:'#64748b'}}>{ev.grupo_id?.substring(0, 8)}...</span>
                        </td>
                        <td style={{textAlign: 'right'}}>{new Date(ev.data_evento).toLocaleDateString()}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="panel-card">
               <div className="panel-title">Distribuição de Eventos</div>
               <div className="pie-container">
                  <div className="pie-chart">
                     <div className="pie-inner">
                        {percBodas}%<span style={{fontSize: '0.6rem', color: '#64748b', fontWeight: 400}}>Bodas</span>
                     </div>
                  </div>
                  <div className="pie-legend">
                     <div className="legend-item"><div className="dot blue"></div> Aniversários ({stats.totalAniversarios})</div>
                     <div className="legend-item"><div className="dot green"></div> Bodas ({stats.totalBodas})</div>
                     <div className="legend-item"><div className="dot yellow"></div> Outros (0)</div>
                  </div>
               </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
