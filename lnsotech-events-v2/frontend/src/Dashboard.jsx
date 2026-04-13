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

  // States para criar novo utilizador (admin)
  const [newUserNome, setNewUserNome] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserSenha, setNewUserSenha] = useState('');
  const [newUserRole, setNewUserRole] = useState('leitor');

  const apiBase = '';

  const fetchData = async (search = '') => {
    try {
      setLoading(true);
      const url = search ? `${apiBase}/api/eventos?search=${search}` : `${apiBase}/api/eventos`;
      const resEv = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` } });
      if (resEv.ok) setEventos(await resEv.json());

      const resStats = await fetch(`${apiBase}/api/eventos/stats`, { headers: { 'Authorization': `Bearer ${token}` } });
      if (resStats.ok) setStats(await resStats.json());
      
      if (user.nivel_acesso === 'admin' || user.nivel_acesso === 'editor') {
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
      if(user.nivel_acesso !== 'admin') return alert('Só Admins apagam!');
      if(window.confirm('Apagar este registo?')) {
          await fetch(`${apiBase}/api/eventos/${id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` }});
          fetchData();
      }
  };

  const handleCreateUser = async (e) => {
      e.preventDefault();
      try {
          const res = await fetch(`${apiBase}/api/auth/usuarios`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
              body: JSON.stringify({ nome: newUserNome, email: newUserEmail, senha: newUserSenha, nivel_acesso: newUserRole })
          });
          const data = await res.json();
          if (res.ok) {
              alert('Utilizador criado com sucesso!');
              setNewUserNome(''); setNewUserEmail(''); setNewUserSenha(''); setNewUserRole('leitor');
              fetchData();
          } else {
              alert(data.erro || 'Erro ao criar utilizador');
          }
      } catch (err) { alert('Falha na comunicação'); }
  };

  const handleDeleteUser = async (id) => {
      if (window.confirm('Remover este utilizador?')) {
          const res = await fetch(`${apiBase}/api/auth/usuarios/${id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` }});
          const data = await res.json();
          if (res.ok) { fetchData(); } else { alert(data.erro || 'Erro'); }
      }
  };

  const percBodas = stats.totalEventos > 0 ? Math.round((stats.totalBodas / stats.totalEventos) * 100) : 0;

  /* ========== RENDER: DASHBOARD ========== */
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
          <div className="panel-title">Novo Registo (Manual)</div>
          {(user?.nivel_acesso === 'admin' || user?.nivel_acesso === 'editor') ? (
              <form className="inline-form" onSubmit={handleCreateEvento}>
                <input type="text" className="inline-input" placeholder="Nomes (Ex: João e Maria)" value={formNomes} onChange={e => setFormNomes(e.target.value)} required />
                <input type="date" className="inline-input" style={{flex: '0.4'}} value={formData} onChange={e => setFormData(e.target.value)} required />
                <button type="submit" className="btn-submit" disabled={loading}>+ Adicionar</button>
              </form>
          ) : (
              <div style={{color: '#94a3b8', fontSize: '0.9rem', fontStyle: 'italic'}}>Apenas admins/editores podem registar.</div>
          )}

          <div className="panel-title" style={{ marginTop: '1.5rem', marginBottom: '0.5rem' }}>Últimos Registos</div>
          <table className="table-minimal">
            <thead><tr><th>Nomes / Casal</th><th style={{textAlign: 'right'}}>Data Origem</th></tr></thead>
            <tbody>
              {loading ? ( <tr><td colSpan="2">A carregar...</td></tr> ) : eventos.length === 0 ? ( <tr><td colSpan="2">Sem eventos registados.</td></tr> ) : (
                eventos.slice(0, 5).map(ev => (
                  <tr key={ev.id}>
                    <td className="fw-bold">{ev.nomes_principais}</td>
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
    </>
  );

  /* ========== RENDER: EVENTOS ========== */
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
              {loading ? <tr><td colSpan="4">A carregar...</td></tr> : eventos.map(ev => (
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

  /* ========== RENDER: CONFIGURAÇÕES ========== */
  const renderConfig = () => (
      (user.nivel_acesso !== 'admin' && user.nivel_acesso !== 'editor') 
        ? <div className="panel-card"><p>Sem permissões para configurações. Contacte o Administrador.</p></div> 
        : <>
        {/* Templates de Mensagens */}
        <div className="panel-card" style={{marginBottom: '1.5rem'}}>
            <div className="panel-title">📝 Templates de Mensagens (Editor Dinâmico)</div>
            {templates.length > 0 ? templates.map(t => (
                <div key={t.id} style={{marginBottom: '1rem', background: '#f8fafc', padding: '1rem', borderRadius: '8px'}}>
                    <div style={{fontWeight: 600, marginBottom: '0.5rem', color: 'var(--primary)'}}>{t.tipo_evento.toUpperCase()}</div>
                    <textarea 
                        style={{width: '100%', minHeight: '60px', padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--border)', fontFamily: 'inherit'}} 
                        defaultValue={t.mensagem} 
                        onBlur={(e) => handleUpdateTemplate(t.id, e.target.value)}
                    />
                    <div style={{fontSize: '0.7rem', color: '#94a3b8'}}>Use &#123;nomes&#125; para inserir nomes do casal automaticamente. Clique fora do campo para gravar.</div>
                </div>
            )) : <p style={{fontSize: '0.9rem', color: '#64748b'}}>Nenhum template encontrado. O Admin deve correr o script v3_update.sql na VPS.</p>}
        </div>
        
        {/* Criar Utilizadores — Apenas Admin */}
        {user.nivel_acesso === 'admin' && (
        <div className="panel-card" style={{marginBottom: '1.5rem'}}>
            <div className="panel-title">👤 Criar Novo Utilizador</div>
            <form className="inline-form" onSubmit={handleCreateUser} style={{background: '#f8fafc', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border)', flexWrap: 'wrap'}}>
               <input type="text" className="inline-input" placeholder="Nome completo" value={newUserNome} onChange={e => setNewUserNome(e.target.value)} required />
               <input type="email" className="inline-input" placeholder="Email" value={newUserEmail} onChange={e => setNewUserEmail(e.target.value)} required />
               <input type="password" className="inline-input" placeholder="Senha" value={newUserSenha} onChange={e => setNewUserSenha(e.target.value)} required style={{flex: '0.3'}} />
               <select className="inline-input" style={{flex: '0.3'}} value={newUserRole} onChange={e=>setNewUserRole(e.target.value)}>
                   <option value="admin">Admin</option>
                   <option value="editor">Editor</option>
                   <option value="leitor">Leitor</option>
               </select>
               <button type="submit" className="btn-submit">+ Criar Conta</button>
            </form>
        </div>
        )}

        {/* Lista de Utilizadores — Apenas Admin */}
        {user.nivel_acesso === 'admin' && (
        <div className="panel-card">
            <div className="panel-title">🛡️ Utilizadores do Sistema</div>
            <table className="table-minimal">
               <thead><tr><th>Nome</th><th>Email</th><th>Nível</th><th>Ações</th></tr></thead>
               <tbody>
                   {usuarios.map(u => (
                      <tr key={u.id}>
                        <td>{u.nome}</td>
                        <td>{u.email}</td>
                        <td><span style={{padding: '2px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600, 
                          background: u.nivel_acesso === 'admin' ? '#dcfce7' : u.nivel_acesso === 'editor' ? '#dbeafe' : '#f1f5f9',
                          color: u.nivel_acesso === 'admin' ? '#166534' : u.nivel_acesso === 'editor' ? '#1e40af' : '#475569'
                        }}>{u.nivel_acesso?.toUpperCase()}</span></td>
                        <td>
                          {u.id !== 1 
                            ? <button onClick={() => handleDeleteUser(u.id)} style={{color: 'red', background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '0.85rem'}}>✖ Remover</button> 
                            : <span style={{color: '#94a3b8', fontSize: '0.8rem'}}>Root</span>}
                        </td>
                      </tr>
                   ))}
               </tbody>
            </table>
        </div>
        )}
      </>
  );

  /* ========== LAYOUT PRINCIPAL ========== */
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
            <span className="icon-btn" title="Nível de Privilégio">{user?.nivel_acesso==='admin' ? '🛡️' : (user?.nivel_acesso==='editor' ? '✏️' : '👁️')}</span>
            <div className="user-avatar" style={{width: '32px', height: '32px', fontSize: '0.8rem', background: user?.nivel_acesso==='admin' ? '#dcfce7' : '#e2e8f0', color: '#1e293b'}}>{user?.nome?.charAt(0) || 'U'}</div>
          </div>
        </header>

        <div className="content-wrapper">
          <h2 className="page-title">{activeTab === 'dashboard' ? 'Painel Executivo' : (activeTab === 'eventos' ? 'Gestão de Clientes' : 'Configurações de Sistema')}</h2>
          <p className="page-subtitle">LNSOTECH Automation CRM V3 — Sessão: {user?.nivel_acesso?.toUpperCase()}</p>
          
          {activeTab === 'dashboard' && renderDashboard()}
          {activeTab === 'eventos' && renderEventos()}
          {activeTab === 'configuracoes' && renderConfig()}

        </div>
      </main>
    </div>
  );
}
