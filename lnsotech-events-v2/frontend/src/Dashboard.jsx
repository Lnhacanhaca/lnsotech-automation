import React, { useState, useEffect, useRef } from 'react';

export default function Dashboard({ token, user: rawUser, onLogout }) {
  // FIX: suportar tanto "nivel" (token antigo) como "nivel_acesso" (token novo)
  const user = { ...rawUser, nivel_acesso: rawUser.nivel_acesso || rawUser.nivel || 'leitor' };
  const isAdmin = user.nivel_acesso === 'admin';
  const isEditor = user.nivel_acesso === 'editor';
  const canEdit = isAdmin || isEditor;

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
  const [grupos, setGrupos] = useState([]);
  const [gruposLoading, setGruposLoading] = useState(false);
  const [waStatus, setWaStatus] = useState({ qr: null, status: 'desconhecido', lastUpdate: null });

  const [newUserNome, setNewUserNome] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserSenha, setNewUserSenha] = useState('');
  const [newUserRole, setNewUserRole] = useState('leitor');
  const [editingUserId, setEditingUserId] = useState(null);
  const [editUserForm, setEditUserForm] = useState({ nome: '', email: '', senha: '', nivel_acesso: 'leitor' });

  const csvRef = useRef(null);

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
      
      if (canEdit) {
        const resUsr = await fetch(`${apiBase}/api/auth/usuarios`, { headers });
        if (resUsr.ok) setUsuarios(await resUsr.json());
        const resTp = await fetch(`${apiBase}/api/eventos/templates`, { headers });
        if (resTp.ok) setTemplates(await resTp.json());
      }

      if (isAdmin) {
        const resLogs = await fetch(`${apiBase}/api/eventos/logs`, { headers });
        if (resLogs.ok) setLogs(await resLogs.json());
      }
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const fetchGrupos = async () => {
    setGruposLoading(true);
    try {
      const res = await fetch(`${apiBase}/api/eventos/grupos`, { headers });
      if (res.ok) setGrupos(await res.json());
      else { const d = await res.json(); alert(d.erro || 'Bot offline'); }
    } catch (e) { alert('Falha ao carregar grupos'); }
    setGruposLoading(false);
  };

  const fetchWaStatus = async () => {
    try {
      const res = await fetch(`${apiBase}/api/eventos/whatsapp-status`, { headers });
      if (res.ok) setWaStatus(await res.json());
    } catch (e) { console.error('Erro status WP', e); }
  };

  useEffect(() => { fetchData(searchQuery); }, [activeTab, searchQuery]);
  useEffect(() => { 
    let interval;
    if (activeTab === 'grupos') {
      if (grupos.length === 0) fetchGrupos(); 
      fetchWaStatus();
      interval = setInterval(fetchWaStatus, 5000);
    }
    return () => clearInterval(interval);
  }, [activeTab]);

  // =================== HANDLERS =================== //
  const handleReconectarWA = async () => {
    if (!window.confirm('Isto irá desconectar o WhatsApp atual e pedir um novo QR code. O bot vai reiniciar. Continuar?')) return;
    try {
      const res = await fetch(`${apiBase}/api/eventos/whatsapp-reconectar`, { method: 'POST', headers: jsonHeaders });
      const d = await res.json();
      alert(d.mensagem || 'A reiniciar...');
      fetchWaStatus();
    } catch (e) { alert('Erro ao pedir reconexão'); }
  };

  const handleExportCSV = () => window.open(`${apiBase}/api/eventos?exportCsv=true`, '_blank');

  const handleImportCSV = async (e) => {
    const file = e.target.files[0]; if (!file) return;
    const fd = new FormData(); fd.append('csv', file);
    const res = await fetch(`${apiBase}/api/eventos/importar`, { method: 'POST', headers: { 'Authorization': `Bearer ${token}` }, body: fd });
    const data = await res.json(); alert(data.mensagem || 'Concluído'); fetchData();
    e.target.value = '';
  };

  const handleCreateEvento = async (e) => {
    e.preventDefault();
    if (!canEdit) return alert("Permissão negada!");
    if (!formGrupo) return alert("Seleccione um grupo WhatsApp!");
    const payload = { nomes_principais: formNomes, data_evento: formData, tipo_evento: formTipo, grupo_id: formGrupo, criado_por: user.id };
    const res = await fetch(`${apiBase}/api/eventos`, { method: 'POST', headers: jsonHeaders, body: JSON.stringify(payload) });
    if (res.ok) { setFormNomes(''); setFormData(''); alert('Registado!'); fetchData(); }
    else alert('Erro ao guardar!');
  };

  const handleUploadFoto = async (eventoId, file) => {
    if (!file) return;
    const fd = new FormData(); fd.append('foto', file);
    const res = await fetch(`${apiBase}/api/eventos/${eventoId}/foto`, { method: 'POST', headers: { 'Authorization': `Bearer ${token}` }, body: fd });
    if (res.ok) { alert('Foto anexada!'); fetchData(); } else alert('Erro');
  };
  
  const handleUpdateTemplate = async (id, msg) => {
    await fetch(`${apiBase}/api/eventos/templates/${id}`, { method: 'PUT', headers: jsonHeaders, body: JSON.stringify({mensagem: msg}) });
    alert('Template Salvo!');
  };

  const apagarEvento = async (id) => {
    if (!isAdmin) return alert('Só Admins!');
    if (window.confirm('Apagar?')) { await fetch(`${apiBase}/api/eventos/${id}`, { method: 'DELETE', headers }); fetchData(); }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    const res = await fetch(`${apiBase}/api/auth/usuarios`, { method: 'POST', headers: jsonHeaders, body: JSON.stringify({ nome: newUserNome, email: newUserEmail, senha: newUserSenha, nivel_acesso: newUserRole }) });
    const d = await res.json();
    if (res.ok) { alert('Criado!'); setNewUserNome(''); setNewUserEmail(''); setNewUserSenha(''); setNewUserRole('leitor'); fetchData(); }
    else alert(d.erro || 'Erro');
  };

  const handleDeleteUser = async (id) => {
    if (window.confirm('Remover?')) { const res = await fetch(`${apiBase}/api/auth/usuarios/${id}`, { method: 'DELETE', headers }); if (res.ok) fetchData(); }
  };

  const startEditUser = (u) => {
    setEditingUserId(u.id);
    setEditUserForm({ nome: u.nome, email: u.email, senha: '', nivel_acesso: u.nivel_acesso });
  };

  const handleUpdateUser = async () => {
    const res = await fetch(`${apiBase}/api/auth/usuarios/${editingUserId}`, {
      method: 'PUT', headers: jsonHeaders,
      body: JSON.stringify(editUserForm)
    });
    const d = await res.json();
    if (res.ok) { alert('✅ ' + d.mensagem); setEditingUserId(null); fetchData(); }
    else alert('❌ ' + (d.erro || 'Erro ao atualizar'));
  };

  const handleTesteConexao = async (grupoId, nomeGrupo) => {
    const code = Math.floor(1000 + Math.random() * 9000);
    const userInput = window.prompt(`PERIGO: Você está prestes a enviar uma mensagem de teste para todos os membros do grupo "${nomeGrupo || 'este grupo'}".\n\nIsso pode incomodar os clientes.\nPara confirmar, digite exatamente este código de segurança:\n${code}`);
    
    if (userInput !== code.toString()) {
        if (userInput !== null) alert('Operação cancelada! O código inserido está incorreto.');
        return;
    }

    try {
        const res = await fetch(`${apiBase}/api/eventos/teste-conexao`, { method: 'POST', headers: jsonHeaders, body: JSON.stringify({ grupo_id: grupoId }) });
        const d = await res.json();
        alert(d.mensagem || d.erro);
    } catch(err) {
        alert('Erro ao testar comunicação');
    }
  };

  const percBodas = stats.totalEventos > 0 ? Math.round((stats.totalBodas / stats.totalEventos) * 100) : 0;

  // Helper: dropdown de grupos
  const GrupoSelect = ({ value, onChange, style }) => (
    <select className="inline-input" style={style || {flex:'0.35'}} value={value} onChange={onChange}>
      <option value="">-- Seleccionar Grupo --</option>
      {grupos.map(g => <option key={g.id} value={g.id}>{g.nome} ({g.participantes} membros)</option>)}
      <option value="__manual__">Inserir ID manualmente...</option>
    </select>
  );

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
        <div className="panel-card" style={{gap:'1rem'}}>
          <div className="panel-title">Novo Registo</div>
          {canEdit ? (
            <form className="inline-form" onSubmit={handleCreateEvento}>
              <input type="text" className="inline-input" placeholder="Nomes (Ex: João e Maria)" value={formNomes} onChange={e=>setFormNomes(e.target.value)} required />
              <input type="date" className="inline-input" style={{flex:'0.3'}} value={formData} onChange={e=>setFormData(e.target.value)} required />
              <select className="inline-input" style={{flex:'0.25'}} value={formTipo} onChange={e=>setFormTipo(e.target.value)}>
                <option value="casamento">Casamento</option><option value="aniversario">Aniversário</option>
                <option value="batizado">Batizado</option><option value="formatura">Formatura</option>
              </select>
              <GrupoSelect value={formGrupo} onChange={e => {
                if (e.target.value === '__manual__') { const id = prompt('Cole o ID do grupo:'); if (id) setFormGrupo(id); }
                else setFormGrupo(e.target.value);
              }} />
              <button type="submit" className="btn-submit" disabled={loading}>+ Guardar</button>
            </form>
          ) : <div className="text-muted">Apenas admins/editores podem registar.</div>}
          <div className="panel-title" style={{marginTop:'1rem'}}>Últimos 5 Registos</div>
          <table className="table-minimal">
            <thead><tr><th>Nomes</th><th>Tipo</th><th style={{textAlign:'right'}}>Data</th></tr></thead>
            <tbody>
              {loading ? <tr><td colSpan="3">A carregar...</td></tr> : eventos.length === 0 ? <tr><td colSpan="3">Sem eventos.</td></tr> :
                eventos.slice(0,5).map(ev => (
                  <tr key={ev.id}><td className="fw-bold">{ev.nomes_principais}</td><td><span className="badge-tipo">{ev.tipo_evento}</span></td><td style={{textAlign:'right'}}>{new Date(ev.data_evento).toLocaleDateString()}</td></tr>
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
        </div>
      </div>
    </>
  );

  /* ========== RENDER: EVENTOS ========== */
  const renderEventos = () => (
    <div className="panel-card" style={{gap:'1rem'}}>
      <div className="eventos-toolbar">
        <div className="panel-title" style={{margin:0}}>Base de Dados de Clientes</div>
        <div className="toolbar-buttons">
          <button onClick={handleExportCSV} className="btn-submit" style={{background:'#1e293b'}}>📥 Exportar CSV</button>
          {canEdit && (<>
            <input type="file" accept=".csv" ref={csvRef} onChange={handleImportCSV} style={{display:'none'}} />
            <button onClick={() => csvRef.current?.click()} className="btn-submit" style={{background:'#0f766e'}}>📤 Importar CSV</button>
          </>)}
        </div>
      </div>
      {canEdit && (
        <form className="inline-form" onSubmit={handleCreateEvento} style={{background:'#f8fafc',padding:'1rem',borderRadius:'8px',border:'1px solid var(--border)'}}>
          <input type="text" className="inline-input" placeholder="Nomes" value={formNomes} onChange={e=>setFormNomes(e.target.value)} required />
          <input type="date" className="inline-input" style={{flex:'0.3'}} value={formData} onChange={e=>setFormData(e.target.value)} required />
          <select className="inline-input" style={{flex:'0.25'}} value={formTipo} onChange={e=>setFormTipo(e.target.value)}>
            <option value="casamento">Casamento</option><option value="aniversario">Aniversário</option>
            <option value="batizado">Batizado</option><option value="formatura">Formatura</option>
          </select>
          <GrupoSelect value={formGrupo} onChange={e => { if (e.target.value==='__manual__') { const id=prompt('ID:'); if(id)setFormGrupo(id); } else setFormGrupo(e.target.value); }} />
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
                <td>{new Date(ev.data_evento).toLocaleDateString()}<br/><span className="text-small">{ev.tipo_evento?.toUpperCase()}</span></td>
                <td><span className="badge-tipo">{ev.tipo_evento}</span></td>
                <td className="text-small" title={ev.grupo_id}>{grupos.find(g=>g.id===ev.grupo_id)?.nome || ev.grupo_id?.substring(0,18)}{ev.grupo_id?.length>18 ? '...':''}</td>
                <td>
                  {ev.foto_url ? (
                    <div style={{display:'flex', alignItems:'center', gap:'0.4rem'}}>
                      <img
                        src={ev.foto_url}
                        alt="Foto"
                        title="Clique para ampliar"
                        onClick={() => window.open(ev.foto_url, '_blank')}
                        style={{width:'38px', height:'38px', borderRadius:'6px', objectFit:'cover', cursor:'pointer', border:'2px solid #e2e8f0'}}
                      />
                      {canEdit && (
                        <label title="Substituir foto" style={{cursor:'pointer', fontSize:'1rem'}}>
                          🔄<input type="file" accept="image/*" style={{display:'none'}} onChange={e=>handleUploadFoto(ev.id, e.target.files[0])} />
                        </label>
                      )}
                    </div>
                  ) : (
                    canEdit && <label className="btn-mini" style={{cursor:'pointer'}}>📎 Foto<input type="file" accept="image/*" style={{display:'none'}} onChange={e=>handleUploadFoto(ev.id, e.target.files[0])} /></label>
                  )}
                </td>
                <td>{isAdmin && <button onClick={()=>apagarEvento(ev.id)} className="btn-danger-text">✖</button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  /* ========== RENDER: GRUPOS WHATSAPP E QR CODE ========== */
  const renderGrupos = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {isAdmin && (
        <div className="panel-card">
          <div className="panel-title" style={{margin:0}}>🔌 Conexão WhatsApp</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.5rem', alignItems: 'center', marginTop: '1rem' }}>
            <div style={{ flex: '1', minWidth: '250px' }}>
              <p>Status: <span className="badge-tipo" style={{fontSize: '0.85rem'}}>{waStatus.status?.toUpperCase()}</span></p>
              {waStatus.status === 'aguardando_qr' && waStatus.qr && (
                <div style={{ marginTop: '1rem', background: '#fff', padding: '10px', display: 'inline-block', borderRadius: '8px', border: '1px solid var(--border)' }}>
                  <img src={waStatus.qr} alt="WhatsApp QR Code" style={{ width: '220px', height: '220px', display: 'block' }} />
                  <p style={{ fontSize: '0.8rem', textAlign: 'center', marginTop: '0.5rem', color: 'var(--text-secondary)' }}>Escaneie com o app do WhatsApp</p>
                </div>
              )}
              {waStatus.status === 'conectado' && (
                <div style={{ marginTop: '1rem', color: '#10b981', fontWeight: 'bold' }}>✅ Bot conectado e a comunicar!</div>
              )}
            </div>
            <div style={{ flex: '1', minWidth: '250px' }}>
              <p className="text-muted" style={{ marginBottom: '1rem', fontSize: '0.85rem' }}>
                Se quiseres ligar outro dispositivo ou se o bot perdeu a conexão, podes forçar uma nova ligação. Isto apagará a sessão antiga e gerará um novo QR Code.
              </p>
              <button onClick={handleReconectarWA} className="btn-submit" style={{ background: '#f59e0b', color: '#000' }}>
                🔄 Forçar Nova Conexão (Gerar QR)
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="panel-card">
        <div className="eventos-toolbar">
          <div className="panel-title" style={{margin:0}}>📱 Grupos WhatsApp do Bot</div>
          <button onClick={fetchGrupos} className="btn-submit" disabled={gruposLoading}>{gruposLoading ? 'A carregar...' : '🔄 Atualizar Lista'}</button>
        </div>
        <p className="text-muted" style={{marginBottom:'1rem'}}>Estes são todos os grupos onde o bot está presente. Seleccione um grupo ao criar eventos para definir onde o lembrete será enviado.</p>
      
      {gruposLoading ? <p>A buscar grupos do WhatsApp...</p> : grupos.length === 0 ? <p className="text-muted">Nenhum grupo encontrado. O bot pode estar offline.</p> : (
        <div className="table-responsive">
          <table className="table-minimal">
            <thead><tr><th>Nome do Grupo</th><th>Membros</th><th>ID WhatsApp</th><th>Ações</th></tr></thead>
            <tbody>
              {grupos.map(g => (
                <tr key={g.id}>
                  <td className="fw-bold">{g.nome}</td>
                  <td>{g.participantes}</td>
                  <td className="text-small" style={{fontFamily:'monospace',fontSize:'0.7rem'}}>{g.id}</td>
                  <td>
                    <div className="toolbar-buttons">
                      {isAdmin && <button onClick={()=>handleTesteConexao(g.id, g.nome)} className="btn-submit" style={{padding:'0.3rem 0.6rem',fontSize:'0.75rem'}}>🤖 Testar</button>}
                      <button onClick={() => {
                        // Tenta clipboard moderno, mas tem fallback para HTTP/contextos não-seguros
                        const copiar = (texto) => {
                          if (navigator.clipboard && window.isSecureContext) {
                            navigator.clipboard.writeText(texto).then(() => alert('✅ ID copiado!')).catch(() => {
                              // fallback manual
                              const el = document.createElement('textarea');
                              el.value = texto; el.style.position='fixed'; el.style.opacity='0';
                              document.body.appendChild(el); el.select();
                              document.execCommand('copy'); document.body.removeChild(el);
                              alert('✅ ID copiado!');
                            });
                          } else {
                            const el = document.createElement('textarea');
                            el.value = texto; el.style.position='fixed'; el.style.opacity='0';
                            document.body.appendChild(el); el.select();
                            document.execCommand('copy'); document.body.removeChild(el);
                            alert('✅ ID copiado!');
                          }
                        };
                        copiar(g.id);
                      }} className="btn-submit" style={{padding:'0.3rem 0.6rem',fontSize:'0.75rem',background:'#475569'}}>📋 Copiar ID</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
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
            {logs.length === 0 ? <tr><td colSpan="5">Sem logs.</td></tr> : logs.map(l => (
              <tr key={l.id}>
                <td className="text-small">{new Date(l.criado_em).toLocaleString()}</td>
                <td><span className="badge-tipo">{l.tipo_log}</span></td>
                <td><span style={{color: l.status==='sucesso'?'#10b981':'#dc2626',fontWeight:600}}>{l.status?.toUpperCase()}</span></td>
                <td className="text-small">{l.mensagem?.substring(0,50)}{l.mensagem?.length>50?'...':''}</td>
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
    !canEdit ? <div className="panel-card"><p>Sem permissões. Contacte o Administrador.</p></div> : <>
      <div className="panel-card" style={{marginBottom:'1.5rem'}}>
        <div className="panel-title">📝 Templates de Mensagens</div>
        {templates.length > 0 ? templates.map(t => (
          <div key={t.id} className="template-card">
            <div className="template-label">{t.tipo_evento.toUpperCase()}</div>
            <textarea className="template-textarea" defaultValue={t.mensagem} onBlur={e=>handleUpdateTemplate(t.id, e.target.value)} />
            <div className="text-muted" style={{fontSize:'0.7rem'}}>Use &#123;nomes&#125; e &#123;bodas&#125; como variáveis.</div>
          </div>
        )) : <p className="text-muted">Nenhum template. Corra v5_upgrade.sql na VPS.</p>}
      </div>
      
      {isAdmin && (<>
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
          <div className="panel-title">🛡️ Utilizadores do Sistema ({usuarios.length})</div>
          <div className="table-responsive">
            <table className="table-minimal">
              <thead><tr><th>Nome</th><th>Email</th><th>Nível</th><th>Ações</th></tr></thead>
              <tbody>
                {usuarios.length === 0 ? <tr><td colSpan="4">Nenhum utilizador encontrado.</td></tr> : usuarios.map(u => (
                  editingUserId === u.id ? (
                    <tr key={u.id} style={{background:'#f0f9ff'}}>
                      <td><input className="inline-input" style={{width:'95%'}} value={editUserForm.nome} onChange={e=>setEditUserForm({...editUserForm,nome:e.target.value})} placeholder="Nome" /></td>
                      <td>
                        <input className="inline-input" style={{width:'95%',marginBottom:'3px'}} value={editUserForm.email} onChange={e=>setEditUserForm({...editUserForm,email:e.target.value})} placeholder="Email" />
                        <input className="inline-input" style={{width:'95%',fontSize:'0.75rem'}} type="password" value={editUserForm.senha} onChange={e=>setEditUserForm({...editUserForm,senha:e.target.value})} placeholder="Nova senha (deixe vazio para manter)" />
                      </td>
                      <td>
                        <select className="inline-input" value={editUserForm.nivel_acesso} onChange={e=>setEditUserForm({...editUserForm,nivel_acesso:e.target.value})}>
                          <option value="admin">Admin</option>
                          <option value="editor">Editor</option>
                          <option value="leitor">Leitor</option>
                        </select>
                      </td>
                      <td style={{whiteSpace:'nowrap'}}>
                        <button onClick={handleUpdateUser} className="btn-submit" style={{padding:'0.3rem 0.6rem',fontSize:'0.75rem',marginRight:'4px'}}>💾 Salvar</button>
                        <button onClick={()=>setEditingUserId(null)} className="btn-danger-text" style={{fontSize:'0.75rem'}}>✖</button>
                      </td>
                    </tr>
                  ) : (
                    <tr key={u.id}>
                      <td>{u.nome}</td><td>{u.email}</td>
                      <td><span className={`badge-role badge-${u.nivel_acesso}`}>{u.nivel_acesso?.toUpperCase()}</span></td>
                      <td style={{whiteSpace:'nowrap'}}>
                        {isAdmin && u.id !== 1 && <button onClick={()=>startEditUser(u)} className="btn-submit" style={{padding:'0.25rem 0.5rem',fontSize:'0.75rem',background:'#3b82f6',marginRight:'6px'}}>✏️ Editar</button>}
                        {u.id !== 1 ? <button onClick={()=>handleDeleteUser(u.id)} className="btn-danger-text">✖ Remover</button> : <span className="text-muted">Root</span>}
                      </td>
                    </tr>
                  )
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </>)}
    </>
  );

  /* ========== LAYOUT ========== */
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
          <div className={`nav-item ${activeTab==='grupos'?'active':''}`} onClick={()=>setActiveTab('grupos')}><span>📱</span><span>Grupos WhatsApp</span></div>
          {isAdmin && <div className={`nav-item ${activeTab==='logs'?'active':''}`} onClick={()=>setActiveTab('logs')}><span>📋</span><span>Logs</span></div>}
          <div className={`nav-item ${activeTab==='configuracoes'?'active':''}`} onClick={()=>setActiveTab('configuracoes')}><span>⚙️</span><span>Configurações</span></div>
        </nav>
        <div className="sidebar-footer">
          <div className="user-avatar">{user?.nome?.charAt(0) || 'U'}</div>
          <div className="user-info">
            <h4>{user?.nome || 'Utilizador'}</h4>
            <p>{isAdmin ? 'Administrador' : (isEditor ? 'Editor' : 'Leitor')}</p>
          </div>
          <div style={{cursor:'pointer',marginLeft:'auto',color:'#94a3b8'}} onClick={onLogout} title="Sair">🚪</div>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <button className="mobile-menu-btn" onClick={() => document.querySelector('.sidebar').classList.toggle('open')}>☰</button>
          <div className="search-bar-container">
            <input type="text" className="search-bar" placeholder="🔍 Buscar nomes, datas, tipos..." value={searchQuery} onChange={e=>setSearchQuery(e.target.value)} />
          </div>
          <div className="topbar-icons">
            <span className="icon-btn" title={`Nível: ${user.nivel_acesso}`}>{isAdmin ? '🛡️' : (isEditor ? '✏️' : '👁️')}</span>
            {stats.falhasHoje > 0 && <span className="icon-btn notification-badge" title="Existem falhas!">🔔</span>}
            <div className="user-avatar topbar-avatar">{user?.nome?.charAt(0) || 'U'}</div>
          </div>
        </header>

        <div className="content-wrapper">
          <h2 className="page-title">{
            {dashboard:'Painel Executivo', eventos:'Gestão de Clientes', grupos:'Grupos WhatsApp', logs:'Logs do Sistema', configuracoes:'Configurações'}[activeTab]
          }</h2>
          <p className="page-subtitle">LNSOTECH Automation CRM — {user.nivel_acesso?.toUpperCase()}</p>
          
          {activeTab === 'dashboard' && renderDashboard()}
          {activeTab === 'eventos' && renderEventos()}
          {activeTab === 'grupos' && renderGrupos()}
          {activeTab === 'logs' && renderLogs()}
          {activeTab === 'configuracoes' && renderConfig()}
        </div>
      </main>
    </div>
  );
}
