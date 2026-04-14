import React, { useState, useEffect, useRef } from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid } from 'recharts';
import Swal from 'sweetalert2';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
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
  const [formFrequencia, setFormFrequencia] = useState('anual');

  const [usuarios, setUsuarios] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [logs, setLogs] = useState([]);
  const [logFilter, setLogFilter] = useState('todos');
  const [grupos, setGrupos] = useState([]);
  const [tiposEvento, setTiposEvento] = useState([]);
  const [newTipoNome, setNewTipoNome] = useState('');
  const [newTipoCor, setNewTipoCor] = useState('#3b82f6');
  
  const [editingEvento, setEditingEvento] = useState(null);
  const [editEventoForm, setEditEventoForm] = useState({ nomes_principais: '', data_evento: '', tipo_evento: '', grupo_id: '', frequencia_lembrete: 'anual', prioridade: 'normal' });
  const [showHistoryFor, setShowHistoryFor] = useState(null);
  const [historicoAlteracoes, setHistoricoAlteracoes] = useState([]);

  const [backups, setBackups] = useState([]);
  const [gruposLoading, setGruposLoading] = useState(false);
  const [waStatus, setWaStatus] = useState({ qr: null, status: 'desconhecido', lastUpdate: null });

  const [newUserNome, setNewUserNome] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserSenha, setNewUserSenha] = useState('');
  const [newUserRole, setNewUserRole] = useState('leitor');
  const [editingUserId, setEditingUserId] = useState(null);
  const [editUserForm, setEditUserForm] = useState({ nome: '', email: '', senha: '', nivel_acesso: 'leitor' });

  const [editingTipoId, setEditingTipoId] = useState(null);
  const [editTipoForm, setEditTipoForm] = useState({ nome: '', cor: '#3b82f6' });

  // Estado do Calendário
  const today = new Date();
  const [calMonth, setCalMonth] = useState(today.getMonth());
  const [calYear, setCalYear] = useState(today.getFullYear());
  const [calSelectedDay, setCalSelectedDay] = useState(null);

  const csvRef = useRef(null);

  const apiBase = '';
  const headers = { 'Authorization': `Bearer ${token}` };
  const jsonHeaders = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` };

  // =================== OFFLINE SYNC PWA =================== //
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [offlineQueueLength, setOfflineQueueLength] = useState(() => {
    return JSON.parse(localStorage.getItem('offline_events') || '[]').length;
  });

  useEffect(() => {
    const handleOnline = () => { setIsOnline(true); syncOfflineQueue(); };
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => { window.removeEventListener('online', handleOnline); window.removeEventListener('offline', handleOffline); };
  }, []);

  const syncOfflineQueue = async () => {
    const queue = JSON.parse(localStorage.getItem('offline_events') || '[]');
    if (queue.length === 0) return;
    let successCount = 0;
    for (const payload of queue) {
      try {
        const res = await fetch(`${apiBase}/api/eventos`, { method: 'POST', headers: jsonHeaders, body: JSON.stringify(payload) });
        if(res.ok) successCount++;
      } catch (err) { console.error('Sync error', err); }
    }
    localStorage.removeItem('offline_events');
    setOfflineQueueLength(0);
    toast.success(`📶 Ligação restabelecida! ${successCount} registos sincronizados.`);
    fetchData();
  };

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
        if (resUsr.ok) {
          const usrData = await resUsr.json();
          setUsuarios(usrData);
        } else {
          console.error('[fetchData] Falha ao buscar utilizadores. Status:', resUsr.status, await resUsr.text().catch(()=>''));
        }
        const resTp = await fetch(`${apiBase}/api/eventos/templates`, { headers });
        if (resTp.ok) setTemplates(await resTp.json());
      }

      const resTypes = await fetch(`${apiBase}/api/eventos/tipos`, { headers });
      if (resTypes.ok) setTiposEvento(await resTypes.json());

      if (isAdmin) {
        const resLogs = await fetch(`${apiBase}/api/eventos/logs`, { headers });
        if (resLogs.ok) setLogs(await resLogs.json());
        const resBkps = await fetch(`${apiBase}/api/auth/backups`, { headers });
        if (resBkps.ok) setBackups(await resBkps.json());
      }
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const fetchGrupos = async () => {
    setGruposLoading(true);
    try {
      const res = await fetch(`${apiBase}/api/eventos/grupos`, { headers });
      if (res.ok) setGrupos(await res.json());
      else { const d = await res.json(); toast.error(d.erro || 'Bot offline'); }
    } catch (e) { toast.error('Falha ao carregar grupos'); }
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
    const result = await Swal.fire({ title: 'Reconectar WhatsApp?', text: 'Isto irá desconectar o WhatsApp atual e pedir um novo QR code. O bot vai reiniciar.', icon: 'warning', showCancelButton: true, confirmButtonColor: '#10b981', cancelButtonColor: '#64748b', confirmButtonText: 'Sim, Reconectar', cancelButtonText: 'Cancelar' });
    if (!result.isConfirmed) return;
    try {
      const res = await fetch(`${apiBase}/api/eventos/whatsapp-reconectar`, { method: 'POST', headers: jsonHeaders });
      const d = await res.json();
      toast.info(d.mensagem || 'A reiniciar...');
      fetchWaStatus();
    } catch (e) { toast.error('Erro ao pedir reconexão'); }
  };

  const handleRestoreBackup = async (filename) => {
    const step1 = await Swal.fire({ title: '⚠️ ATENÇÃO EXTREMA!', html: `Isto irá substituir <strong>TODA</strong> a base de dados atual pelo backup <b>"${filename}"</b>.<br/><br/>Todos os dados criados desde essa data serão <span style="color:#dc2626;font-weight:bold">PERDIDOS</span>.`, icon: 'warning', showCancelButton: true, confirmButtonColor: '#10b981', cancelButtonColor: '#64748b', confirmButtonText: 'Sim, quero restaurar', cancelButtonText: 'Cancelar' });
    if (!step1.isConfirmed) return;
    
    const step2 = await Swal.fire({ title: 'Confirmação Final', input: 'text', inputLabel: 'Escreva "RESTAURAR" para confirmar:', inputPlaceholder: 'RESTAURAR', showCancelButton: true, confirmButtonColor: '#10b981', inputValidator: (v) => v !== 'RESTAURAR' ? 'Escreva exactamente RESTAURAR' : null });
    if (!step2.isConfirmed) { toast.info('Operação cancelada.'); return; }

    try {
        setLoading(true);
        const res = await fetch(`${apiBase}/api/auth/backups/restore/${filename}`, { method: 'POST', headers: jsonHeaders });
        const data = await res.json();
        
        if (res.ok) {
            await Swal.fire({ title: 'Restaurado!', text: 'Backup restaurado com sucesso. A página será atualizada.', icon: 'success', timer: 2000, showConfirmButton: false });
            window.location.reload();
        } else {
            Swal.fire('Erro', data.erro || 'Falha ao restaurar', 'error');
        }
    } catch (err) {
        Swal.fire('Erro', 'Erro na comunicação com o servidor.', 'error');
    } finally {
        setLoading(false);
    }
  };

  const handleExportCSV = () => window.open(`${apiBase}/api/eventos?exportCsv=true`, '_blank');

  const handleExportExcel = async () => {
    try {
      const dadosExcel = eventos.map(ev => ({
        'ID': ev.id,
        'Nomes': ev.nomes_principais,
        'Data Evento': new Date(ev.data_evento).toLocaleDateString('pt-PT'),
        'Tipo': ev.tipo_evento,
        'Frequencia': ev.frequencia_lembrete || 'anual',
        'Grupo': grupos.find(g => g.id === ev.grupo_id)?.nome || ev.grupo_id || 'N/A',
        'Foto': ev.foto_url ? 'Sim' : 'Nao',
      }));
      const ws = XLSX.utils.json_to_sheet(dadosExcel);
      ws['!cols'] = [{ wch: 5 }, { wch: 30 }, { wch: 14 }, { wch: 12 }, { wch: 10 }, { wch: 25 }, { wch: 6 }];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Eventos');
      const statsData = [
        ['Metrica', 'Valor'],
        ['Total Eventos', stats.totalEventos],
        ['Total Bodas', stats.totalBodas],
        ['Total Aniversarios', stats.totalAniversarios],
        ['Grupos Ativos', stats.gruposAtivos],
        ['Lembretes Enviados', stats.lembretesEnviados],
      ];
      const wsStats = XLSX.utils.aoa_to_sheet(statsData);
      XLSX.utils.book_append_sheet(wb, wsStats, 'Estatisticas');
      XLSX.writeFile(wb, `lnsotech-relatorio-${new Date().toISOString().slice(0,10)}.xlsx`);
    } catch (err) { console.error(err); toast.error('Erro ao gerar Excel: ' + err.message); }
  };

  const handleExportPDF = async () => {
    try {
      const doc = new jsPDF({ orientation: 'landscape' });
      const dataHoje = new Date().toLocaleDateString('pt-PT');
      doc.setFillColor(15, 23, 42);
      doc.rect(0, 0, 297, 20, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('LNSOTECH Events CRM - Relatorio de Eventos', 14, 13);
      doc.setFontSize(9);
      doc.text('Gerado em: ' + dataHoje, 240, 13);
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text('Total: ' + stats.totalEventos + ' eventos  |  Bodas: ' + stats.totalBodas + '  |  Aniversarios: ' + stats.totalAniversarios + '  |  Lembretes enviados: ' + stats.lembretesEnviados, 14, 28);
      autoTable(doc, {
        startY: 35,
        head: [['#', 'Nomes', 'Data Evento', 'Tipo', 'Frequencia', 'Grupo WhatsApp']],
        body: eventos.map(ev => [
          ev.id,
          ev.nomes_principais,
          new Date(ev.data_evento).toLocaleDateString('pt-PT'),
          ev.tipo_evento ? ev.tipo_evento.charAt(0).toUpperCase() + ev.tipo_evento.slice(1) : '',
          ev.frequencia_lembrete || 'anual',
          grupos.find(g => g.id === ev.grupo_id)?.nome || (ev.grupo_id ? ev.grupo_id.substring(0, 20) : 'N/A'),
        ]),
        styles: { fontSize: 9, cellPadding: 3 },
        headStyles: { fillColor: [37, 99, 235], textColor: 255, fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        columnStyles: { 0: { cellWidth: 10 }, 1: { cellWidth: 60 }, 2: { cellWidth: 25 }, 3: { cellWidth: 22 }, 4: { cellWidth: 22 }, 5: { cellWidth: 50 } },
      });
      doc.save('lnsotech-relatorio-' + new Date().toISOString().slice(0, 10) + '.pdf');
    } catch (err) { console.error(err); toast.error('Erro ao gerar PDF: ' + err.message); }
  };


  const handleImportCSV = async (e) => {
    const file = e.target.files[0]; if (!file) return;
    const fd = new FormData(); fd.append('csv', file);
    const res = await fetch(`${apiBase}/api/eventos/importar`, { method: 'POST', headers: { 'Authorization': `Bearer ${token}` }, body: fd });
    const data = await res.json(); toast.success(data.mensagem || 'Concluído'); fetchData();
    e.target.value = '';
  };

  const handleCreateEvento = async (e) => {
    e.preventDefault();
    if (!canEdit) return toast.warning('Permissão negada!');
    if (!formGrupo) return toast.warning('Seleccione um grupo WhatsApp!');
    const payload = { nomes_principais: formNomes, data_evento: formData, tipo_evento: formTipo, grupo_id: formGrupo, criado_por: user.id, frequencia_lembrete: formFrequencia };

    if (!isOnline) {
       const queue = JSON.parse(localStorage.getItem('offline_events') || '[]');
       queue.push(payload);
       localStorage.setItem('offline_events', JSON.stringify(queue));
       setOfflineQueueLength(queue.length);
       
       setFormNomes(''); setFormData(''); setFormFrequencia('anual');
       toast.info('📴 Guardado Offline! Será sincronizado assim que tiveres Internet.');
       return;
    }

    const res = await fetch(`${apiBase}/api/eventos`, { method: 'POST', headers: jsonHeaders, body: JSON.stringify(payload) });
    const data = await res.json();
    if (res.ok) { setFormNomes(''); setFormData(''); setFormFrequencia('anual'); toast.success('✅ Registado com sucesso!'); fetchData(); }
    else toast.error('Erro ao guardar: ' + (data.erro || 'Falha desconhecida.'));
  };

  const handleUploadFoto = async (eventoId, file) => {
    if (!file) return;
    const fd = new FormData(); fd.append('foto', file);
    const res = await fetch(`${apiBase}/api/eventos/${eventoId}/foto`, { method: 'POST', headers: { 'Authorization': `Bearer ${token}` }, body: fd });
    if (res.ok) { toast.success('📸 Foto anexada!'); fetchData(); } else toast.error('Erro ao anexar foto');
  };
  
  const handleUpdateTemplate = async (id, msg) => {
    await fetch(`${apiBase}/api/eventos/templates/${id}`, { method: 'PUT', headers: jsonHeaders, body: JSON.stringify({mensagem: msg}) });
    toast.success('💾 Template Salvo!');
  };

  const handleCreateTipo = async (e) => {
    e.preventDefault();
    if (!isAdmin) return;
    const res = await fetch(`${apiBase}/api/eventos/tipos`, { method: 'POST', headers: jsonHeaders, body: JSON.stringify({ nome: newTipoNome, cor: newTipoCor }) });
    if (res.ok) { setNewTipoNome(''); fetchData(); toast.success('🎨 Tipo criado!'); }
    else toast.error('Erro ao criar tipo');
  };

  const handleDeletarTipo = async (id) => {
    if (!isAdmin) return;
    const result = await Swal.fire({ title: 'Apagar Tipo de Evento?', text: 'Isto também apagará o template de mensagem associado.', icon: 'warning', showCancelButton: true, confirmButtonColor: '#ef4444', cancelButtonColor: '#64748b', confirmButtonText: 'Sim, Apagar', cancelButtonText: 'Cancelar' });
    if (!result.isConfirmed) return;
    const res = await fetch(`${apiBase}/api/eventos/tipos/${id}`, { method: 'DELETE', headers });
    if (res.ok) { fetchData(); toast.success('Tipo apagado.'); }
  };

  const startEditTipo = (t) => {
    setEditingTipoId(t.id);
    setEditTipoForm({ nome: t.nome, cor: t.cor });
  };

  const handleUpdateTipo = async () => {
    const res = await fetch(`${apiBase}/api/eventos/tipos/${editingTipoId}`, { 
        method: 'PUT', 
        headers: jsonHeaders, 
        body: JSON.stringify(editTipoForm) 
    });
    if (res.ok) { setEditingTipoId(null); fetchData(); toast.success('🎨 Tipo atualizado!'); }
    else toast.error('Erro ao atualizar tipo');
  };

  const startEditEvento = (ev) => {
    setEditingEvento(ev.id);
    setEditEventoForm({
        nomes_principais: ev.nomes_principais,
        data_evento: ev.data_evento?.split('T')[0],
        tipo_evento: ev.tipo_evento,
        grupo_id: ev.grupo_id,
        frequencia_lembrete: ev.frequencia_lembrete || 'anual',
        prioridade: ev.prioridade || 'normal'
    });
  };

  const handleUpdateEvento = async () => {
    const res = await fetch(`${apiBase}/api/eventos/${editingEvento}`, {
        method: 'PUT',
        headers: jsonHeaders,
        body: JSON.stringify({ ...editEventoForm, usuario_id: user.id })
    });
    if (res.ok) { toast.success('✅ Evento atualizado!'); setEditingEvento(null); fetchData(); }
    else toast.error('Falha ao atualizar');
  };

  const fetchHistorico = async (id) => {
    const res = await fetch(`${apiBase}/api/eventos/${id}/historico`, { headers });
    if (res.ok) {
        setHistoricoAlteracoes(await res.json());
        setShowHistoryFor(id);
    }
  };

  const apagarEvento = async (id) => {
    if (!isAdmin) return toast.warning('Só Admins podem apagar!');
    const result = await Swal.fire({ title: 'Apagar Evento?', text: 'Esta ação não pode ser revertida.', icon: 'warning', showCancelButton: true, confirmButtonColor: '#ef4444', cancelButtonColor: '#64748b', confirmButtonText: 'Sim, Apagar', cancelButtonText: 'Cancelar' });
    if (result.isConfirmed) { await fetch(`${apiBase}/api/eventos/${id}`, { method: 'DELETE', headers }); fetchData(); toast.success('Evento apagado.'); }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    const res = await fetch(`${apiBase}/api/auth/usuarios`, { method: 'POST', headers: jsonHeaders, body: JSON.stringify({ nome: newUserNome, email: newUserEmail, senha: newUserSenha, nivel_acesso: newUserRole }) });
    const d = await res.json();
    if (res.ok) { toast.success('👤 Utilizador criado!'); setNewUserNome(''); setNewUserEmail(''); setNewUserSenha(''); setNewUserRole('leitor'); fetchData(); }
    else toast.error(d.erro || 'Erro ao criar utilizador');
  };

  const handleDeleteUser = async (id) => {
    const result = await Swal.fire({ title: 'Remover Utilizador?', text: 'Esta ação é permanente.', icon: 'warning', showCancelButton: true, confirmButtonColor: '#ef4444', cancelButtonColor: '#64748b', confirmButtonText: 'Sim, Remover', cancelButtonText: 'Cancelar' });
    if (result.isConfirmed) { const res = await fetch(`${apiBase}/api/auth/usuarios/${id}`, { method: 'DELETE', headers }); if (res.ok) { fetchData(); toast.success('Utilizador removido.'); } }
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
    if (res.ok) { toast.success('✅ ' + d.mensagem); setEditingUserId(null); fetchData(); }
    else toast.error(d.erro || 'Erro ao atualizar');
  };

  const handleTesteConexao = async (grupoId, nomeGrupo) => {
    const code = Math.floor(1000 + Math.random() * 9000);
    const result = await Swal.fire({ title: '⚠️ Testar Conexão', html: `Você está prestes a enviar uma mensagem de teste para <strong>todos os membros</strong> do grupo "<b>${nomeGrupo || 'este grupo'}</b>".<br/><br/>Para confirmar, digite o código: <strong style="color:#dc2626;font-size:1.3rem">${code}</strong>`, input: 'text', inputPlaceholder: 'Digite o código...', showCancelButton: true, confirmButtonColor: '#10b981', cancelButtonColor: '#64748b', confirmButtonText: '🤖 Enviar Teste', cancelButtonText: 'Cancelar', inputValidator: (v) => v !== code.toString() ? 'Código incorreto!' : null });
    if (!result.isConfirmed) return;

    try {
        const res = await fetch(`${apiBase}/api/eventos/teste-conexao`, { method: 'POST', headers: jsonHeaders, body: JSON.stringify({ grupo_id: grupoId }) });
        const d = await res.json();
        if (res.ok) toast.success(d.mensagem || 'Teste enviado!'); else toast.error(d.erro || 'Falha no teste');
    } catch(err) {
        toast.error('Erro ao testar comunicação');
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
  /* ========== RENDER: DASHBOARD ========== */
  const renderDashboard = () => {
    // 1. Data for PieChart
    const pieData = [
      { name: 'Bodas', value: stats.totalBodas },
      { name: 'Aniversários', value: stats.totalAniversarios },
      { name: 'Outros', value: stats.totalEventos - stats.totalBodas - stats.totalAniversarios }
    ].filter(d => d.value > 0);
    const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444'];
    
    // 2. Data for BarChart (Events by Month)
    const monthCounts = Array(12).fill(0);
    const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    eventos.forEach(ev => {
        const m = new Date(ev.data_evento).getMonth();
        if(!isNaN(m)) monthCounts[m]++;
    });
    const barData = monthNames.map((m, i) => ({ name: m, Eventos: monthCounts[i] }));

    return (
    <>
      <div className="stats-grid">
        <div className="stat-card"><div className="stat-header">Eventos Totais<div className="stat-icon-wrapper bg-green-light">📈</div></div><div className="stat-value">{stats.totalEventos}</div></div>
        <div className="stat-card"><div className="stat-header">Grupos Activos<div className="stat-icon-wrapper bg-green-light">💍</div></div><div className="stat-value">{stats.gruposAtivos}</div></div>
        <div className="stat-card"><div className="stat-header">Lembretes Enviados<div className="stat-icon-wrapper bg-yellow-light">🔔</div></div><div className="stat-value">{stats.lembretesEnviados}</div></div>
        <div className="stat-card"><div className="stat-header">Falhas<div className="stat-icon-wrapper" style={{background:'#fee2e2'}}>⚠️</div></div><div className="stat-value" style={{color: stats.falhasHoje > 0 ? '#dc2626':'#10b981'}}>{stats.falhasHoje}</div></div>
      </div>
      
      {/* SECTION: GRÁFICOS COMPARATIVOS */}
      <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
        <div className="panel-card" style={{ flex: 1, minWidth: '350px' }}>
          <div className="panel-title">Distribuição de Eventos por Mês</div>
          <p className="text-muted" style={{fontSize: '0.85rem', marginBottom: '1rem'}}>Análise do volume de agendamentos ao longo do ano para antecipar picos de alertas.</p>
          <div style={{ width: '100%', height: 260 }}>
            <ResponsiveContainer>
              <BarChart data={barData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#64748b'}} />
                <YAxis axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#64748b'}} />
                <Tooltip cursor={{fill: '#f1f5f9'}} contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} />
                <Bar dataKey="Eventos" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        
        <div className="panel-card" style={{ flex: 0.6, minWidth: '280px' }}>
          <div className="panel-title">Proporção de Tipos</div>
          <p className="text-muted" style={{fontSize: '0.85rem', marginBottom: '1rem'}}>Divisão da natureza dos eventos marcados.</p>
          <div style={{ width: '100%', height: 260, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {stats.totalEventos === 0 ? <p className="text-muted">Sem dados suficientes.</p> : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={65} outerRadius={85} paddingAngle={5} dataKey="value">
                    {pieData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} />
                  <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{fontSize: '12px'}} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      <div className="middle-grid">
        <div className="panel-card" style={{gap:'1rem'}}>
          <div className="panel-title">Novo Registo Expresso</div>
          {canEdit ? (
            <form className="inline-form" onSubmit={handleCreateEvento}>
              {/* 1. Primeiro Escolhe o Tipo */}
              <select className="inline-input" style={{flex:'0.3'}} value={formTipo} onChange={async (e)=>{
                if (e.target.value === '__novo__') {
                    const { value: n } = await Swal.fire({ title: 'Novo Tipo de Evento', input: 'text', inputLabel: 'Nome do tipo:', inputPlaceholder: 'Ex: Inauguração', showCancelButton: true, confirmButtonText: 'Criar', cancelButtonText: 'Cancelar' });
                    if (n) {
                        const { value: c } = await Swal.fire({ title: 'Cor do Tipo', input: 'text', inputLabel: 'Cor (Ex: #ff0000):', inputValue: '#3b82f6', showCancelButton: true });
                        fetch(`${apiBase}/api/eventos/tipos`, { method: 'POST', headers: jsonHeaders, body: JSON.stringify({ nome: n, cor: c || '#3b82f6' }) })
                        .then(res => { if(res.ok) { fetchData(); setFormTipo(n.toLowerCase()); toast.success('Tipo criado!'); } });
                    }
                } else setFormTipo(e.target.value);
              }}>
                <option value="">-- Seleccione o Tipo --</option>
                {tiposEvento.map(t => <option key={t.id} value={t.nome}>{t.nome.charAt(0).toUpperCase() + t.nome.slice(1)}</option>)}
                <option value="__novo__">➕ Criar Novo Tipo...</option>
              </select>

              {/* 2. O Nome adapta-se ao Tipo */}
              <input 
                type="text" 
                className="inline-input" 
                placeholder={
                  formTipo === 'casamento' ? "Nomes do Casal (Ex: João & Maria)" :
                  formTipo === 'aniversario' ? "Nome do Aniversariante" :
                  formTipo === 'batizado' ? "Nome da Criança" :
                  formTipo === 'formatura' ? "Nome do Graduado" :
                  formTipo ? `Nome para ${formTipo}` : "Selecione o tipo primeiro..."
                }
                value={formNomes} 
                onChange={e=>setFormNomes(e.target.value)} 
                required 
              />

              <input type="date" className="inline-input" style={{flex:'0.3'}} value={formData} onChange={e=>setFormData(e.target.value)} required />

              <GrupoSelect value={formGrupo} onChange={async (e) => {
                if (e.target.value === '__manual__') { const { value: id } = await Swal.fire({ title: 'ID do Grupo', input: 'text', inputLabel: 'Cole o ID do grupo WhatsApp:', showCancelButton: true }); if (id) setFormGrupo(id); }
                else setFormGrupo(e.target.value);
              }} />

              <select className="inline-input" style={{flex:'0.25'}} value={formFrequencia} onChange={e=>setFormFrequencia(e.target.value)}>
                <option value="anual">📅 Anual</option>
                <option value="mensal">🔄 Mensal</option>
                <option value="semanal">📆 Semanal</option>
                <option value="diario">⏰ Diário</option>
              </select>
              <button type="submit" className="btn-submit" disabled={loading}>+ Guardar</button>
            </form>
          ) : <div className="text-muted">Apenas admins/editores podem registar.</div>}
          <div className="panel-title" style={{marginTop:'1.5rem'}}>Últimos Registos</div>
          <table className="table-minimal">
            <thead><tr><th>Nomes</th><th>Tipo</th><th style={{textAlign:'right'}}>Data</th></tr></thead>
            <tbody>
              {loading ? <tr><td colSpan="3">A carregar...</td></tr> : eventos.length === 0 ? <tr><td colSpan="3">Sem eventos.</td></tr> :
                eventos.slice(0,5).map(ev => (
                  <tr key={ev.id}><td className="fw-bold">{ev.nomes_principais}</td><td><span className="badge-tipo">{ev.tipo_evento}</span></td><td style={{textAlign:'right'}}>{new Date(ev.data_evento).toLocaleDateString('pt-PT')}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
  };

  /* ========== RENDER: EVENTOS ========== */
  const renderEventos = () => (
    <div className="panel-card" style={{gap:'1rem'}}>
      <div className="eventos-toolbar">
        <div className="panel-title" style={{margin:0}}>Base de Dados de Clientes</div>
        <div className="toolbar-buttons">
          <div style={{display:'flex', gap:'0.5rem'}}>
            <button onClick={handleExportCSV} className="btn-submit" style={{background:'#1e293b'}}>📥 CSV</button>
            <button onClick={handleExportExcel} className="btn-submit" style={{background:'#047857'}}>📊 Excel</button>
            <button onClick={handleExportPDF} className="btn-submit" style={{background:'#be123c'}}>📄 PDF</button>
          </div>
          {canEdit && (<>
            <input type="file" accept=".csv" ref={csvRef} onChange={handleImportCSV} style={{display:'none'}} />
            <button onClick={() => csvRef.current?.click()} className="btn-submit" style={{background:'#0f766e'}}>📤 Importar CSV</button>
          </>)}
        </div>
      </div>
      {canEdit && (
        <form className="inline-form" onSubmit={handleCreateEvento} style={{background:'#f8fafc',padding:'1rem',borderRadius:'8px',border:'1px solid var(--border)'}}>
          <select className="inline-input" style={{flex:'0.3'}} value={formTipo} onChange={async (e)=>{
            if (e.target.value === '__novo__') {
                const { value: n } = await Swal.fire({ title: 'Novo Tipo de Evento', input: 'text', inputLabel: 'Nome do tipo:', showCancelButton: true });
                if (n) {
                    const { value: c } = await Swal.fire({ title: 'Cor do Tipo', input: 'text', inputValue: '#3b82f6', showCancelButton: true });
                    fetch(`${apiBase}/api/eventos/tipos`, { method: 'POST', headers: jsonHeaders, body: JSON.stringify({ nome: n, cor: c || '#3b82f6' }) })
                    .then(res => { if(res.ok) { fetchData(); setFormTipo(n.toLowerCase()); toast.success('Tipo criado!'); } });
                }
            } else setFormTipo(e.target.value);
          }}>
            <option value="">-- Tipo de Evento --</option>
            {tiposEvento.map(t => <option key={t.id} value={t.nome}>{t.nome.charAt(0).toUpperCase() + t.nome.slice(1)}</option>)}
            <option value="__novo__">➕ Adicionar Novo...</option>
          </select>

          <input 
            type="text" 
            className="inline-input" 
            placeholder={formTipo ? `Nomes para ${formTipo}` : "Selecione o tipo primeiro..."} 
            value={formNomes} 
            onChange={e=>setFormNomes(e.target.value)} 
            required 
          />
          
          <input type="date" className="inline-input" style={{flex:'0.3'}} value={formData} onChange={e=>setFormData(e.target.value)} required />
          
          <GrupoSelect value={formGrupo} onChange={async (e) => { if (e.target.value==='__manual__') { const { value: id } = await Swal.fire({ title: 'ID do Grupo', input: 'text', inputLabel: 'Cole o ID:', showCancelButton: true }); if(id) setFormGrupo(id); } else setFormGrupo(e.target.value); }} />
          <select className="inline-input" style={{flex:'0.22'}} value={formFrequencia} onChange={e=>setFormFrequencia(e.target.value)}>
            <option value="anual">📅 Anual</option>
            <option value="mensal">🔄 Mensal</option>
            <option value="semanal">📆 Semanal</option>
            <option value="diario">⏰ Diário</option>
          </select>
          <button type="submit" className="btn-submit" disabled={loading}>+ Guardar</button>
        </form>
      )}
      <div className="table-responsive">
        <table className="table-minimal" style={{marginTop:'1rem'}}>
          <thead><tr><th>Nomes</th><th>Data</th><th>Tipo</th><th>Freq.</th><th>Grupo</th><th>Foto</th><th>Gestão</th></tr></thead>
          <tbody>
            {loading ? <tr><td colSpan="7">A carregar...</td></tr> : eventos.map(ev => (
              <tr key={ev.id}>
                <td className="fw-bold">{ev.nomes_principais}</td>
                <td>{new Date(ev.data_evento).toLocaleDateString()}<br/><span className="text-small">{ev.tipo_evento?.toUpperCase()}</span></td>
                <td><span className="badge-tipo">{ev.tipo_evento}</span></td>
                <td>
                  <span title={`Lembrete: ${ev.frequencia_lembrete || 'anual'}`} style={{fontSize:'0.75rem', padding:'0.15rem 0.4rem', borderRadius:'4px', background:'#f1f5f9', color:'#475569', fontWeight:500}}>
                    {ev.frequencia_lembrete === 'mensal' ? '🔄 Mensal' : ev.frequencia_lembrete === 'semanal' ? '📆 Semanal' : ev.frequencia_lembrete === 'diario' ? '⏰ Diário' : '📅 Anual'}
                  </span>
                </td>
                <td className="text-small" title={ev.grupo_id}>{grupos.find(g=>g.id===ev.grupo_id)?.nome || ev.grupo_id?.substring(0,18)}{ev.grupo_id?.length>18 ? '..':''}</td>
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
                <td style={{whiteSpace:'nowrap'}}>
                    {canEdit && <button onClick={()=>startEditEvento(ev)} className="btn-submit" style={{padding:'4px 8px', fontSize:'0.7rem', marginRight:'4px', background:'#3b82f6'}}>✏️ Editar</button>}
                    <button onClick={()=>fetchHistorico(ev.id)} className="btn-submit" style={{padding:'4px 8px', fontSize:'0.7rem', marginRight:'4px', background:'#64748b'}}>📜 Hist.</button>
                    {isAdmin && <button onClick={()=>apagarEvento(ev.id)} className="btn-danger-text">✖</button>}
                </td>
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
                        const copiar = (texto) => {
                          if (navigator.clipboard && window.isSecureContext) {
                            navigator.clipboard.writeText(texto).then(() => toast.success('📋 ID copiado!')).catch(() => {
                              const el = document.createElement('textarea');
                              el.value = texto; el.style.position='fixed'; el.style.opacity='0';
                              document.body.appendChild(el); el.select();
                              document.execCommand('copy'); document.body.removeChild(el);
                              toast.success('📋 ID copiado!');
                            });
                          } else {
                            const el = document.createElement('textarea');
                            el.value = texto; el.style.position='fixed'; el.style.opacity='0';
                            document.body.appendChild(el); el.select();
                            document.execCommand('copy'); document.body.removeChild(el);
                            toast.success('📋 ID copiado!');
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

  /* ========== RENDER: HISTÓRICO (LOGS) ========== */
  const renderLogs = () => {
    const filteredLogs = logFilter === 'todos' ? logs : logs.filter(l => l.tipo_log === logFilter);
    return (
      <div className="panel-card">
        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', marginBottom:'1rem'}}>
          <div className="panel-title" style={{margin:0}}>📖 Histórico de Interações (Audit)</div>
          <div style={{display:'flex', gap:'0.5rem'}}>
            <select className="inline-input" value={logFilter} onChange={e=>setLogFilter(e.target.value)} style={{margin:0, width:'200px'}}>
              <option value="todos">Todos os Eventos</option>
              <option value="lembrete_enviado">Lembretes Enviados</option>
              <option value="auto_resposta">Respostas Automáticas</option>
              <option value="registo_whatsapp">Criação via Bot</option>
              <option value="erro_registo">Erros do Bot</option>
              <option value="lembrete_falha">Falhas de Envio</option>
            </select>
            <button className="btn-submit" onClick={fetchData} style={{margin:0}}>🔄 Atualizar</button>
          </div>
        </div>
        
        <p className="text-muted" style={{fontSize:'0.85rem', marginBottom:'1rem'}}>Histórico detalhado de tudo o que o bot disparou, ouviu ou reportou.</p>
        
        <div className="table-responsive">
          <table className="table-minimal">
            <thead><tr><th>Data/Hora</th><th>Natureza</th><th>Status</th><th>Detalhes / Mensagem Trocada</th><th>Destinatário (ID)</th></tr></thead>
            <tbody>
              {filteredLogs.length === 0 ? <tr><td colSpan="5">Nenhum registo encontrado para este filtro.</td></tr> : filteredLogs.map(l => (
                <tr key={l.id}>
                  <td className="text-small" style={{whiteSpace:'nowrap', color:'#475569'}}>{new Date(l.criado_em).toLocaleString('pt-PT')}</td>
                  <td>
                    <span style={{
                      fontSize:'0.75rem', padding:'0.2rem 0.5rem', borderRadius:'6px', fontWeight:600,
                      background: l.tipo_log === 'auto_resposta' ? '#e0e7ff' : l.tipo_log === 'lembrete_enviado' ? '#dcfce7' : '#f1f5f9',
                      color: l.tipo_log === 'auto_resposta' ? '#4f46e5' : l.tipo_log === 'lembrete_enviado' ? '#16a34a' : '#475569'
                    }}>
                      {l.tipo_log?.replace('_', ' ').toUpperCase()}
                    </span>
                  </td>
                  <td>
                    <span style={{color: l.status==='sucesso'?'#10b981':(l.status==='falha'?'#dc2626':'#f59e0b'),fontWeight:600, fontSize:'0.8rem'}}>
                      {l.status === 'sucesso' ? '✅ SUCESSO' : '❌ FALHA'}
                    </span>
                  </td>
                  <td className="text-small" title={l.mensagem} style={{maxWidth:'300px'}}>
                    {l.mensagem?.length > 70 ? l.mensagem.substring(0,70) + '...' : l.mensagem}
                  </td>
                  <td className="text-small" style={{fontFamily:'monospace', color:'#64748b'}} title={l.grupo_id}>
                    {grupos.find(g=>g.id===l.grupo_id)?.nome || (l.grupo_id ? l.grupo_id.substring(0,18)+'...' : 'Sistema')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

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
        <div className="panel-card" style={{marginBottom:'1.5rem'}}>
          <div className="panel-title">🎨 Customizar Tipos de Evento</div>
          <p className="text-muted" style={{fontSize:'0.85rem', marginBottom:'1rem'}}>Crie novos tipos de eventos que aparecerão nos formulários e calendários.</p>
          <form className="inline-form" onSubmit={handleCreateTipo} style={{marginBottom:'1rem'}}>
            <input type="text" className="inline-input" placeholder="Novo Tipo (Ex: Inauguração)" value={newTipoNome} onChange={e=>setNewTipoNome(e.target.value)} required />
            <input type="color" className="inline-input" style={{width:'60px', padding:0}} value={newTipoCor} onChange={e=>setNewTipoCor(e.target.value)} />
            <button type="submit" className="btn-submit">+ Adicionar</button>
          </form>
          <div style={{display:'flex', gap:'0.5rem', flexWrap:'wrap'}}>
            {tiposEvento.map(t => (
                editingTipoId === t.id ? (
                    <div key={t.id} style={{background:'#f0f9ff', border:'1px solid #3b82f6', padding:'0.5rem', borderRadius:'8px', display:'flex', alignItems:'center', gap:'0.4rem'}}>
                        <input className="inline-input" style={{width:'120px', margin:0}} value={editTipoForm.nome} onChange={e=>setEditTipoForm({...editTipoForm, nome: e.target.value})} />
                        <input type="color" style={{width:'30px', height:'30px', border:'none', cursor:'pointer'}} value={editTipoForm.cor} onChange={e=>setEditTipoForm({...editTipoForm, cor: e.target.value})} />
                        <button onClick={handleUpdateTipo} className="btn-submit" style={{padding:'4px 8px', margin:0, fontSize:'0.75rem'}}>💾</button>
                        <button onClick={()=>setEditingTipoId(null)} className="btn-danger-text" style={{fontSize:'1.1rem'}}>×</button>
                    </div>
                ) : (
                    <div key={t.id} style={{background:'#f8fafc', border:'1px solid #e2e8f0', padding:'0.5rem 1rem', borderRadius:'20px', display:'flex', alignItems:'center', gap:'0.5rem'}}>
                        <div style={{width:'12px', height:'12px', borderRadius:'50%', background:t.cor}}></div>
                        <span style={{fontWeight:500}}>{t.nome}</span>
                        <button onClick={()=>startEditTipo(t)} style={{background:'none', border:'none', color:'#3b82f6', cursor:'pointer', fontSize:'0.9rem'}}>✏️</button>
                        <button onClick={()=>handleDeletarTipo(t.id)} style={{background:'none', border:'none', color:'#ef4444', cursor:'pointer', fontWeight:'bold', fontSize:'1.1rem'}}>×</button>
                    </div>
                )
            ))}
          </div>
        </div>

        <div className="panel-card">
          <div className="panel-title">💾 Backups da Base de Dados</div>
          <p className="text-muted" style={{fontSize:'0.85rem', marginBottom:'1rem'}}>Os backups diários são gerados automaticamente às 00:00 (hora de Maputo). Backups com mais de 15 dias são apagados para evitar encher o disco.</p>
          <div className="table-responsive">
            <table className="table-minimal">
              <thead><tr><th>Ficheiro</th><th>Tamanho</th><th>Gestão</th></tr></thead>
              <tbody>
                {backups.length === 0 ? <tr><td colSpan="3">Nenhum backup encontrado.</td></tr> : backups.map(b => (
                  <tr key={b.name}>
                    <td className="fw-bold">{b.name}</td>
                    <td>{b.size}</td>
                    <td>
                      <a href={`${apiBase}/api/auth/backups/download/${b.name}`} download className="btn-submit" style={{padding:'0.25rem 0.6rem',fontSize:'0.8rem',textDecoration:'none',display:'inline-block', marginRight:'0.5rem'}}>
                        📥 Transferir
                      </a>
                      <button onClick={() => handleRestoreBackup(b.name)} className="btn-submit" style={{padding:'0.25rem 0.6rem',fontSize:'0.8rem',background:'#dc2626',color:'#fff'}}>
                        🔄 Restaurar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </>)}
    </>
  );

  /* ========== RENDER: CALENDÁRIO INTERATIVO ========== */
  const renderCalendario = () => {
    const mesesPT = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
    const diasSemana = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
    // Criar mapeamento dinâmico de cores baseado nos tipos existentes
    const coresEvento = tiposEvento.reduce((acc, t) => ({ ...acc, [t.nome]: t.cor }), { 
      casamento:'#3b82f6', aniversario:'#10b981', batizado:'#8b5cf6', formatura:'#f59e0b' 
    });
    
    const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
    const firstWeekDay = new Date(calYear, calMonth, 1).getDay();
    
    // Eventos do mês (aniversario anual - mesmo dia e mês)
    const getEventosForDay = (day) => eventos.filter(ev => {
      const d = new Date(ev.data_evento);
      return d.getDate() === day && d.getMonth() === calMonth;
    });
    
    const selectedEventos = calSelectedDay ? getEventosForDay(calSelectedDay) : [];
    
    const prevMonth = () => { if (calMonth === 0) { setCalMonth(11); setCalYear(calYear-1); } else setCalMonth(calMonth-1); setCalSelectedDay(null); };
    const nextMonth = () => { if (calMonth === 11) { setCalMonth(0); setCalYear(calYear+1); } else setCalMonth(calMonth+1); setCalSelectedDay(null); };
    
    const cells = [];
    for (let i = 0; i < firstWeekDay; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);
    
    return (
      <div style={{display:'flex', flexDirection:'column', gap:'1.5rem'}}>
        <div className="panel-card" style={{display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:'1rem'}}>
          <div>
            <h3 style={{margin:'0 0 0.5rem 0', display:'flex', alignItems:'center', gap:'0.5rem'}}>📅 Sincronização Google Calendar / Apple</h3>
            <p className="text-muted" style={{margin:0, fontSize:'0.85rem'}}>Adicione este link à sua aplicação de calendário para ver todos os eventos do CRM lá.</p>
          </div>
          <div style={{display:'flex', gap:'0.5rem', flex:'1', minWidth:'300px'}}>
            <input type="text" readOnly value={`${apiBase}/api/eventos/feed.ics`} className="inline-input" style={{flex:1, background:'#f8fafc'}} />
            <button onClick={() => { navigator.clipboard.writeText(`${apiBase}/api/eventos/feed.ics`); toast.success('📋 Link copiado!'); }} className="btn-submit">📋 Copiar Link</button>
            <a href={`${apiBase}/api/eventos/feed.ics`} target="_blank" rel="noreferrer" className="btn-submit" style={{background:'#2563eb', textDecoration:'none', color:'#fff'}}>📥 Baixar Calendário</a>
          </div>
        </div>

        <div style={{display:'flex', gap:'1.5rem', flexWrap:'wrap', alignItems:'flex-start'}}>
        <div className="panel-card" style={{flex:'1', minWidth:'320px'}}>
          {/* Header do calendário */}
          <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'1rem'}}>
            <button onClick={prevMonth} className="btn-submit" style={{padding:'0.3rem 0.8rem', fontSize:'1rem', background:'#475569'}}>&#8249;</button>
            <div className="panel-title" style={{margin:0}}>{mesesPT[calMonth]} {calYear}</div>
            <button onClick={nextMonth} className="btn-submit" style={{padding:'0.3rem 0.8rem', fontSize:'1rem', background:'#475569'}}>&#8250;</button>
          </div>
          {/* Dias da semana */}
          <div style={{display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:'2px', marginBottom:'4px'}}>
            {diasSemana.map(d => <div key={d} style={{textAlign:'center', fontSize:'0.7rem', fontWeight:700, color:'#64748b', padding:'4px 0'}}>{d}</div>)}
          </div>
          {/* Células do calendário */}
          <div style={{display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:'3px'}}>
            {cells.map((day, i) => {
              if (!day) return <div key={`empty-${i}`} />;
              const dayEvs = getEventosForDay(day);
              const isToday = day === today.getDate() && calMonth === today.getMonth() && calYear === today.getFullYear();
              const isSelected = day === calSelectedDay;
              return (
                <div key={day} onClick={() => setCalSelectedDay(day === calSelectedDay ? null : day)}
                  style={{
                    minHeight:'52px', borderRadius:'8px', padding:'4px', cursor:'pointer', userSelect:'none',
                    background: isSelected ? '#3b82f6' : isToday ? '#eff6ff' : dayEvs.length > 0 ? '#f0fdf4' : '#f8fafc',
                    border: isSelected ? '2px solid #1d4ed8' : isToday ? '2px solid #3b82f6' : '1px solid #e2e8f0',
                    transition:'all 0.15s'
                  }}>
                  <div style={{fontSize:'0.8rem', fontWeight: isToday?700:500, color: isSelected?'#fff': isToday?'#1d4ed8':'#334155'}}>{day}</div>
                  <div style={{display:'flex', flexWrap:'wrap', gap:'2px', marginTop:'2px'}}>
                    {dayEvs.slice(0,3).map(ev => (
                      <div key={ev.id} title={ev.nomes_principais} style={{width:'8px', height:'8px', borderRadius:'50%', background: coresEvento[ev.tipo_evento] || '#94a3b8'}} />
                    ))}
                    {dayEvs.length > 3 && <div style={{fontSize:'0.55rem', color:'#64748b'}}>+{dayEvs.length-3}</div>}
                  </div>
                </div>
              );
            })}
          </div>
          {/* Legenda */}
          <div style={{display:'flex', gap:'1rem', marginTop:'1rem', flexWrap:'wrap'}}>
            {Object.entries(coresEvento).map(([tipo, cor]) => (
              <div key={tipo} style={{display:'flex', alignItems:'center', gap:'4px', fontSize:'0.75rem', color:'#475569'}}>
                <div style={{width:'10px', height:'10px', borderRadius:'50%', background:cor}} />
                {tipo.charAt(0).toUpperCase() + tipo.slice(1)}
              </div>
            ))}
          </div>
        </div>
        
        {/* Painel lateral: eventos do dia selecionado */}
        <div className="panel-card" style={{flex:'0.7', minWidth:'260px'}}>
          <div className="panel-title">
            {calSelectedDay ? `📅 ${calSelectedDay} de ${mesesPT[calMonth]}` : '📅 Selecione um dia'}
          </div>
          {!calSelectedDay ? (
            <p className="text-muted" style={{fontSize:'0.85rem'}}>Clique num dia do calendário para ver os eventos agendados.</p>
          ) : selectedEventos.length === 0 ? (
            <p className="text-muted" style={{fontSize:'0.85rem'}}>Nenhum evento neste dia.</p>
          ) : selectedEventos.map(ev => {
            const anoOrigem = new Date(ev.data_evento).getFullYear();
            const anos = calYear - anoOrigem;
            return (
              <div key={ev.id} style={{padding:'0.75rem', borderRadius:'8px', marginBottom:'0.75rem', background:'#f8fafc', border:`2px solid ${coresEvento[ev.tipo_evento]||'#e2e8f0'}`}}>
                <div style={{display:'flex', alignItems:'center', gap:'0.5rem', marginBottom:'4px'}}>
                  {ev.foto_url && <img src={ev.foto_url} alt="" style={{width:'32px', height:'32px', borderRadius:'50%', objectFit:'cover'}} />}
                  <div>
                    <div style={{fontWeight:700, fontSize:'0.9rem'}}>{ev.nomes_principais}</div>
                    <div style={{fontSize:'0.75rem', color:'#64748b'}}>{ev.tipo_evento} • {anos > 0 ? `${anos} ano${anos!==1?'s':''}` : 'Ano de origem'}</div>
                  </div>
                </div>
                <div style={{fontSize:'0.7rem', color:'#94a3b8'}}>Grupo: {grupos.find(g=>g.id===ev.grupo_id)?.nome || ev.grupo_id?.substring(0,20) || 'N/A'}</div>
              </div>
            );
          })}
          
          {/* Resumo do mês */}
          <div style={{marginTop:'1.5rem', borderTop:'1px solid var(--border)', paddingTop:'1rem'}}>
            <div className="panel-title" style={{fontSize:'0.85rem', marginBottom:'0.5rem'}}>Resumo de {mesesPT[calMonth]}</div>
            {['casamento','aniversario','batizado','formatura'].map(tipo => {
              const count = eventos.filter(ev => new Date(ev.data_evento).getMonth() === calMonth && ev.tipo_evento === tipo).length;
              return count > 0 ? (
                <div key={tipo} style={{display:'flex', justifyContent:'space-between', fontSize:'0.8rem', padding:'2px 0', color:'#475569'}}>
                  <span style={{color: coresEvento[tipo]}}>● {tipo.charAt(0).toUpperCase()+tipo.slice(1)}</span>
                  <strong>{count}</strong>
                </div>
              ) : null;
            })}
            {eventos.filter(ev => new Date(ev.data_evento).getMonth() === calMonth).length === 0 && (
              <p style={{fontSize:'0.8rem', color:'#94a3b8'}}>Nenhum evento este mês.</p>
            )}
          </div>
        </div>
      </div>
      </div>
    );
  };

  /* ========== LAYOUT ========== */
  return (
    <div className="dashboard-layout">
      <ToastContainer position="top-right" autoClose={15000} hideProgressBar={false} newestOnTop closeOnClick pauseOnFocusLoss draggable pauseOnHover theme="colored" />
      <aside className="sidebar">
        <div className="sidebar-logo">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z"></path><path d="M2 17l10 5 10-5"></path><path d="M2 12l10 5 10-5"></path></svg>
          <span>LNSOTECH</span>
        </div>
        <nav className="nav-menu">
          <div className={`nav-item ${activeTab==='dashboard'?'active':''}`} onClick={()=>setActiveTab('dashboard')}><span>📊</span><span>Dashboard</span></div>
          <div className={`nav-item ${activeTab==='eventos'?'active':''}`} onClick={()=>setActiveTab('eventos')}><span>👥</span><span>Eventos/Casais</span></div>
          <div className={`nav-item ${activeTab==='calendario'?'active':''}`} onClick={()=>setActiveTab('calendario')}><span>📅</span><span>Calendário</span></div>
          <div className={`nav-item ${activeTab==='grupos'?'active':''}`} onClick={()=>setActiveTab('grupos')}><span>📱</span><span>Grupos WhatsApp</span></div>
          {isAdmin && <div className={`nav-item ${activeTab==='logs'?'active':''}`} onClick={()=>setActiveTab('logs')}><span>📖</span><span>Histórico</span></div>}
          <div className={`nav-item ${activeTab==='configuracoes'?'active':''}`} onClick={()=>setActiveTab('configuracoes')}><span>⚙️</span><span>Configurações</span></div>
        </nav>
        <div className="sidebar-footer" style={{padding:'1rem', borderTop:'1px solid #1e293b', display:'flex', alignItems:'center', justifyContent:'space-between'}}>
          <div style={{display:'flex', alignItems:'center', gap:'0.8rem'}}>
            <div className="user-avatar" style={{width:'32px', height:'32px', fontSize:'0.9rem'}}>{user?.nome?.charAt(0) || 'U'}</div>
            <div style={{overflow:'hidden'}}>
              <div style={{fontSize:'0.85rem', fontWeight:600, color:'#f1f5f9', whiteSpace:'nowrap', textOverflow:'ellipsis'}}>{user?.nome || 'Utilizador'}</div>
              <div style={{fontSize:'0.7rem', color:'#94a3b8'}}>{isAdmin ? 'Admin' : (isEditor ? 'Editor' : 'Leitor')}</div>
            </div>
          </div>
          <button onClick={onLogout} style={{background:'none', border:'none', color:'#94a3b8', cursor:'pointer', fontSize:'1.2rem'}} title="Sair">🚪</button>
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
            
            {!isOnline && <span className="icon-btn notification-badge" style={{background:'#f59e0b'}} title="Sistma Offline. Lembretes pendentes.">📴</span>}
            {offlineQueueLength > 0 && <span className="icon-btn notification-badge" style={{background:'#3b82f6'}} title={`${offlineQueueLength} registos por sincronizar.`}>⏳ {offlineQueueLength}</span>}
            {stats.falhasHoje > 0 && <span className="icon-btn notification-badge" title="Existem falhas!">🔔</span>}
            
            <div className="user-avatar topbar-avatar">{user?.nome?.charAt(0) || 'U'}</div>
          </div>
        </header>

        <div className="content-wrapper">
          <h2 className="page-title">{
            {dashboard:'Painel Executivo', eventos:'Gestão de Clientes', calendario:'Calendário de Eventos', grupos:'Grupos WhatsApp', logs:'Histórico e Auditoria', configuracoes:'Configurações'}[activeTab]
          }</h2>
          <p className="page-subtitle">LNSOTECH Automation CRM — {user.nivel_acesso?.toUpperCase()}</p>
          
          {activeTab === 'dashboard' && renderDashboard()}
          {activeTab === 'eventos' && renderEventos()}
          {activeTab === 'calendario' && renderCalendario()}
          {activeTab === 'grupos' && renderGrupos()}
          {activeTab === 'logs' && renderLogs()}
          {activeTab === 'configuracoes' && renderConfig()}
        </div>
      </main>

      {/* OVERLAY: EDITAR EVENTO */}
      {editingEvento && (
        <Overlay title="✏️ Editar Evento" onClose={()=>setEditingEvento(null)}>
            <div style={{display:'flex', flexDirection:'column', gap:'1rem'}}>
                <div>
                    <label style={{display:'block', fontSize:'0.85rem', fontWeight:600, marginBottom:'0.4rem', color:'#475569'}}>Nome do Cliente/Evento</label>
                    <input className="inline-input" style={{width:'100%'}} value={editEventoForm.nomes_principais} onChange={e=>setEditEventoForm({...editEventoForm, nomes_principais: e.target.value})} />
                </div>
                
                <div style={{display:'flex', gap:'1rem'}}>
                    <div style={{flex:1}}>
                        <label style={{display:'block', fontSize:'0.85rem', fontWeight:600, marginBottom:'0.4rem', color:'#475569'}}>Data</label>
                        <input type="date" className="inline-input" style={{width:'100%'}} value={editEventoForm.data_evento} onChange={e=>setEditEventoForm({...editEventoForm, data_evento: e.target.value})} />
                    </div>
                    <div style={{flex:1}}>
                        <label style={{display:'block', fontSize:'0.85rem', fontWeight:600, marginBottom:'0.4rem', color:'#475569'}}>Tipo</label>
                        <select className="inline-input" style={{width:'100%'}} value={editEventoForm.tipo_evento} onChange={e=>setEditEventoForm({...editEventoForm, tipo_evento: e.target.value})}>
                            {tiposEvento.map(t => <option key={t.id} value={t.nome}>{t.nome.charAt(0).toUpperCase() + t.nome.slice(1)}</option>)}
                        </select>
                    </div>
                </div>

                <div style={{display:'flex', gap:'1rem'}}>
                    <div style={{flex:1}}>
                        <label style={{display:'block', fontSize:'0.85rem', fontWeight:600, marginBottom:'0.4rem', color:'#475569'}}>Frequência</label>
                        <select className="inline-input" style={{width:'100%'}} value={editEventoForm.frequencia_lembrete} onChange={e=>setEditEventoForm({...editEventoForm, frequencia_lembrete: e.target.value})}>
                            <option value="anual">📅 Anual</option>
                            <option value="mensal">🔄 Mensal</option>
                            <option value="semanal">📆 Semanal</option>
                            <option value="diario">⏰ Diário</option>
                        </select>
                    </div>
                    <div style={{flex:1}}>
                        <label style={{display:'block', fontSize:'0.85rem', fontWeight:600, marginBottom:'0.4rem', color:'#475569'}}>Prioridade</label>
                        <select className="inline-input" style={{width:'100%', border: editEventoForm.prioridade==='urgente'?'2px solid #ef4444':''}} value={editEventoForm.prioridade} onChange={e=>setEditEventoForm({...editEventoForm, prioridade: e.target.value})}>
                            <option value="normal">🟢 Normal</option>
                            <option value="urgente">🚨 URGENTE</option>
                        </select>
                    </div>
                </div>

                <div style={{display:'flex', gap:'0.75rem', marginTop:'1.5rem'}}>
                    <button onClick={handleUpdateEvento} className="btn-submit" style={{flex:1, padding:'0.8rem'}}>💾 Guardar Alterações</button>
                    <button onClick={()=>setEditingEvento(null)} className="btn-submit" style={{flex:0.4, background:'#64748b', padding:'0.8rem'}}>Cancelar</button>
                </div>
            </div>
        </Overlay>
      )}

      {/* OVERLAY: HISTÓRICO */}
      {showHistoryFor && (
        <Overlay title="📜 Histórico de Alterações" onClose={()=>setShowHistoryFor(null)}>
            <div style={{maxHeight:'60vh', overflowY:'auto'}}>
                {historicoAlteracoes.length === 0 ? <p className="text-muted">Nenhuma alteração registada para este evento.</p> : (
                    <div className="table-responsive">
                        <table className="table-minimal">
                            <thead><tr><th>Data</th><th>Autor</th><th>Ação</th></tr></thead>
                            <tbody>
                                {historicoAlteracoes.map(h => (
                                    <tr key={h.id}>
                                        <td className="text-small" style={{whiteSpace:'nowrap'}}>{new Date(h.data_alteracao).toLocaleString('pt-PT')}</td>
                                        <td className="fw-bold">{h.usuario_nome || 'Sistema'}</td>
                                        <td className="text-small">Atualização de dados</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </Overlay>
      )}
    </div>
  );
}

const Overlay = ({ children, onClose, title }) => (
    <div style={{position:'fixed', inset:0, background:'rgba(0,0,0,0.6)', zIndex:999, display:'flex', alignItems:'center', justifyContent:'center', padding:'1rem', backdropFilter:'blur(4px)'}}>
        <div className="panel-card" style={{maxWidth:'600px', width:'100%', boxShadow:'0 25px 50px -12px rgb(0 0 0 / 0.25)', animation:'slideUp 0.3s ease-out'}}>
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1.5rem', borderBottom:'1px solid #e2e8f0', paddingBottom:'1rem'}}>
                <div className="panel-title" style={{margin:0, fontSize:'1.25rem'}}>{title}</div>
                <button onClick={onClose} style={{background:'none', border:'none', fontSize:'1.5rem', cursor:'pointer', color:'#64748b'}}>×</button>
            </div>
            {children}
        </div>
    </div>
);
