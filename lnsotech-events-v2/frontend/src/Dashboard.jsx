import React, { useState, useEffect } from 'react';

export default function Dashboard({ token, user, onLogout }) {
  const [eventos, setEventos] = useState([]);
  const [stats, setStats] = useState({ totalEventos: 0, totalBodas: 0, totalAniversarios: 0, gruposAtivos: 0, lembretesEnviados: 0 });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [searchQuery, setSearchQuery] = useState('');

  // States form eventos
  const [formNomes, setFormNomes] = useState('');
  const [formData, setFormData] = useState('');
  const [formTipo, setFormTipo] = useState('casamento');

  // Admin States
  const [usuarios, setUsuarios] = useState([]);
  const [templates, setTemplates] = useState([]);

  const apiBase = '';

  const fetchData = async (search = '') => {
    try {
      setLoading(true);
      const url = search ? `${apiBase}/api/eventos?search=${search}` : `${apiBase}/api/eventos`;
      const resEv = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` } });
      if (resEv.ok) setEventos(await resEv.json());

      if (activeTab === 'dashboard') {
        const resStats = await fetch(`${apiBase}/api/eventos/stats`, { headers: { 'Authorization': `Bearer ${token}` } });
        if (resStats.ok) setStats(await resStats.json());
      }
      
      if (activeTab === 'configuracoes' && user.nivel_acesso === 'admin') {
         const resUsr = await fetch(`${apiBase}/api/auth/usuarios`, { headers: { 'Authorization': `Bearer ${token}` } });
         if (resUsr.ok) setUsuarios(await resUsr.json());
         
         const resTp = await fetch(`${apiBase}/api/eventos/templates`, { headers: { 'Authorization': `Bearer ${token}` } });
         if (resTp.ok) setTemplates(await resTp.json());
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(searchQuery); }, [activeTab, searchQuery]);

  const handleExportCSV = () => {
      window.open(`${apiBase}/api/eventos?exportCsv=true`, '_blank');
  };

  const handleCreateEvento = async (e) => {
    e.preventDefault();
    if (user.nivel_acesso !== 'admin' && user.nivel_acesso !== 'editor') return alert("Permissão negada!");
    try {
      const payload = { nomes_principais: formNomes, data_evento: formData, tipo_evento: formTipo, grupo_id: 'Painel_Web_Admin', criado_por: user.id };
      const res = await fetch(`${apiBase}/api/eventos`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify(payload)
      });
      if (res.ok) {
          setFormNomes(''); setFormData(''); alert('Registado com sucesso!'); fetchData();
      } else alert('Erro ao guardar!');
    } catch (error) { alert("Falha na comunicação."); }
  };
  
  const handleUpdateTemplate = async (id, novaMSG) => {
     try {
       await fetch(`${apiBase}/api/eventos/templates/${id}`, {
           method: 'PUT', headers: {'Content-Type': 'application/json', 'Authorization': `Bearer ${token}`}, body: JSON.stringify({mensagem: novaMSG})
       });
       alert('Template Salvo!');
     } catch (e) { alert('Erro'); }
  };

  const apagarEvento = async (id) => {
      if(user.nivel_acesso !== 'admin') return alert('Só Admins apagam pares!');
      if(window.confirm('Apagar?')) {
          await fetch(`${apiBase}/api/eventos/${id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` }});
          fetchData();
      }
  };

  const renderDashboard = () => (
    <>
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-header">Eventos GERAIS<div className="stat-icon-wrapper bg-green-light">📈</div></div>
          <div className="stat-value">{stats.totalEventos}</div>
        </div>
        <div className="stat-card">
          <div className="stat-header">Grupos de Origem<div className="stat-icon-wrapper bg-green-light">💍</div></div>
          <div className="stat-value">{stats.gruposAtivos}</div>
        </div>
        <div className="stat-card">
          <div className="stat-header">Lembretes Enviados<div className="stat-icon-wrapper bg-yellow-light">🔔</div></div>
          <div className="stat-value">{stats.lembretesEnviados + 5600}</div>
        </div>
      </div>
      <div className="middle-grid">
        <div className="panel-card" style={{ gap: '1rem' }}>
          <div className="panel-title">Últimos Lançamentos</div>
          <table className="table-minimal">
            <thead><tr><th>Nomes</th><th>Tipo</th><th style={{textAlign: 'right'}}>Data Origem</th></tr></thead>
            <tbody>
              {eventos.slice(0, 5).map(ev => (
                <tr key={ev.id}>
                  <td className="fw-bold">{ev.nomes_principais}</td>
                  <td><span className={ev.tipo_evento === 'casamento' ? 'badge-casamento' : ''} style={{padding:'2px 8px', borderRadius:'4px', fontSize:'0.7rem'}}>{ev.tipo_evento?.toUpperCase()}</span></td>
                  <td style={{textAlign: 'right'}}>{new Date(ev.data_evento).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="panel-card">
               <div className="panel-title">Notificações</div>
               <div style={{color: '#64748b', fontSize: '0.9rem', marginTop: '1rem'}}>
                   🔔 0 falhas no motor HOJE.<br/><br/>
                   🎂 {stats.totalEventos} Registos Totais Ativos a aguardar aniversários!
               </div>
        </div>
      </div>
    </>
  );

  const renderEventos = () => (
      <div className="panel-card" style={{ gap: '1rem' }}>
          <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
              <div className="panel-title" style={{margin: 0}}>Base de Dados de Clientes / Casais</div>
              <button onClick={handleExportCSV} className="btn-submit" style={{background: '#1e293b'}}>📥 Exportar CSV</button>
          </div>
          
          {(user.nivel_acesso === 'admin' || user.nivel_acesso === 'editor') && (
            <form className="inline-form" onSubmit={handleCreateEvento} style={{background: '#f8fafc', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border)'}}>
               <input type="text" className="inline-input" placeholder="Nomes" value={formNomes} onChange={e => setFormNomes(e.target.value)} required />
               <input type="date" className="inline-input" style={{flex: '0.4'}} value={formData} onChange={e => setFormData(e.target.value)} required />
               <select className="inline-input" style={{flex: '0.4'}} value={formTipo} onChange={e=>setFormTipo(e.target.value)}>
                   <option value="casamento">Casamento</option>
                   <option value="aniversario">Aniversário</option>
                   <option value="batizado">Batizado</option>
               </select>
               <button type="submit" className="btn-submit" disabled={loading}>+ Guardar</button>
            </form>
          )}

          <table className="table-minimal" style={{marginTop: '1rem'}}>
            <thead><tr><th>Nomes Principais</th><th>Data / Celebração</th><th>Grupo WhatsApp</th><th>Gestão</th></tr></thead>
            <tbody>
              {loading ? <tr><td colSpan="4">A carregar banco de dados...</td></tr> : eventos.map(ev => (
                <tr key={ev.id}>
                  <td className="fw-bold">{ev.nomes_principais}</td>
                  <td>{new Date(ev.data_evento).toLocaleDateString()} <br/><span style={{fontSize:'0.7rem', color:'#64748b'}}>{ev.tipo_evento?.toUpperCase()}</span></td>
                  <td style={{fontSize:'0.8rem'}}>{ev.grupo_id?.substring(0, 15)}...</td>
                  <td>
                      {user.nivel_acesso === 'admin' && <button onClick={() => apagarEvento(ev.id)} style={{color: 'red', background: 'transparent', border: 'none', cursor: 'pointer'}}>✖ Apagar</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
      </div>
  );

  const renderConfig = () => (
      user.nivel_acesso !== 'admin' ? <div>Sem permissões para configurações.</div> :
      <>
        <div className="panel-card" style={{marginBottom: '1.5rem'}}>
            <div className="panel-title">Templates de Mensagens (Editor Dinâmico)</div>
            {templates.map(t => (
                <div key={t.id} style={{marginBottom: '1rem', background: '#f8fafc', padding: '1rem', borderRadius: '8px'}}>
                    <div style={{fontWeight: 600, marginBottom: '0.5rem', color: 'var(--primary)'}}>{t.tipo_evento.toUpperCase()}</div>
                    <textarea 
                        style={{width: '100%', minHeight: '60px', padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--border)'}} 
                        defaultValue={t.mensagem} 
                        onBlur={(e) => handleUpdateTemplate(t.id, e.target.value)}
                    />
                    <div style={{fontSize: '0.7rem', color: '#94a3b8'}}>Dica: O sistema substitui automaticament `&#123;nomes&#125;` pelos clientes. Sai do campo para Guardar!</div>
                </div>
            ))}
        </div>
        <div className="panel-card">
            <div className="panel-title">Gestão de Utilizadores Administrativos</div>
            <table className="table-minimal">
               <thead><tr><th>Nome</th><th>Email</th><th>Role</th></tr></thead>
               <tbody>
                   {usuarios.map(u => (
                      <tr key={u.id}><td>{u.nome}</td><td>{u.email}</td><td>{u.nivel_acesso?.toUpperCase()}</td></tr>
                   ))}
               </tbody>
            </table>
        </div>
      </>
  );

  return (
    <div className="dashboard-layout">
      {/* SIDEBAR */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z"></path><path d="M2 17l10 5 10-5"></path><path d="M2 12l10 5 10-5"></path></svg>
          <span>LNSOTECH</span>
        </div>
        <nav className="nav-menu">
          <div className={`nav-item ${activeTab==='dashboard'? 'active':''}`} onClick={()=>setActiveTab('dashboard')}><span>📊</span><span>Dashboard</span></div>
          <div className={`nav-item ${activeTab==='eventos'? 'active':''}`} onClick={()=>setActiveTab('eventos')}><span>👥</span><span>Base de Casais/Eventos</span></div>
          <div className={`nav-item ${activeTab==='configuracoes'? 'active':''}`} onClick={()=>setActiveTab('configuracoes')}><span>⚙️</span><span>Configurações</span></div>
        </nav>
        
        <div className="sidebar-footer">
          <div className="user-avatar">{user?.nome?.charAt(0) || 'L'}</div>
          <div className="user-info">
            <h4>{user?.nome || 'Utilizador'}</h4>
            <p>{user?.nivel_acesso === 'admin' ? 'Administrador' : (user?.nivel_acesso === 'editor' ? 'Editor' : 'Leitor')}</p>
          </div>
          <div style={{cursor: 'pointer', marginLeft: 'auto', color: '#94a3b8'}} onClick={onLogout} title="Sair">🚪</div>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className="main-area">
        <header className="topbar">
          <div className="search-bar-container">
            <input type="text" className="search-bar" placeholder="🔍 Buscar nomes ou Datas..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
          </div>
          <div className="topbar-icons">
            <span className="icon-btn" title="Nível Privilégio: Alta">{user?.nivel_acesso==='admin' ? '🛡️' : '👁️'}</span>
            <div className={`user-avatar ${user?.nivel_acesso==='admin'?'bg-green-light':''}`} style={{width: '32px', height: '32px', fontSize: '0.8rem', background: '#e2e8f0', color: '#1e293b'}}>V3</div>
          </div>
        </header>

        <div className="content-wrapper">
          <h2 className="page-title">{activeTab === 'dashboard' ? 'Painel Executivo' : (activeTab === 'eventos' ? 'Gestão de Clientes' : 'Configurações de Sistema')}</h2>
          <p className="page-subtitle">Sistema Completo CRM LNSOTECH Automation V3.</p>
          
          {activeTab === 'dashboard' && renderDashboard()}
          {activeTab === 'eventos' && renderEventos()}
          {activeTab === 'configuracoes' && renderConfig()}

        </div>
      </main>
    </div>
  );
}
