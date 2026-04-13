import React, { useState, useEffect, useRef } from 'react';

export default function Dashboard({ token, user, onLogout }) {
  const [eventos, setEventos] = useState([]);
  const [stats, setStats] = useState({ totalEventos: 0, totalBodas: 0, totalAniversarios: 0, gruposAtivos: 0, lembretesEnviados: 0, falhasHoje: 0 });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [searchQuery, setSearchQuery] = useState('');

  const [formNomes, setFormNomes] = useState('');
  const [formData, setFormData] = useState('');
  const [formTipo, setFormTipo] = useState('casamento');
  const [formGrupo, setFormGrupo] = useState('');

  const [usuarios, setUsuarios] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [logs, setLogs] = useState([]);

  const [newUserNome, setNewUserNome] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserSenha, setNewUserSenha] = useState('');
  const [newUserRole, setNewUserRole] = useState('leitor');

  const csvRef = useRef(null);
  const fotoRef = useRef(null);
  const [uploadingFotoId, setUploadingFotoId] = useState(null);

  const apiBase = '';
  const headers = { 'Authorization': `Bearer ${token}` };
  const jsonHeaders = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` };

  // =================== FETCH DATA =================== //
  const fetchData = async (search = '') => {
    try {
      setLoading(true);
      const url = search ? `${apiBase}/api/eventos?search=${search}` : `${apiBase}/api/eventos`;
      const resEv = await fetch(url, { headers });
      if (resEv.ok) setEventos(await resEv.json());

      const resStats = await fetch(`${apiBase}/api/eventos/stats`, { headers });
      if (resStats.ok) setStats(await resStats.json());
      
      if (user.nivel_acesso === 'admin' || user.nivel_acesso === 'editor') {
        const resUsr = await fetch(`${apiBase}/api/auth/usuarios`, { headers });
        if (resUsr.ok) setUsuarios(await resUsr.json());
        const resTp = await fetch(`${apiBase}/api/eventos/templates`, { headers });
        if (resTp.ok) setTemplates(await resTp.json());
      }

      if (user.nivel_acesso === 'admin') {
        const resLogs = await fetch(`${apiBase}/api/eventos/logs`, { headers });
        if (resLogs.ok) setLogs(await resLogs.json());
      }
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchData(searchQuery); }, [activeTab, searchQuery]);

  // =================== HANDLERS =================== //
  const handleExportCSV = () => window.open(`${apiBase}/api/eventos?exportCsv=true`, '_blank');

  const handleImportCSV = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('csv', file);
    try {
      const res = await fetch(`${apiBase}/api/eventos/importar`, { method: 'POST', headers: { 'Authorization': `Bearer ${token}` }, body: formData });
      const data = await res.json();
      alert(data.mensagem || 'Importação concluída');
      fetchData();
    } catch (err) { alert('Erro na importação'); }
    e.target.value = '';
  };

  const handleCreateEvento = async (e) => {
    e.preventDefault();
    if (user.nivel_acesso !== 'admin' && user.nivel_acesso !== 'editor') return alert("Permissão negada!");
    const payload = { nomes_principais: formNomes, data_evento: formData, tipo_evento: formTipo, grupo_id: formGrupo || 'Painel_Web', criado_por: user.id };
    try {
      const res = await fetch(`${apiBase}/api/eventos`, { method: 'POST', headers: jsonHeaders, body: JSON.stringify(payload) });
      if (res.ok) { setFormNomes(''); setFormData(''); setFormGrupo(''); alert('Registado!'); fetchData(); }
      else alert('Erro ao guardar!');
    } catch (error) { alert("Falha na comunicação."); }
  };

  const handleUploadFoto = async (eventoId) => {
    const file = fotoRef.current?.files[0];
    if (!file) return alert('Seleccione uma foto primeiro');
    setUploadingFotoId(eventoId);
    const fd = new FormData();
    fd.append('foto', file);
    try {
      const res = await fetch(`${apiBase}/api/eventos/${eventoId}/foto`, { method: 'POST', headers: { 'Authorization': `Bearer ${token}` }, body: fd });
      if (res.ok) { alert('Foto anexada!'); fetchData(); }
      else alert('Erro ao enviar foto');
    } catch (e) { alert('Falha'); }
    setUploadingFotoId(null);
    fotoRef.current.value = '';
  };
  
  const handleUpdateTemplate = async (id, novaMSG) => {
    await fetch(`${apiBase}/api/eventos/templates/${id}`, { method: 'PUT', headers: jsonHeaders, body: JSON.stringify({mensagem: novaMSG}) });
    alert('Template Salvo!');
  };

  const apagarEvento = async (id) => {
    if (user.nivel_acesso !== 'admin') return alert('Só Admins apagam!');
    if (window.confirm('Apagar este registo?')) {
      await fetch(`${apiBase}/api/eventos/${id}`, { method: 'DELETE', headers });
      fetchData();
    }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    const res = await fetch(`${apiBase}/api/auth/usuarios`, { method: 'POST', headers: jsonHeaders, body: JSON.stringify({ nome: newUserNome, email: newUserEmail, senha: newUserSenha, nivel_acesso: newUserRole }) });
    const data = await res.json();
    if (res.ok) { alert('Utilizador criado!'); setNewUserNome(''); setNewUserEmail(''); setNewUserSenha(''); setNewUserRole('leitor'); fetchData(); }
    else alert(data.erro || 'Erro ao criar');
  };

  const handleDeleteUser = async (id) => {
    if (window.confirm('Remover?')) {
      const res = await fetch(`${apiBase}/api/auth/usuarios/${id}`, { method: 'DELETE', headers });
      const d = await res.json(); if (res.ok) fetchData(); else alert(d.erro);
    }
  };

  const handleTesteConexao = async () => {
    const grupo = prompt('ID do grupo WhatsApp (ou deixe vazio para o padrão):');
    const res = await fetch(`${apiBase}/api/eventos/teste-conexao`, { method: 'POST', headers: jsonHeaders, body: JSON.stringify({ grupo_id: grupo || undefined }) });
    const d = await res.json();
    alert(d.mensagem || d.erro);
  };

  const percBodas = stats.totalEventos > 0 ? Math.round((stats.totalBodas / stats.totalEventos) * 100) : 0;

  /* ========== RENDER: DASHBOARD ========== */
  const renderDashboard = () => (
    <>
      <div className="stats-grid">
        <div className="stat-card"><div className="stat-header">Eventos Totais<div className="stat-icon-wrapper bg-green-light">📈</div></div><div className="stat-value">{stats.totalEventos}</div></div>
        <div className="stat-card"><div className="stat-header">Grupos Activos<div className="stat-icon-wrapper bg-green-light">💍</div></div><div className="stat-value">{stats.gruposAtivos}</div></div>
        <div className="stat-card"><div className="stat-header">Lembretes Enviados<div className="stat-icon-wrapper bg-yellow-light">🔔</div></div><div className="stat-value">{stats.lembretesEnviados}</div></div>
        <div className="stat-card"><div className="stat-header">Falhas<div className="stat-icon-wrapper" style={{background:'#fee2e2'}}>⚠️</div></div><div className="stat-value" style={{color: stats.falhasHoje > 0 ? '#dc2626':'#10b981'}}>{stats.falhasHoje}</div></div>
      </div>

      <div className="middle-grid">
        <div className="panel-card" style={{ gap: '1rem' }}>
          <div className="panel-title">Novo Registo</div>
          {(user?.nivel_acesso === 'admin' || user?.nivel_acesso === 'editor') ? (
            <form className="inline-form" onSubmit={handleCreateEvento}>
              <input type="text" className="inline-input" placeholder="Nomes (João e Maria)" value={formNomes} onChange={e => setFormNomes(e.target.value)} required />
              <input type="date" className="inline-input" style={{flex:'0.3'}} value={formData} onChange={e => setFormData(e.target.value)} required />
              <select className="inline-input" style={{flex:'0.25'}} value={formTipo} onChange={e=>setFormTipo(e.target.value)}>
                <option value="casamento">Casamento</option><option value="aniversario">Aniversário</option>
                <option value="batizado">Batizado</option><option value="formatura">Formatura</option>
              </select>
              <input type="text" className="inline-input" style={{flex:'0.3'}} placeholder="ID Grupo WhatsApp (opcional)" value={formGrupo} onChange={e => setFormGrupo(e.target.value)} />
              <button type="submit" className="btn-submit" disabled={loading}>+ Guardar</button>
            </form>
          ) : (<div className="text-muted">Apenas admins/editores podem registar.</div>)}

          <div className="panel-title" style={{ marginTop: '1rem' }}>Últimos 5 Registos</div>
          <table className="table-minimal">
            <thead><tr><th>Nomes</th><th>Tipo</th><th style={{textAlign:'right'}}>Data</th></tr></thead>
            <tbody>
              {loading ? <tr><td colSpan="3">A carregar...</td></tr> : eventos.length === 0 ? <tr><td colSpan="3">Sem eventos.</td></tr> : 
                eventos.slice(0,5).map(ev => (
                  <tr key={ev.id}>
                    <td className="fw-bold">{ev.nomes_principais}</td>
                    <td><span className="badge-tipo">{ev.tipo_evento}</span></td>
                    <td style={{textAlign:'right'}}>{new Date(ev.data_evento).toLocaleDateString()}</td>
                  </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="panel-card">
          <div className="panel-title">Distribuição</div>
          <div className="pie-container">
            <div className="pie-chart"><div className="pie-inner">{percBodas}%<span style={{fontSize:'0.6rem',color:'#64748b',fontWeight:400}}>Bodas</span></div></div>
            <div className="pie-legend">
              <div className="legend-item"><div className="dot blue"></div> Aniversários ({stats.totalAniversarios})</div>
              <div className="legend-item"><div className="dot green"></div> Bodas ({stats.totalBodas})</div>
              <div className="legend-item"><div className="dot yellow"></div> Outros ({stats.totalEventos - stats.totalBodas - stats.totalAniversarios})</div>
            </div>
          </div>
          {user.nivel_acesso === 'admin' && (
            <button onClick={handleTesteConexao} className="btn-submit" style={{marginTop:'1rem',width:'100%',background:'#1e293b'}}>🤖 Enviar Teste de Conexão</button>
          )}
        </div>
      </div>
    </>
  );

  /* ========== RENDER: EVENTOS (BASE DE DADOS) ========== */
  const renderEventos = () => (
    <div className="panel-card" style={{ gap: '1rem' }}>
      <div className="eventos-toolbar">
        <div className="panel-title" style={{margin:0}}>Base de Dados de Clientes</div>
        <div className="toolbar-buttons">
          <button onClick={handleExportCSV} className="btn-submit" style={{background:'#1e293b'}}>📥 Exportar CSV</button>
          {(user.nivel_acesso === 'admin' || user.nivel_acesso === 'editor') && (
            <>
              <input type="file" accept=".csv" ref={csvRef} onChange={handleImportCSV} style={{display:'none'}} />
              <button onClick={() => csvRef.current?.click()} className="btn-submit" style={{background:'#0f766e'}}>📤 Importar CSV</button>
            </>
          )}
        </div>
      </div>
      
      {(user.nivel_acesso === 'admin' || user.nivel_acesso === 'editor') && (
        <form className="inline-form" onSubmit={handleCreateEvento} style={{background:'#f8fafc',padding:'1rem',borderRadius:'8px',border:'1px solid var(--border)'}}>
          <input type="text" className="inline-input" placeholder="Nomes" value={formNomes} onChange={e=>setFormNomes(e.target.value)} required />
          <input type="date" className="inline-input" style={{flex:'0.3'}} value={formData} onChange={e=>setFormData(e.target.value)} required />
          <select className="inline-input" style={{flex:'0.25'}} value={formTipo} onChange={e=>setFormTipo(e.target.value)}>
            <option value="casamento">Casamento</option><option value="aniversario">Aniversário</option>
            <option value="batizado">Batizado</option><option value="formatura">Formatura</option>
          </select>
          <input type="text" className="inline-input" style={{flex:'0.3'}} placeholder="ID Grupo WhatsApp" value={formGrupo} onChange={e=>setFormGrupo(e.target.value)} />
          <button type="submit" className="btn-submit" disabled={loading}>+ Guardar</button>
        </form>
      )}

      <div className="table-responsive">
        <table className="table-minimal" style={{marginTop:'1rem'}}>
          <thead><tr><th>Nomes</th><th>Data</th><th>Tipo</th><th>Grupo</th><th>Foto</th><th>Gestão</th></tr></thead>
          <tbody>
            {loading ? <tr><td colSpan="6">A carregar...</td></tr> : eventos.map(ev => (
              <tr key={ev.id}>
                <td className="fw-bold">{ev.nomes_principais}</td>
                <td>{new Date(ev.data_evento).toLocaleDateString()}</td>
                <td><span className="badge-tipo">{ev.tipo_evento}</span></td>
                <td className="text-small">{ev.grupo_id?.substring(0,20)}{ev.grupo_id?.length > 20 ? '...' : ''}</td>
                <td>
                  {ev.foto_url ? <span title={ev.foto_url}>📷</span> : (
                    (user.nivel_acesso === 'admin' || user.nivel_acesso === 'editor') && (
                      <div className="foto-upload-mini">
                        <input type="file" ref={uploadingFotoId === ev.id ? fotoRef : null} accept="image/*" onChange={() => setUploadingFotoId(ev.id)} style={{width:'70px',fontSize:'0.7rem'}} />
                        {uploadingFotoId === ev.id && <button onClick={() => handleUploadFoto(ev.id)} className="btn-mini">📎</button>}
                      </div>
                    )
                  )}
                </td>
                <td>
                  {user.nivel_acesso === 'admin' && <button onClick={() => apagarEvento(ev.id)} className="btn-danger-text">✖</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  /* ========== RENDER: LOGS ========== */
  const renderLogs = () => (
    <div className="panel-card">
      <div className="panel-title">📋 Logs Detalhados (Últimos 100)</div>
      <div className="table-responsive">
        <table className="table-minimal">
          <thead><tr><th>Data/Hora</th><th>Tipo</th><th>Status</th><th>Mensagem</th><th>Grupo</th></tr></thead>
          <tbody>
            {logs.length === 0 ? <tr><td colSpan="5">Sem logs registados.</td></tr> : logs.map(l => (
              <tr key={l.id}>
                <td className="text-small">{new Date(l.criado_em).toLocaleString()}</td>
                <td><span className="badge-tipo">{l.tipo_log}</span></td>
                <td><span style={{color: l.status === 'sucesso' ? '#10b981' : '#dc2626', fontWeight: 600}}>{l.status?.toUpperCase()}</span></td>
                <td className="text-small">{l.mensagem?.substring(0,60)}{l.mensagem?.length > 60 ? '...' : ''}</td>
                <td className="text-small">{l.grupo_id?.substring(0,15)}...</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  /* ========== RENDER: CONFIGURAÇÕES ========== */
  const renderConfig = () => (
    (user.nivel_acesso !== 'admin' && user.nivel_acesso !== 'editor') 
      ? <div className="panel-card"><p>Sem permissões. Contacte o Administrador.</p></div> 
      : <>
      <div className="panel-card" style={{marginBottom:'1.5rem'}}>
        <div className="panel-title">📝 Templates de Mensagens</div>
        {templates.length > 0 ? templates.map(t => (
          <div key={t.id} className="template-card">
            <div className="template-label">{t.tipo_evento.toUpperCase()}</div>
            <textarea className="template-textarea" defaultValue={t.mensagem} onBlur={(e) => handleUpdateTemplate(t.id, e.target.value)} />
            <div className="text-muted" style={{fontSize:'0.7rem'}}>Use &#123;nomes&#125; e &#123;bodas&#125; como variáveis. Clique fora para gravar.</div>
          </div>
        )) : <p className="text-muted">Nenhum template. Corra v5_upgrade.sql na VPS.</p>}
      </div>
      
      {user.nivel_acesso === 'admin' && (<>
        <div className="panel-card" style={{marginBottom:'1.5rem'}}>
          <div className="panel-title">👤 Criar Novo Utilizador</div>
          <form className="inline-form" onSubmit={handleCreateUser} style={{background:'#f8fafc',padding:'1rem',borderRadius:'8px',border:'1px solid var(--border)',flexWrap:'wrap'}}>
            <input type="text" className="inline-input" placeholder="Nome completo" value={newUserNome} onChange={e=>setNewUserNome(e.target.value)} required />
            <input type="email" className="inline-input" placeholder="Email" value={newUserEmail} onChange={e=>setNewUserEmail(e.target.value)} required />
            <input type="password" className="inline-input" placeholder="Senha" value={newUserSenha} onChange={e=>setNewUserSenha(e.target.value)} required style={{flex:'0.25'}} />
            <select className="inline-input" style={{flex:'0.25'}} value={newUserRole} onChange={e=>setNewUserRole(e.target.value)}>
              <option value="admin">Admin</option><option value="editor">Editor</option><option value="leitor">Leitor</option>
            </select>
            <button type="submit" className="btn-submit">+ Criar</button>
          </form>
        </div>

        <div className="panel-card">
          <div className="panel-title">🛡️ Utilizadores do Sistema</div>
          <div className="table-responsive">
            <table className="table-minimal">
              <thead><tr><th>Nome</th><th>Email</th><th>Nível</th><th>Ações</th></tr></thead>
              <tbody>
                {usuarios.map(u => (
                  <tr key={u.id}>
                    <td>{u.nome}</td><td>{u.email}</td>
                    <td><span className={`badge-role badge-${u.nivel_acesso}`}>{u.nivel_acesso?.toUpperCase()}</span></td>
                    <td>{u.id !== 1 ? <button onClick={() => handleDeleteUser(u.id)} className="btn-danger-text">✖ Remover</button> : <span className="text-muted">Root</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </>)}
    </>
  );

  /* ========== LAYOUT PRINCIPAL ========== */
  return (
    <div className="dashboard-layout">
      <aside className="sidebar">
        <div className="sidebar-logo">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z"></path><path d="M2 17l10 5 10-5"></path><path d="M2 12l10 5 10-5"></path></svg>
          <span>LNSOTECH</span>
        </div>
        <nav className="nav-menu">
          <div className={`nav-item ${activeTab==='dashboard'?'active':''}`} onClick={()=>setActiveTab('dashboard')}><span>📊</span><span>Dashboard</span></div>
          <div className={`nav-item ${activeTab==='eventos'?'active':''}`} onClick={()=>setActiveTab('eventos')}><span>👥</span><span>Eventos/Casais</span></div>
          {user.nivel_acesso === 'admin' && <div className={`nav-item ${activeTab==='logs'?'active':''}`} onClick={()=>setActiveTab('logs')}><span>📋</span><span>Logs</span></div>}
          <div className={`nav-item ${activeTab==='configuracoes'?'active':''}`} onClick={()=>setActiveTab('configuracoes')}><span>⚙️</span><span>Configurações</span></div>
        </nav>
        <div className="sidebar-footer">
          <div className="user-avatar">{user?.nome?.charAt(0) || 'U'}</div>
          <div className="user-info">
            <h4>{user?.nome || 'Utilizador'}</h4>
            <p>{user?.nivel_acesso === 'admin' ? 'Administrador' : (user?.nivel_acesso === 'editor' ? 'Editor' : 'Leitor')}</p>
          </div>
          <div style={{cursor:'pointer',marginLeft:'auto',color:'#94a3b8'}} onClick={onLogout} title="Sair">🚪</div>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <button className="mobile-menu-btn" onClick={() => document.querySelector('.sidebar').classList.toggle('open')}>☰</button>
          <div className="search-bar-container">
            <input type="text" className="search-bar" placeholder="🔍 Buscar nomes, datas, tipos..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
          </div>
          <div className="topbar-icons">
            <span className="icon-btn" title={`Nível: ${user?.nivel_acesso}`}>{user?.nivel_acesso==='admin' ? '🛡️' : (user?.nivel_acesso==='editor' ? '✏️' : '👁️')}</span>
            {stats.falhasHoje > 0 && <span className="icon-btn notification-badge" title="Existem falhas!">🔔</span>}
            <div className="user-avatar topbar-avatar">{user?.nome?.charAt(0) || 'U'}</div>
          </div>
        </header>

        <div className="content-wrapper">
          <h2 className="page-title">{
            activeTab === 'dashboard' ? 'Painel Executivo' : 
            activeTab === 'eventos' ? 'Gestão de Clientes' : 
            activeTab === 'logs' ? 'Logs do Sistema' : 'Configurações'
          }</h2>
          <p className="page-subtitle">LNSOTECH Automation CRM — {user?.nivel_acesso?.toUpperCase()}</p>
          
          {activeTab === 'dashboard' && renderDashboard()}
          {activeTab === 'eventos' && renderEventos()}
          {activeTab === 'logs' && renderLogs()}
          {activeTab === 'configuracoes' && renderConfig()}
        </div>
      </main>
    </div>
  );
}
