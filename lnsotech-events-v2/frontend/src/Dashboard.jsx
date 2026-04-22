import React, { useState, useEffect, useRef } from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { PieChart, Pie, Cell, LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid } from 'recharts';
import Swal from 'sweetalert2';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

// Custom Hooks
import { useAuth } from './hooks/useAuth';
import { useEventos } from './hooks/useEventos';
import { useBotStatus } from './hooks/useBotStatus';
import { useOfflineSync } from './hooks/useOfflineSync';
import { useTheme } from './hooks/useTheme';
import { useGrupos } from './hooks/useGrupos';

export default function Dashboard({ token, user: rawUser, onLogout }) {
  // 1. Hook de Autenticação e Permissões
  const { user, isAdmin, isEditor, canEdit, headers, jsonHeaders } = useAuth(rawUser, token, onLogout);

  // 2. Hook de Tema
  const { theme, toggleTheme } = useTheme();

  // Estados de persistência local necessários para hooks
  const [mutedGroups, setMutedGroups] = useState(() => JSON.parse(localStorage.getItem('muted_groups') || '[]'));
  useEffect(() => { localStorage.setItem('muted_groups', JSON.stringify(mutedGroups)); }, [mutedGroups]);

  // Sincronizar grupos silenciados com o backend no início
  useEffect(() => {
    const initMuted = async () => {
      try {
        const res = await fetch(`${apiBase}/api/auth/grupos/muted`, { headers });
        if (res.ok) {
          const data = await res.json();
          setMutedGroups(data.map(m => m.grupo_id));
        }
      } catch (e) { console.error('Erro ao buscar grupos silenciados:', e); }
    };
    if (token) initMuted();
  }, [token, headers]);

  // 3. Estados de UI
  const [activeTab, setActiveTab] = useState(rawUser?.nivel_acesso === 'leitor' ? 'calendario' : 'dashboard'); 
  const [configSubTab, setConfigSubTab] = useState('geral');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // 4. Hook de Eventos e Estatísticas
  const { eventos, stats, loading: dataLoading, refresh: refreshData } = useEventos(token, searchQuery);

  // 5. Hook de Bot WhatsApp
  const { status: waStatus, reconnect: reconnectBot } = useBotStatus(token, activeTab);

  // 6. Hook de Grupos
  const { grupos, loading: gruposLoading, refresh: refreshGrupos } = useGrupos(token, activeTab, mutedGroups);

  // 7. Hook de Sincronização Offline (PWA)
  const { isOnline, queueLength: offlineQueueLength, addToQueue } = useOfflineSync(token, (count) => {
    Swal.fire({ title: 'Sincronizado!', text: `${count} registos offline foram enviados para o servidor.`, icon: 'success', timer: 10000, timerProgressBar: true, confirmButtonColor: '#10b981' });
    refreshData();
  });

  // Estados restantes (Configurações e Formulários)
  const [horaLembrete, setHoraLembrete] = useState('07:00');
  const [assinaturaBot, setAssinaturaBot] = useState('');
  const [respostaPadraoBot, setRespostaPadraoBot] = useState('');

  const [formNomes, setFormNomes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState('');
  const [formTipo, setFormTipo] = useState('casamento');
  const [formGrupo, setFormGrupo] = useState('');
  const [formFrequencia, setFormFrequencia] = useState('anual');
  const [formPrioridade, setFormPrioridade] = useState('normal');

  const [usuarios, setUsuarios] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [logs, setLogs] = useState([]);
  const [logFilter, setLogFilter] = useState('todos');
  const [tiposEvento, setTiposEvento] = useState([]);
  const [newTipoNome, setNewTipoNome] = useState('');
  const [newTipoCor, setNewTipoCor] = useState('#3b82f6');
  
  const [editingEvento, setEditingEvento] = useState(null);
  const [editEventoForm, setEditEventoForm] = useState({ nomes_principais: '', data_evento: '', tipo_evento: '', grupo_id: '', frequencia_lembrete: 'anual', prioridade: 'normal' });
  const [showHistoryFor, setShowHistoryFor] = useState(null);
  const [historicoAlteracoes, setHistoricoAlteracoes] = useState([]);

  const [backups, setBackups] = useState([]);

  const [newUserNome, setNewUserNome] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserSenha, setNewUserSenha] = useState('');
  const [newUserRole, setNewUserRole] = useState('leitor');
  const [newUserGrupos, setNewUserGrupos] = useState([]);
  const [newUserTipos, setNewUserTipos] = useState([]);
  const [editingUserId, setEditingUserId] = useState(null);
  const [editUserForm, setEditUserForm] = useState({ nome: '', email: '', senha: '', nivel_acesso: 'leitor', grupos_permitidos: [], tipos_permitidos: [] });
  
  const [logsAuditoria, setLogsAuditoria] = useState([]);

  const [filterGroup, setFilterGroup] = useState(null);
  const [filterType, setFilterType] = useState(null);

  const [editingTipoId, setEditingTipoId] = useState(null);
  const [editTipoForm, setEditTipoForm] = useState({ nome: '', cor: '#3b82f6', template_resposta: '' });

  const [bots, setBots] = useState([]);
  const [botsLoading, setBotsLoading] = useState(false);

  const today = new Date();
  const [calMonth, setCalMonth] = useState(today.getMonth());
  const [calYear, setCalYear] = useState(today.getFullYear());
  const [calSelectedDay, setCalSelectedDay] = useState(null);

  const [selectedBotIdForGrupos, setSelectedBotIdForGrupos] = useState('');
  const [tutorialStep, setTutorialStep] = useState(0);
  const skipTutorial = () => { setTutorialStep(0); setActiveTab('dashboard'); localStorage.setItem('tutorial_done', 'true'); };
  
  const prevTutorial = () => {
    setTutorialStep(prev => {
        const next = prev - 1;
        if (next === 2) setActiveTab('dashboard');
        if (next === 3) setActiveTab('grupos');
        if (next === 5) setActiveTab('dashboard');
        if (next === 6) setActiveTab('calendario');
        if (next === 7) setActiveTab('calendario');
        return next;
    });
  };

  const nextTutorial = () => {
    setTutorialStep(prev => {
        const next = prev + 1;
        if (next === 3) setActiveTab('grupos');
        if (next === 4) setActiveTab('grupos');
        if (next === 5) setActiveTab('dashboard');
        if (next === 6) setActiveTab('calendario');
        if (next === 7) setActiveTab('calendario');
        if (next === 8) setActiveTab('eventos');
        if (next === 9) {
            // Confetti effect logic here if needed or just show the last step
        }
        return next;
    });
  };

  useEffect(() => {
    if (tutorialStep > 0) {
        const steps = [null, null, "step-stats", "step-bot", "step-groups-list", "step-new-event", "step-calendar-sync", "step-calendar-grid", "step-export", null];
        const targetId = steps[tutorialStep];
        if (targetId) {
            setTimeout(() => {
                const el = document.getElementById(targetId);
                if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 400);
        }
    }
  }, [tutorialStep]);

  useEffect(() => {
    const done = localStorage.getItem('tutorial_done');
    if (!done && token) {
        setTimeout(() => setTutorialStep(1), 2000);
    }
  }, [token]);

  const csvRef = useRef(null);
  const apiBase = '';

  const changeTab = (tab) => {
    if (tab === 'eventos') {
        setFilterGroup(null);
        setFilterType(null);
        setSearchQuery('');
    }
    setActiveTab(tab);
    setSidebarOpen(false);
  };

  const fetchConfigs = async () => {
    try {
      const r = await fetch(`${apiBase}/api/auth/configuracoes`, { headers });
      const data = await r.json();
      if (data.hora_lembrete) setHoraLembrete(data.hora_lembrete);
      if (data.assinatura_bot) setAssinaturaBot(data.assinatura_bot);
      if (data.resposta_padrao_bot) setRespostaPadraoBot(data.resposta_padrao_bot);
    } catch (e) { console.error(e); }
  };

  const renderDiff = (oldData, newData) => {
    try {
      const old = typeof oldData === 'string' ? JSON.parse(oldData) : oldData;
      const current = typeof newData === 'string' ? JSON.parse(newData) : newData;
      const fields = [
        { key: 'nomes_principais', label: 'Nome' },
        { key: 'data_evento', label: 'Data' },
        { key: 'tipo_evento', label: 'Tipo' },
        { key: 'grupo_id', label: 'Grupo' },
        { key: 'frequencia_lembrete', label: 'Frequência' },
        { key: 'prioridade', label: 'Prioridade' }
      ];
      const diffs = fields.filter(f => String(old[f.key]||'').trim() !== String(current[f.key]||'').trim());
      if (diffs.length === 0) return <span className="text-muted" style={{fontSize:'0.7rem'}}>Atualização geral.</span>;
      return (
        <ul style={{margin:0, padding:'0 0 0 1rem', fontSize:'0.75rem', color:'#475569'}}>
          {diffs.map(d => (
            <li key={d.key} style={{marginBottom:'0.2rem'}}>
              <span style={{fontWeight:600}}>{d.label}:</span> <span style={{textDecoration:'line-through', color:'#94a3b8'}}>{old[d.key] || 'vazio'}</span> → <span style={{color:'#10b981', fontWeight:600}}>{current[d.key] || 'vazio'}</span>
            </li>
          ))}
        </ul>
      );
    } catch (e) { return <span className="text-muted" style={{fontSize:'0.7rem'}}>Registo antigo.</span>; }
  };

  const handleSaveConfig = async (chave, valor) => {
    console.log(`[Config] A salvar ${chave} com valor: ${valor}`);
    try {
      const r = await fetch(`${apiBase}/api/auth/configuracoes`, {
        method: 'POST',
        headers: jsonHeaders,
        body: JSON.stringify({ chave, valor })
      });
      if (r.ok) {
        Swal.fire({ icon: 'success', title: 'Sucesso', text: 'Configuração atualizada!', timer: 2000, showConfirmButton: false });
        fetchConfigs();
      } else {
        const data = await r.json();
        Swal.fire('Erro', data.erro || 'Falha ao salvar no servidor', 'error');
      }
    } catch (e) { 
      console.error(e);
      Swal.fire('Erro', 'Falha ao salvar configuração: ' + e.message, 'error'); 
    }
  };

  const handleTestarLembretes = async () => {
    const result = await Swal.fire({
      title: 'Disparar Lembretes?',
      text: "Isto vai enviar as mensagens para todos os aniversários/eventos de HOJE imediatamente.",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#10b981',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Sim, disparar!',
      cancelButtonText: 'Cancelar'
    });

    if (result.isConfirmed) {
      Swal.fire({ title: '🎓 A processar...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
      try {
        const r = await fetch(`${apiBase}/api/eventos/testar-lembretes`, { method: 'POST', headers: jsonHeaders });
        let data = {};
        try { 
            data = await r.json(); 
        } catch(e) { 
            data = { erro: 'O servidor retornou uma resposta inválida (HTML). Verifique se o servidor backend está a correr.' }; 
        }

        if (r.ok) {
            Swal.fire('Concluído', data.mensagem || 'Lembretes disparados com sucesso!', 'success');
            if (isAdmin) fetchData();
        } else {
            Swal.fire({ icon: 'error', title: 'Falha no processamento', text: data.erro || 'Erro interno do servidor' });
        }
      } catch (err) {
        Swal.fire({ icon: 'error', title: 'Erro de Rede', text: 'Não foi possível ligar ao servidor de lembretes. Verifique a sua ligação.' });
      }
    }
  };

  const syncOfflineQueue = async () => {
    // Agora tratado pelo hook useOfflineSync
  };

  // =================== FETCH DATA =================== //
  const fetchData = async () => {
      // Agora tratado em grande parte pelos hooks, mas mantemos para buscar dados extras (logs, templates, backups)
      try {
          if (canEdit) {
              const resUsr = await fetch(`${apiBase}/api/auth/usuarios`, { headers });
              if (resUsr.ok) setUsuarios(await resUsr.json());
              const resTp = await fetch(`${apiBase}/api/eventos/templates`, { headers });
              if (resTp.ok) setTemplates(await resTp.json());
          }
          const resTypes = await fetch(`${apiBase}/api/eventos/tipos`, { headers });
          if (resTypes.ok) setTiposEvento(await resTypes.json());

          if (isAdmin) {
              const resAuditoria = await fetch(`${apiBase}/api/auth/auditoria`, { headers });
              if (resAuditoria.ok) setLogsAuditoria(await resAuditoria.json());
              
              const resBots = await fetch(`${apiBase}/api/eventos/bots`, { headers });
              if (resBots.ok) setBots(await resBots.json());
              
              fetchConfigs();
          }
      } catch (e) { console.error(e); }
  };

  useEffect(() => { 
    fetchData(); 
    // Se estiver na aba de grupos, atualiza o status dos bots a cada 5 segundos para refletir o scan do QR
    let interval;
    if (activeTab === 'grupos' && isAdmin) {
        interval = setInterval(() => {
            fetch(`${apiBase}/api/eventos/bots`, { headers })
                .then(r => r.ok ? r.json() : [])
                .then(data => setBots(data))
                .catch(e => console.error(e));
        }, 5000);
    }
    return () => { if (interval) clearInterval(interval); };
  }, [activeTab, isAdmin]);

  // =================== HANDLERS =================== //
  const handleReconectarWA = async () => {
    const result = await Swal.fire({ title: 'Reconectar WhatsApp?', text: 'Isto irá desconectar o WhatsApp atual e pedir um novo QR code. O bot vai reiniciar.', icon: 'warning', showCancelButton: true, confirmButtonColor: '#10b981', cancelButtonColor: '#64748b', confirmButtonText: 'Sim, Reconectar', cancelButtonText: 'Cancelar' });
    if (!result.isConfirmed) return;
    try {
      await reconnectBot();
      toast.info('A reiniciar bot...');
    } catch (e) { toast.error('Erro ao pedir reconexão'); }
  };

  const handleRestoreBackup = async (filename) => {
    const step1 = await Swal.fire({ title: '⚠️ ATENÇÃO EXTREMA!', html: `Isto irá substituir <strong>TODA</strong> a base de dados atual pelo backup <b>"${filename}"</b>.<br/><br/>Todos os dados criados desde essa data serão <span style="color:#dc2626;font-weight:bold">PERDIDOS</span>.`, icon: 'warning', showCancelButton: true, confirmButtonColor: '#10b981', cancelButtonColor: '#64748b', confirmButtonText: 'Sim, quero restaurar', cancelButtonText: 'Cancelar' });
    if (!step1.isConfirmed) return;
    
    const step2 = await Swal.fire({ title: 'Confirmação Final', input: 'text', inputLabel: 'Escreva "RESTAURAR" para confirmar:', inputPlaceholder: 'RESTAURAR', showCancelButton: true, confirmButtonColor: '#10b981', inputValidator: (v) => v !== 'RESTAURAR' ? 'Escreva exactamente RESTAURAR' : null });
    if (!step2.isConfirmed) { toast.info('Operação cancelada.'); return; }

    try {
        setIsSubmitting(true);
        const res = await fetch(`${apiBase}/api/auth/backups/restore/${filename}`, { method: 'POST', headers: jsonHeaders });
        let data = {};
        try { data = await res.json(); } catch(e) { data = { erro: 'Resposta inválida' }; }
        
        if (res.ok) {
            await Swal.fire({ title: 'Restaurado!', text: 'Backup restaurado com sucesso. A página será atualizada.', icon: 'success', timer: 2000, showConfirmButton: false });
            window.location.reload();
        } else {
            Swal.fire('Erro', data.erro || 'Falha ao restaurar', 'error');
        }
    } catch (err) {
        Swal.fire('Erro', 'Erro na comunicação com o servidor.', 'error');
    } finally {
        setIsSubmitting(false);
    }
  };

  const handleUploadRestore = async (file) => {
    if (!file) return;
    const confirm = await Swal.fire({ 
        title: 'Fazer Upload e Restaurar?', 
        text: 'Este ficheiro será enviado para o servidor e restaurado IMEDIATAMENTE. Deseja continuar?', 
        icon: 'warning', 
        showCancelButton: true, 
        confirmButtonText: 'Sim, subir e restaurar' 
    });
    
    if (confirm.isConfirmed) {
        const formData = new FormData();
        formData.append('file', file);
        
        Swal.fire({ title: '📤 Enviando ficheiro...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
        
        try {
            const res = await fetch(`${apiBase}/api/auth/backups/upload`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }, // Form Data não leva JSON headers
                body: formData
            });
            
            if (res.ok) {
                await Swal.fire({ title: 'Sucesso!', text: 'Backup enviado e restaurado!', icon: 'success' });
                window.location.reload();
            } else {
                const d = await res.json();
                Swal.fire('Erro', d.erro || 'Falha no upload/restauro', 'error');
            }
        } catch (e) {
            Swal.fire('Erro', 'Erro de conexão.', 'error');
        }
    }
  };

  const handleExportCSV = () => window.open(`${apiBase}/api/eventos?exportCsv=true`, '_blank');

  const handleCreateUsuario = async () => {
    if (!newUserNome || !newUserEmail || !newUserSenha) return Swal.fire({ toast: true, position: 'top-end', icon: 'warning', title: '⚠️ Preencha os dados!', showConfirmButton: false, timer: 3000, background: '#f59e0b', color: '#fff'});
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newUserEmail)) return Swal.fire({ toast: true, position: 'top-end', icon: 'error', title: '📧 Email inválido!', text: 'Formato incorreto.', showConfirmButton: false, timer: 4000, background: '#ef4444', color: '#fff' });
    
    try {
      const r = await fetch(`${apiBase}/api/auth/usuarios`, {
        method: 'POST',
        headers: jsonHeaders,
        body: JSON.stringify({ nome: newUserNome, email: newUserEmail, senha: newUserSenha, nivel_acesso: newUserRole, grupos_permitidos: newUserGrupos, tipos_permitidos: newUserTipos })
      });
      if (r.ok) {
        Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: '👤 Utilizador criado!', showConfirmButton: false, timer: 4000, timerProgressBar: true, background: '#10b981', color: '#fff' });
        setNewUserNome(''); setNewUserEmail(''); setNewUserSenha(''); setNewUserGrupos([]); setNewUserTipos([]);
        fetchData();
      } else { const d = await r.json(); Swal.fire({ toast: true, position: 'top-end', icon: 'error', title: d.erro || 'Falha ao criar', showConfirmButton: false, timer: 4000, background: '#ef4444', color: '#fff' }); }
    } catch (e) { Swal.fire({ toast: true, position: 'top-end', icon: 'error', title: 'Erro de rede', showConfirmButton: false, timer: 4000, background: '#ef4444', color: '#fff' }); }
  };

  const handleDeleteUsuario = async (id) => {
    const res = await Swal.fire({ title: 'Eliminar?', text: 'Cuidado! Ação irreversível.', icon: 'warning', showCancelButton: true });
    if (!res.isConfirmed) return;
    try {
      const r = await fetch(`${apiBase}/api/auth/usuarios/${id}`, { method: 'DELETE', headers });
      if (r.ok) { toast.success('Removido!'); fetchData(); }
    } catch (e) { toast.error('Falha ao remover'); }
  };

  const handleUpdateTemplate = async (id, mensagem) => {
    try {
      const r = await fetch(`${apiBase}/api/eventos/templates/${id}`, {
        method: 'PUT',
        headers: jsonHeaders,
        body: JSON.stringify({ mensagem })
      });
      if (r.ok) {
        Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: '📝 Template guardado!', showConfirmButton: false, timer: 3000, timerProgressBar: true, background: '#3b82f6', color: '#fff', iconColor: '#fff' });
      }
    } catch (e) { toast.error('Erro ao guardar template'); }
  };

  // Export CSV ja definido acima

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
    const data = await res.json(); Swal.fire({ title: 'Importado!', text: data.mensagem || 'Dados importados com sucesso.', icon: 'success', timer: 10000, timerProgressBar: true, confirmButtonColor: '#10b981' }); 
    fetchData();
    refreshData();
    e.target.value = '';
  };

  const handleCreateEvento = async (e) => {
    e.preventDefault();
    
    if (!user || !user.id) {
        Swal.fire({ icon: 'error', title: 'Sessão Expirada', text: 'Por favor, faça login novamente.' });
        return;
    }

    if (!canEdit) {
        Swal.fire({ toast: true, position: 'top-end', icon: 'warning', title: 'Permissão negada!', showConfirmButton: false, timer: 10000, timerProgressBar: true, background: '#f59e0b', color: '#fff', iconColor: '#fff' });
        return;
    }

    if (!formNomes || !formData || !formTipo || !formGrupo) {
        Swal.fire({ toast: true, position: 'top-end', icon: 'warning', title: 'Campos Incompletos', text: 'Por favor, preencha todos os campos obrigatórios.', showConfirmButton: false, timer: 10000, timerProgressBar: true, background: '#f59e0b', color: '#fff', iconColor: '#fff' });
        return;
    }
    
    const payload = { 
        nomes_principais: formNomes, 
        data_evento: formData, 
        tipo_evento: formTipo, 
        grupo_id: formGrupo, 
        criado_por: user.id, 
        frequencia_lembrete: formFrequencia,
        prioridade: formPrioridade
    };

    setIsSubmitting(true);
    try {
        if (!isOnline) {
           addToQueue(payload);
           setFormNomes(''); setFormData(''); setFormFrequencia('anual');
           Swal.fire({ toast: true, position: 'top-end', icon: 'info', title: '📴 Guardado Offline!', text: 'Será sincronizado automaticamente.', showConfirmButton: false, timer: 10000, timerProgressBar: true, background: '#3b82f6', color: '#fff', iconColor: '#fff' });
           setIsSubmitting(false);
           return;
        }

        const res = await fetch(`${apiBase}/api/eventos`, { method: 'POST', headers: jsonHeaders, body: JSON.stringify(payload) });
        
        let data = {};
        try { data = await res.json(); } catch(e) { data = { erro: 'Resposta inválida do servidor' }; }

        if (res.ok) { 
            setFormNomes(''); setFormData(''); setFormFrequencia('anual'); 
            Swal.fire({ title: 'Sucesso!', text: 'Evento registado com sucesso.', icon: 'success', timer: 4000, confirmButtonColor: '#10b981' }); 
            fetchData(); 
            refreshData();
        } else {
            Swal.fire({ 
                toast: true, position: 'top-end', icon: 'error', 
                title: 'Erro ao guardar', text: data.erro || 'Falha no servidor', 
                showConfirmButton: false, timer: 10000, timerProgressBar: true, 
                background: '#ef4444', color: '#fff', iconColor: '#fff' 
            });
        }
    } catch (err) {
        Swal.fire({ 
            toast: true, position: 'top-end', icon: 'error', 
            title: 'Erro de Conexão', text: err.message, 
            showConfirmButton: false, timer: 10000, timerProgressBar: true, 
            background: '#ef4444', color: '#fff', iconColor: '#fff' 
        });
    } finally {
        setIsSubmitting(false);
    }
  };

  const handleUploadFoto = async (eventoId, file) => {
    if (!file) return;
    const fd = new FormData(); fd.append('foto', file);
    const res = await fetch(`${apiBase}/api/eventos/${eventoId}/foto`, { method: 'POST', headers: { 'Authorization': `Bearer ${token}` }, body: fd });
    if (res.ok) { 
        Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: '🖼️ Foto Anexada!', showConfirmButton: false, timer: 4000, timerProgressBar: true, background: '#10b981', color: '#fff', iconColor: '#fff' });
        fetchData(); 
    } else {
        Swal.fire({ toast: true, position: 'top-end', icon: 'error', title: 'Erro ao anexar foto', showConfirmButton: false, timer: 5000, timerProgressBar: true, background: '#ef4444', color: '#fff', iconColor: '#fff' });
    }
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
    try {
        const res = await fetch(`${apiBase}/api/eventos/${editingEvento}`, {
            method: 'PUT',
            headers: jsonHeaders,
            body: JSON.stringify({ ...editEventoForm, usuario_id: user.id })
        });

        let data = {};
        try { data = await res.json(); } catch(e) { data = { erro: 'Resposta inválida' }; }

        if (res.ok) { 
            Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: '✅ Evento atualizado!', showConfirmButton: false, timer: 4000, timerProgressBar: true, background: '#10b981', color: '#fff', iconColor: '#fff' });
            setEditingEvento(null); 
            fetchData(); 
            refreshData();
        } else {
            Swal.fire({ 
                toast: true, position: 'top-end', icon: 'error', 
                title: 'Erro ao atualizar', text: data.erro || 'Falha no servidor', 
                showConfirmButton: false, timer: 10000, timerProgressBar: true, 
                background: '#ef4444', color: '#fff', iconColor: '#fff' 
            });
        }
    } catch (err) {
        Swal.fire({ 
            toast: true, position: 'top-end', icon: 'error', 
            title: 'Erro de Conexão', text: err.message, 
            showConfirmButton: false, timer: 10000, timerProgressBar: true, 
            background: '#ef4444', color: '#fff', iconColor: '#fff' 
        });
    }
  };

  const fetchHistorico = async (id) => {
    const res = await fetch(`${apiBase}/api/eventos/${id}/historico`, { headers });
    if (res.ok) {
        setHistoricoAlteracoes(await res.json());
        setShowHistoryFor(id);
    }
  };

  const handleRefreshLogs = async () => {
    try {
        await fetchData();
        Swal.fire({
            toast: true,
            position: 'top-end',
            icon: 'success',
            title: '📜 Histórico atualizado!',
            showConfirmButton: false,
            timer: 2000,
            timerProgressBar: true,
            background: '#10b981',
            color: '#fff',
            iconColor: '#fff'
        });
    } catch (e) {
        toast.error('Erro ao atualizar histórico');
    }
  };

  const handleClearLogs = async () => {
    const res = await Swal.fire({
        title: 'Limpar Todo o Histórico?',
        text: 'Esta ação irá apagar todos os registos (envios, respostas e alterações). Não é possível reverter!',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        cancelButtonColor: '#64748b',
        confirmButtonText: 'Sim, apagar tudo!',
        cancelButtonText: 'Cancelar'
    });

    if (res.isConfirmed) {
        try {
            const r = await fetch(`${apiBase}/api/eventos/logs/all`, { method: 'DELETE', headers });
            if (r.ok) {
                Swal.fire('Eliminado!', 'Todo o histórico de logs foi removido.', 'success');
                fetchData();
            } else {
                Swal.fire({ toast: true, position: 'top-end', icon: 'error', title: 'Falha ao limpar histórico completo', showConfirmButton: false, timer: 10000, timerProgressBar: true, background: '#ef4444', color: '#fff', iconColor: '#fff' });
            }
        } catch (e) {
            Swal.fire({ toast: true, position: 'top-end', icon: 'error', title: 'Erro de conexão ao limpar histórico', showConfirmButton: false, timer: 10000, timerProgressBar: true, background: '#ef4444', color: '#fff', iconColor: '#fff' });
        }
    }
  };

  const handleDeleteLog = async (id) => {
    try {
        const r = await fetch(`${apiBase}/api/eventos/logs/${id}`, { method: 'DELETE', headers });
        if (r.ok) {
            setLogs(logs.filter(l => l.id !== id));
            Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Registo removido', showConfirmButton: false, timer: 4000, timerProgressBar: true, background: '#10b981', color: '#fff', iconColor: '#fff' });
        } else {
            Swal.fire({ toast: true, position: 'top-end', icon: 'error', title: 'Falha ao apagar registo', showConfirmButton: false, timer: 10000, timerProgressBar: true, background: '#ef4444', color: '#fff', iconColor: '#fff' });
        }
    } catch (e) {
        Swal.fire({ toast: true, position: 'top-end', icon: 'error', title: 'Erro ao eliminar log', showConfirmButton: false, timer: 10000, timerProgressBar: true, background: '#ef4444', color: '#fff', iconColor: '#fff' });
    }
  };

  const apagarEvento = async (id) => {
    if (!isAdmin) {
        Swal.fire({ toast: true, position: 'top-end', icon: 'warning', title: 'Permissão negada!', text: 'Só Admins podem apagar.', showConfirmButton: false, timer: 10000, timerProgressBar: true, background: '#f59e0b', color: '#fff', iconColor: '#fff' });
        return;
    }
    const result = await Swal.fire({ title: 'Apagar Evento?', text: 'Esta ação não pode ser revertida.', icon: 'warning', showCancelButton: true, confirmButtonColor: '#ef4444', cancelButtonColor: '#64748b', confirmButtonText: 'Sim, Apagar', cancelButtonText: 'Cancelar' });
    if (result.isConfirmed) { 
        await fetch(`${apiBase}/api/eventos/${id}`, { method: 'DELETE', headers }); 
        fetchData(); 
        refreshData();
        Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: '🗑️ Evento apagado.', showConfirmButton: false, timer: 3000, timerProgressBar: true, background: '#ef4444', color: '#fff', iconColor: '#fff' });
    }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    const res = await fetch(`${apiBase}/api/auth/usuarios`, { method: 'POST', headers: jsonHeaders, body: JSON.stringify({ nome: newUserNome, email: newUserEmail, senha: newUserSenha, nivel_acesso: newUserRole }) });
    const d = await res.json();
    if (res.ok) { 
        Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: '👤 Utilizador Criado!', showConfirmButton: false, timer: 4000, timerProgressBar: true, background: '#10b981', color: '#fff', iconColor: '#fff' });
        setNewUserNome(''); setNewUserEmail(''); setNewUserSenha(''); setNewUserRole('leitor'); 
        fetchData(); 
    }
    else {
        Swal.fire({ toast: true, position: 'top-end', icon: 'error', title: d.erro || 'Erro ao criar utilizador', showConfirmButton: false, timer: 10000, timerProgressBar: true, background: '#ef4444', color: '#fff', iconColor: '#fff' });
    }
  };

  const handleDeleteUser = async (id) => {
    const result = await Swal.fire({ title: 'Remover Utilizador?', text: 'Esta ação é permanente.', icon: 'warning', showCancelButton: true, confirmButtonColor: '#ef4444', cancelButtonColor: '#64748b', confirmButtonText: 'Sim, Remover', cancelButtonText: 'Cancelar' });
    if (result.isConfirmed) { 
        const res = await fetch(`${apiBase}/api/auth/usuarios/${id}`, { method: 'DELETE', headers }); 
        if (res.ok) { 
            fetchData(); 
            Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: '👤 Utilizador removido.', showConfirmButton: false, timer: 3000, timerProgressBar: true, background: '#ef4444', color: '#fff', iconColor: '#fff' });
        } 
    }
  };

  const startEditUser = (u) => {
    setEditingUserId(u.id);
    let gp = [], tp = [];
    try { gp = typeof u.grupos_permitidos === 'string' ? JSON.parse(u.grupos_permitidos) : (u.grupos_permitidos || []); } catch(e){}
    try { tp = typeof u.tipos_permitidos === 'string' ? JSON.parse(u.tipos_permitidos) : (u.tipos_permitidos || []); } catch(e){}
    setEditUserForm({ nome: u.nome, email: u.email, senha: '', nivel_acesso: u.nivel_acesso, grupos_permitidos: gp, tipos_permitidos: tp });
  };

  const handleUpdateUser = async () => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(editUserForm.email)) return Swal.fire({ toast: true, position: 'top-end', icon: 'error', title: '📧 Email inválido!', text: 'Formato incorreto.', showConfirmButton: false, timer: 4000, background: '#ef4444', color: '#fff' });
    
    const res = await fetch(`${apiBase}/api/auth/usuarios/${editingUserId}`, {
      method: 'PUT', headers: jsonHeaders,
      body: JSON.stringify(editUserForm)
    });
    const d = await res.json();
    if (res.ok) { 
        Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: '💾 Utilizador atualizado!', showConfirmButton: false, timer: 4000, timerProgressBar: true, background: '#475569', color: '#fff', iconColor: '#fff' });
        setEditingUserId(null); 
        fetchData(); 
    }
    else Swal.fire({ toast: true, position: 'top-end', icon: 'error', title: d.erro || 'Erro ao atualizar', showConfirmButton: false, timer: 4000, background: '#ef4444', color: '#fff' });
  };

  // ========== GESTÃO DE TIPOS ==========
  const handleCreateTipo = async () => {
    if (!newTipoNome) {
        Swal.fire({ toast: true, position: 'top-end', icon: 'warning', title: 'Nome é obrigatório', showConfirmButton: false, timer: 10000, timerProgressBar: true, background: '#f59e0b', color: '#fff', iconColor: '#fff' });
        return;
    }
    const r = await fetch(`${apiBase}/api/eventos/tipos`, {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({ nome: newTipoNome.toLowerCase(), cor: newTipoCor })
    });
    if (r.ok) { 
        Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: '🎨 Tipo criado!', showConfirmButton: false, timer: 3000, timerProgressBar: true, background: '#10b981', color: '#fff', iconColor: '#fff' });
        setNewTipoNome(''); 
        fetchData(); 
    }
  };

  const startEditTipo = (t) => {
    setEditingTipoId(t.id);
    setEditTipoForm({ nome: t.nome, cor: t.cor, template_resposta: t.template_resposta || '' });
  };

  const handleUpdateTipo = async () => {
    const r = await fetch(`${apiBase}/api/eventos/tipos/${editingTipoId}`, {
      method: 'PUT',
      headers: jsonHeaders,
      body: JSON.stringify(editTipoForm)
    });
    if (r.ok) { 
        Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: '✅ Tipo atualizado!', showConfirmButton: false, timer: 3000, timerProgressBar: true, background: '#3b82f6', color: '#fff', iconColor: '#fff' });
        setEditingTipoId(null); 
        fetchData(); 
    }
  };

  const handleDeleteTipo = async (id) => {
    const result = await Swal.fire({ title: 'Apagar Tipo?', text: 'Cuidado!', icon: 'warning', showCancelButton: true });
    if (result.isConfirmed) {
      const r = await fetch(`${apiBase}/api/eventos/tipos/${id}`, { method: 'DELETE', headers });
      if (r.ok) { 
        Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: '🗑️ Tipo removido!', showConfirmButton: false, timer: 3000, timerProgressBar: true, background: '#ef4444', color: '#fff', iconColor: '#fff' });
        fetchData(); 
      }
    }
  };



  const handleDeleteBackup = async (filename) => {
    const result = await Swal.fire({ title: 'Eliminar Backup?', text: 'Esta ação não pode ser revertida!', icon: 'error', showCancelButton: true, confirmButtonColor: '#ef4444' });
    if (result.isConfirmed) {
      const res = await fetch(`${apiBase}/api/auth/backups/${filename}`, { method: 'DELETE', headers });
      if (res.ok) {
        Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Backup eliminado', showConfirmButton: false, timer: 4000, timerProgressBar: true, background: '#10b981', color: '#fff', iconColor: '#fff' });
        fetchData();
      }
    }
  };

  const handleTesteConexao = async (grupoId, nomeGrupo) => {
    const groupStatus = grupos.find(g => g.id === grupoId);
    if (groupStatus?.isMuted || mutedGroups.includes(grupoId)) {
        return Swal.fire({ 
            title: 'Grupo Desconectado', 
            text: 'Este grupo está suspenso localmente. Clique em "Conectar" antes de realizar o teste.', 
            icon: 'info',
            confirmButtonColor: '#10b981'
        });
    }

    const code = Math.floor(1000 + Math.random() * 9000);
    const result = await Swal.fire({ title: '⚠️ Testar Conexão', html: `Você está prestes a enviar uma mensagem de teste para <strong>todos os membros</strong> do grupo "<b>${nomeGrupo || 'este grupo'}</b>".<br/><br/>Para confirmar, digite o código: <strong style="color:#dc2626;font-size:1.3rem">${code}</strong>`, input: 'text', inputPlaceholder: 'Digite o código...', showCancelButton: true, confirmButtonColor: '#10b981', cancelButtonColor: '#64748b', confirmButtonText: '🤖 Enviar Teste', cancelButtonText: 'Cancelar', inputValidator: (v) => v !== code.toString() ? 'Código incorreto!' : null });
    if (!result.isConfirmed) return;

    try {
        const res = await fetch(`${apiBase}/api/eventos/teste-conexao`, { 
            method: 'POST', 
            headers: jsonHeaders, 
            body: JSON.stringify({ grupo_id: grupoId, botId: selectedBotIdForGrupos }) 
        });
        const d = await res.json();
        if (res.ok) {
            Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: '🤖 Teste enviado com sucesso!', showConfirmButton: false, timer: 4000, timerProgressBar: true, background: '#10b981', color: '#fff', iconColor: '#fff' });
        } else {
            Swal.fire({ toast: true, position: 'top-end', icon: 'error', title: d.erro || 'Falha no teste', showConfirmButton: false, timer: 5000, timerProgressBar: true, background: '#ef4444', color: '#fff', iconColor: '#fff' });
        }
    } catch(err) {
        Swal.fire({ toast: true, position: 'top-end', icon: 'error', title: 'Erro de conexão no teste', showConfirmButton: false, timer: 5000, timerProgressBar: true, background: '#ef4444', color: '#fff', iconColor: '#fff' });
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
    const handleGroupsCardClick = () => {
        setActiveTab('grupos');
    };

    // 1. Data for PieChart
    const pieData = [
      { name: 'Bodas', value: stats.totalBodas },
      { name: 'Aniversários', value: stats.totalAniversarios },
      { name: 'Outros', value: stats.totalEventos - stats.totalBodas - stats.totalAniversarios }
    ].filter(d => d.value > 0);
    const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444'];
    
    // 2. Data for Comparative LineChart (Events by Month)
    const monthData = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'].map(m => ({ name: m, Aniversários: 0, Casamentos: 0, Outros: 0 }));
    
    eventos.forEach(ev => {
        const m = new Date(ev.data_evento).getMonth();
        if(!isNaN(m)) {
             const t = (ev.tipo_evento || '').toLowerCase();
             if(t.includes('anivers')) monthData[m].Aniversários++;
             else if(t.includes('casament') || t.includes('boda')) monthData[m].Casamentos++;
             else monthData[m].Outros++;
        }
    });

    return (
    <>
      <div className={`stats-grid ${tutorialStep === 2 ? 'tutorial-highlight' : ''}`} id="step-stats">
        <div className="stat-card">
            <div className="stat-header">Eventos Totais<div className="stat-icon-wrapper bg-green-light">📈</div></div><div className="stat-value">{stats.totalEventos}</div>
        </div>
        <div className="stat-card" onClick={handleGroupsCardClick} style={{cursor:'pointer', position:'relative', zIndex: tutorialStep === 1 ? 1001 : 1}}>
          <div className="stat-header">Grupos Activos<div className="stat-icon-wrapper bg-green-light">💍</div></div>
          <div className="stat-value">{Object.keys(grupos).length > 0 ? grupos.filter(g => !g.isMuted).length : stats.gruposAtivos}</div>
        </div>
        <div className="stat-card" style={{position:'relative', zIndex: tutorialStep === 1 ? 1001 : 1}}>
            <div className="stat-header">Lembretes Enviados<div className="stat-icon-wrapper bg-yellow-light">🔔</div></div><div className="stat-value">{stats.lembretesEnviados}</div>
        </div>
        <div className="stat-card" onClick={() => { setActiveTab('logs'); setLogFilter('falha'); }} style={{cursor:'pointer', position:'relative', zIndex: tutorialStep === 1 ? 1001 : 1}}>
          <div className="stat-header">Falhas<div className="stat-icon-wrapper" style={{background:'#fee2e2'}}>⚠️</div></div>
          <div className="stat-value" style={{color: stats.falhasHoje > 0 ? '#dc2626':'#10b981'}}>{stats.falhasHoje}</div>
        </div>
      </div>
      
      {/* SECTION: GRÁFICOS COMPARATIVOS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem', marginBottom: '1.5rem' }}>
        <div className="panel-card" style={{ minHeight: '350px' }}>
          <div className="panel-title" style={{display:'flex', alignItems:'center', gap:'0.5rem'}}>📈 Evolução Comparativa <span className="text-muted" style={{fontWeight:400, fontSize:'0.7rem'}}>(Casamentos vs Aniversários)</span></div>
          <div style={{ width: '100%', height: 280, marginTop:'1rem' }}>
            <ResponsiveContainer>
              <LineChart data={monthData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 12, fill: 'var(--text-secondary)'}} />
                <YAxis axisLine={false} tickLine={false} tick={{fontSize: 12, fill: 'var(--text-secondary)'}} />
                <Tooltip 
                  cursor={{stroke: 'var(--border)', strokeWidth: 2}} 
                  contentStyle={{borderRadius: '12px', background:'var(--surface)', border: '1px solid var(--border)', color:'var(--text)', boxShadow: 'var(--shadow-md)'}} 
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '0.8rem', paddingTop: '10px' }} />
                <Line type="bump" dataKey="Aniversários" stroke="#3b82f6" strokeWidth={3} dot={{r:4, strokeWidth:2}} activeDot={{r: 6}} />
                <Line type="bump" dataKey="Casamentos" stroke="#10b981" strokeWidth={3} dot={{r:4, strokeWidth:2}} activeDot={{r: 6}} />
                <Line type="stepAfter" dataKey="Outros" stroke="#94a3b8" strokeWidth={2} dot={false} opacity={0.6}/>
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
        
        <div className="panel-card" style={{ minHeight: '350px' }}>
          <div className="panel-title" style={{display:'flex', alignItems:'center', gap:'0.5rem'}}>🍰 Mix de Eventos <span className="text-muted" style={{fontWeight:400, fontSize:'0.7rem'}}>(Por Categoria)</span></div>
          <div style={{ width: '100%', height: 280, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {stats.totalEventos === 0 ? <p className="text-muted">Sem dados disponíveis.</p> : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={70} outerRadius={95} paddingAngle={8} dataKey="value" stroke="none">
                    {pieData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{borderRadius: '12px', background:'var(--surface)', border: '1px solid var(--border)', color:'var(--text)', boxShadow: 'var(--shadow-md)'}} />
                  <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{fontSize: '12px', paddingTop:'1rem'}} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      <div className="middle-grid">
        <div className={`panel-card ${tutorialStep === 4 ? 'tutorial-highlight' : ''}`} style={{gap:'1rem'}} id="step-new-event">
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
                        .then(res => { if(res.ok) { fetchData(); refreshData(); setFormTipo(n.toLowerCase()); toast.success('Tipo criado!'); } });
                    }
                } else setFormTipo(e.target.value);
              }}>
                <option value="">-- Seleccione o Tipo --</option>
                <option value="casamento">💍 Casamento</option>
                <option value="aniversario">🎂 Aniversário</option>
                <option value="batizado">🕊️ Batizado</option>
                {tiposEvento.filter(t => !['casamento','aniversario','batizado'].includes(t.nome)).map(t => (
                  <option key={t.id} value={t.nome}>{t.nome.charAt(0).toUpperCase() + t.nome.slice(1)}</option>
                ))}
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

              <select className="inline-input" style={{flex:'0.2'}} value={formPrioridade} onChange={e=>setFormPrioridade(e.target.value)}>
                <option value="normal">⚪ Normal</option>
                <option value="urgente">🔴 Urgente</option>
              </select>

              <select className="inline-input" style={{flex:'0.25'}} value={formFrequencia} onChange={e=>setFormFrequencia(e.target.value)}>
                <option value="anual">📅 Anual</option>
                <option value="mensal">🔄 Mensal</option>
                <option value="semanal">📆 Semanal</option>
                <option value="diario">⏰ Diário</option>
              </select>
              <button type="submit" className="btn-submit" disabled={isSubmitting}>
              {isSubmitting ? '🔄 A Guardar...' : '+ Guardar'}
          </button>
            </form>
          ) : <div className="text-muted">Apenas admins/editores podem registar.</div>}
          <div className="panel-title" style={{marginTop:'1.5rem'}}>Últimos Registos</div>
          <div className="table-responsive">
            <table className="table-minimal">
                <thead><tr><th>Nomes</th><th>Tipo</th><th style={{textAlign:'right'}}>Data</th></tr></thead>
                <tbody>
                {dataLoading ? <tr><td colSpan="3">A carregar...</td></tr> : eventos.length === 0 ? <tr><td colSpan="3">Sem eventos.</td></tr> :
                    eventos.slice(0,5).map(ev => (
                    <tr key={ev.id}><td className="fw-bold">{ev.nomes_principais}</td><td><span className="badge-tipo">{ev.tipo_evento}</span></td><td style={{textAlign:'right'}}>{new Date(ev.data_evento).toLocaleDateString('pt-PT')}</td></tr>
                ))}
                </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
  };

  /* ========== RENDER: EVENTOS ========== */
  const renderEventos = () => {
    let filtered = eventos.filter(ev => 
      (ev.nomes_principais?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
      (ev.tipo_evento?.toLowerCase() || '').includes(searchQuery.toLowerCase())
    );

    // Aplicar filtros avançados se existirem
    if (filterGroup) {
        filtered = filtered.filter(ev => ev.grupo_id === filterGroup);
    }
    if (filterType) {
        filtered = filtered.filter(ev => ev.tipo_evento === filterType);
    }

    const currentFilterGroupName = grupos.find(g => g.id === filterGroup)?.nome;

    return (
    <div className="panel-card" style={{gap:'1rem'}}>
      <div className={`eventos-toolbar ${tutorialStep === 7 ? 'tutorial-highlight' : ''}`} id="step-export" style={{flexWrap:'wrap', gap:'1rem', display:'flex', alignItems:'center'}}>
        <div style={{display:'flex', alignItems:'center', gap:'1rem', flex:2, minWidth:'300px'}}>
            <div className="panel-title" style={{margin:0, whiteSpace:'nowrap'}}>📅 Listagem de Eventos</div>
            
            {/* NOVO: Busca exclusiva na aba Eventos */}
            <div className="search-bar-container" style={{flex:1, maxWidth:'400px'}}>
              <input 
                type="text" 
                className="search-bar" 
                placeholder="🔍 Buscar por nome, data ou tipo..." 
                value={searchQuery} 
                onChange={e=>setSearchQuery(e.target.value)} 
                style={{width:'100%', border:'1px solid var(--border)', borderRadius:'8px', padding:'0.6rem 1rem'}}
              />
            </div>

            {(filterGroup || filterType) && (
                <div style={{display:'flex', alignItems:'center', gap:'0.5rem', background:'var(--info)', color:'#fff', padding:'4px 12px', borderRadius:'20px', fontSize:'0.8rem', animation:'slideUp 0.3s ease'}}>
                    🔍 {filterType?.toUpperCase()} {filterGroup ? `em ${currentFilterGroupName}` : ''}
                    <button onClick={() => { setFilterGroup(null); setFilterType(null); }} style={{background:'none', border:'none', color:'#fff', cursor:'pointer', fontWeight:800, padding:'0 4px'}}>✕</button>
                </div>
            )}
        </div>
        <div className="toolbar-buttons" style={{flex:1, display:'flex', justifyContent:'flex-end'}}>
          <div className="flex-wrap-responsive">
            <button onClick={handleExportCSV} className="btn-submit" style={{background:'#1e293b'}}>📥 CSV</button>
            <button onClick={handleExportExcel} className="btn-submit" style={{background:'#047857'}}>📊 Excel</button>
            <button onClick={handleExportPDF} className="btn-submit" style={{background:'#be123c'}}>📄 PDF</button>
            {canEdit && (<>
                <input type="file" accept=".csv" ref={csvRef} onChange={handleImportCSV} style={{display:'none'}} />
                <button onClick={() => csvRef.current?.click()} className="btn-submit" style={{background:'#0f766e'}}>📤 Importar</button>
            </>)}
          </div>
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
            <option value="casamento">💍 Casamento</option>
            <option value="aniversario">🎂 Aniversário</option>
            <option value="batizado">🕊️ Batizado</option>
            {tiposEvento.filter(t => !['casamento','aniversario','batizado'].includes(t.nome)).map(t => (
              <option key={t.id} value={t.nome}>{t.nome.charAt(0).toUpperCase() + t.nome.slice(1)}</option>
            ))}
            <option value="__novo__">➕ Adicionar Novo...</option>
          </select>

          <input 
            type="text" 
            className="inline-input" 
            placeholder={
                formTipo === 'casamento' ? "Nomes do Casal (Ex: João & Maria)" :
                formTipo === 'aniversario' ? "Nome do Aniversariante" :
                formTipo === 'batizado' ? "Nome da Criança" :
                formTipo ? `Nome para ${formTipo}` : "Selecione o tipo primeiro..."
            } 
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
          <select className="inline-input" style={{flex:'0.2'}} value={formPrioridade} onChange={e=>setFormPrioridade(e.target.value)}>
            <option value="normal">⚪ Normal</option>
            <option value="urgente">🔴 Urgente</option>
          </select>
          <button type="submit" className="btn-submit" disabled={isSubmitting}>
              {isSubmitting ? '🔄 A Guardar...' : '+ Guardar'}
          </button>
        </form>
      )}
      <div className="table-responsive">
        <table className="table-minimal" style={{marginTop:'1rem'}}>
          <thead><tr><th>Nomes</th><th>Data</th><th>Tipo</th><th>Freq.</th><th>Grupo</th><th>Foto</th><th>Gestão</th></tr></thead>
          <tbody>
            {dataLoading ? (
                <tr><td colSpan="7" style={{textAlign:'center', padding:'2rem'}}>A carregar eventos...</td></tr>
            ) : filtered.length === 0 ? (
                <tr><td colSpan="7" style={{textAlign:'center', padding:'3rem'}}>
                    <div style={{fontSize:'2rem', marginBottom:'0.5rem'}}>🔎</div>
                    <p className="text-muted">Nenhum evento encontrado para este filtro.</p>
                    {(filterGroup || filterType) && <button onClick={() => { setFilterGroup(null); setFilterType(null); }} className="btn-mini" style={{marginTop:'1rem', background:'var(--info)', color:'white', padding:'5px 15px'}}>Ver Todos os Eventos</button>}
                </td></tr>
            ) : filtered.map(ev => (
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
                        src={`${apiBase}/api/imagem-evento/${ev.id}`}
                        alt="Foto"
                        title="Clique para ampliar"
                        onClick={() => window.open(`${apiBase}/api/imagem-evento/${ev.id}`, '_blank')}
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
};

/* ========== RENDER: MULTI-BOT MANAGEMENT ========== */
const renderMultiBot = () => {
    const handleEditBot = async (bot) => {
        const { value: formValues } = await Swal.fire({
            title: 'Editar Bot: ' + bot.nome,
            html:
              `<input id="swal-input-edit1" class="swal2-input" placeholder="Nome" value="${bot.nome}">` +
              `<p style="font-size:0.8rem; margin-top:1rem;">Categorias permitidas (separadas por vírgula):</p>` +
              `<input id="swal-input-edit2" class="swal2-input" placeholder="casamento, aniversario" value="${bot.tipos_permitidos?.join(', ') || ''}">`,
            focusConfirm: false,
            preConfirm: () => {
              return [
                document.getElementById('swal-input-edit1').value,
                document.getElementById('swal-input-edit2').value
              ]
            }
        });

        if (formValues && formValues[0]) {
            try {
                const tipos = formValues[1].split(',').map(s => s.trim().toLowerCase()).filter(s => s !== '');
                const res = await fetch(`${apiBase}/api/eventos/bots/${bot.id}`, {
                    method: 'PUT',
                    headers: jsonHeaders,
                    body: JSON.stringify({ nome: formValues[0], tipos_permitidos: tipos })
                });
                if (res.ok) {
                    Swal.fire('Sucesso', 'Configurações salvas!', 'success');
                    fetchData();
                }
            } catch (e) { console.error(e); }
        }
    };

    const handleAddBot = async () => {
        const { value: formValues } = await Swal.fire({
            title: 'Configurar Novo Bot',
            html:
              '<input id="swal-input1" class="swal2-input" placeholder="Nome do Bot (ex: Bot Vendas)">' +
              '<p style="font-size:0.8rem; margin-top:1rem;">Categorias permitidas (separadas por vírgula):</p>' +
              '<input id="swal-input2" class="swal2-input" placeholder="casamento, aniversario">',
            focusConfirm: false,
            preConfirm: () => {
              return [
                document.getElementById('swal-input1').value,
                document.getElementById('swal-input2').value
              ]
            }
        });

        if (formValues && formValues[0]) {
            try {
                const tipos = formValues[1].split(',').map(s => s.trim().toLowerCase()).filter(s => s !== '');
                const res = await fetch(`${apiBase}/api/eventos/bots`, {
                    method: 'POST',
                    headers: jsonHeaders,
                    body: JSON.stringify({ nome: formValues[0], tipos_permitidos: tipos })
                });
                if (res.ok) {
                    Swal.fire('Sucesso', 'Bot instanciado! Aguarda o QR Code nos cartões.', 'success');
                    fetchData();
                }
            } catch (e) { 
                Swal.fire({ toast: true, position: 'top-end', icon: 'error', title: 'Erro ao criar bot', showConfirmButton: false, timer: 10000, timerProgressBar: true, background: '#ef4444', color: '#fff', iconColor: '#fff' });
            }
        }
    };

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:'1rem'}}>
            <h2 style={{margin:0, fontSize:'1.5rem'}}>🔌 Gestão Multi-Bot</h2>
            {isAdmin && <button onClick={handleAddBot} className="btn-submit" style={{width:'auto', padding:'0.5rem 1rem', fontSize:'0.85rem', background:'var(--primary)', border:'none', borderRadius:'8px', fontWeight:600}}>➕ Novo Bot</button>}
        </div>

        <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(320px, 1fr))', gap:'1.5rem'}}>
            {bots.length === 0 ? (
                <div className="panel-card" style={{textAlign:'center', padding:'3rem'}}>
                    <p className="text-muted">Nenhum bot configurado. Clica em "Novo Bot" para começar.</p>
                </div>
            ) : bots.map(bot => (
                <div key={bot.id} className="panel-card" style={{borderLeft:`5px solid ${bot.status === 'conectado' ? '#10b981' : '#f59e0b'}`}}>
                    <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'1rem'}}>
                        <div>
                            <h3 style={{margin:0}}>{bot.nome}</h3>
                            <span className="badge-tipo" style={{fontSize:'0.7rem', background: bot.status==='conectado' ? '#dcfce7':'#fef3c7', color: bot.status==='conectado' ? '#166534':'#92400e'}}>
                                ● {bot.status?.toUpperCase()}
                            </span>
                        </div>
                        <div style={{display:'flex', gap:'0.5rem'}}>
                            <button onClick={() => handleEditBot(bot)} className="btn-action" style={{background:'#f1f5f9', border:'none', padding:'4px 8px', borderRadius:'6px', cursor:'pointer'}} title="Editar">✏️</button>
                            <button onClick={async () => {
                                if (await Swal.fire({title:'Remover Bot?', text:'A sessão será destruída permanentemente.', icon:'warning', showCancelButton:true, confirmButtonColor:'#ef4444'}).then(r=>r.isConfirmed)) {
                                    await fetch(`${apiBase}/api/eventos/bots/${bot.id}`, { method: 'DELETE', headers });
                                    fetchData();
                                }
                            }} className="btn-action" style={{background:'transparent', border:'none', cursor:'pointer', color:'#ef4444', fontSize:'1.1rem'}} title="Apagar">🗑️</button>
                        </div>
                    </div>
                    
                    <p style={{fontSize:'0.8rem', color:'var(--text-secondary)'}}>
                        🎯 Categorias: <b>{bot.tipos_permitidos?.join(', ') || 'Todas'}</b>
                    </p>

                    {bot.status === 'aguardando_qr' && bot.qr ? (
                        <div style={{textAlign:'center', marginTop:'1rem', background:'#fff', padding:'1rem', borderRadius:'12px', border:'1px solid var(--border)'}}>
                            <img src={bot.qr} alt="QR Code" style={{width:'180px', height:'180px'}} />
                            <p style={{fontSize:'0.75rem', marginTop:'0.5rem'}}>Lê com o teu WhatsApp</p>
                        </div>
                    ) : bot.status === 'conectado' ? (
                        <div style={{display:'flex', flexDirection:'column', gap:'0.75rem', marginTop:'1.5rem'}}>
                            <div style={{textAlign:'center', color:'#10b981', background:'#dcfce7', padding:'1rem', borderRadius:'12px', fontWeight:600}}>
                                🚀 Bot em Operação!
                            </div>
                            <button onClick={async () => {
                                if (await Swal.fire({title:'Desconectar Bot?', text:'Isto encerrará a sessão do WhatsApp sem remover o bot do sistema.', icon:'warning', showCancelButton:true, confirmButtonColor:'#ef4444'}).then(r=>r.isConfirmed)) {
                                    try {
                                        await fetch(`${apiBase}/api/eventos/bots/${bot.id}/desconectar`, { method: 'POST', headers });
                                        Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Desconectado com sucesso!', showConfirmButton: false, timer: 4000, timerProgressBar: true, background: '#ef4444', color: '#fff' });
                                        fetchData();
                                    } catch (e) {
                                        Swal.fire('Erro', 'Falha ao desconectar bot.', 'error');
                                    }
                                }
                            }} className="btn-submit" style={{background:'#fee2e2', color:'#b91c1c', border:'1px solid #fecaca', fontSize:'0.85rem', padding:'0.6rem'}}>
                                📴 Desconectar Bot
                            </button>
                        </div>
                    ) : (
                        <div style={{display:'flex', flexDirection:'column', gap:'0.75rem', marginTop:'1.5rem'}}>
                            <button onClick={async () => {
                                await fetch(`${apiBase}/api/eventos/bots/${bot.id}/reconectar`, { method: 'POST', headers });
                                Swal.fire({ toast: true, position: 'top-end', icon: 'info', title: 'A gerar novo QR...', showConfirmButton: false, timer: 6000, timerProgressBar: true, background: '#3b82f6', color: '#fff', iconColor: '#fff' });
                                fetchData();
                            }} className="btn-submit" style={{background:'#f8fafc', color:'#475569', border:'1px solid var(--border)'}}>
                                🔄 Gerar QR Code
                            </button>
                            <button onClick={async () => {
                                if (await Swal.fire({title:'Desconectar Bot?', text:'Isto encerrará a sessão se estiver aberta.', icon:'warning', showCancelButton:true}).then(r=>r.isConfirmed)) {
                                    await fetch(`${apiBase}/api/eventos/bots/${bot.id}/desconectar`, { method: 'POST', headers });
                                    fetchData();
                                }
                            }} className="btn-submit" style={{background:'transparent', color:'#ef4444', border:'1px solid #fee2e2', fontSize:'0.8rem'}}>
                                Desconectar Sessão
                            </button>
                        </div>
                    )}
                </div>
            ))}
        </div>

        <div className="panel-card">
          <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1rem', flexWrap:'wrap', gap:'1rem'}}>
            <div className="panel-title" style={{margin:0}}>📋 Grupos de WhatsApp</div>
            <select className="inline-input" style={{width:'auto', minWidth:'200px'}} value={selectedBotIdForGrupos} onChange={(e) => {
                setSelectedBotIdForGrupos(e.target.value);
                refreshGrupos(e.target.value);
            }}>
                <option value="">Seleciona o Bot...</option>
                {bots.filter(b=>b.status==='conectado').map(b=><option key={b.id} value={b.id}>{b.nome}</option>)}
            </select>
          </div>
          {/* ... continuação da tabela de grupos ... */}
        <div className={`panel-card ${tutorialStep === 4 ? 'tutorial-highlight' : ''}`} id="step-groups-list">
          <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1rem', flexWrap:'wrap', gap:'1rem'}}>
            <div className="panel-title" style={{margin:0}}>📋 Lista de Grupos Participados</div>
            <button onClick={refreshGrupos} className="btn-submit" disabled={gruposLoading} style={{width:'auto', padding:'0.5rem 1.2rem', fontSize:'0.85rem', display:'inline-flex', alignItems:'center', gap:'0.5rem'}}>
              {gruposLoading ? 'A carregar...' : '🔄 Atualizar Lista'}
            </button>
          </div>
        </div>
        <p className="text-muted" style={{marginBottom:'1rem'}}>Estes são todos os grupos onde o bot está presente. Seleccione um grupo ao criar eventos para definir onde o lembrete será enviado.</p>
      
      {gruposLoading ? (
        <div style={{textAlign:'center', padding:'3rem'}}>
            <div style={{animation:'spin 1s linear infinite', border:'3px solid var(--border)', borderTopColor:'var(--accent)', borderRadius:'50%', width:'30px', height:'30px', margin:'0 auto 1rem'}}></div>
            <p>A sincronizar grupos do WhatsApp...</p>
        </div>
      ) : grupos.length === 0 ? <p className="text-muted">Nenhum grupo encontrado. O bot pode estar offline.</p> : (
        <div className="table-responsive">
          <table className="table-minimal">
            <thead><tr><th>Status</th><th>Nome do Grupo</th><th>Membros</th><th>Categorias</th><th>Ações</th></tr></thead>
            <tbody>
              {grupos.map(g => {
                // Encontrar tipos únicos de eventos associados a este grupo
                const tiposNoGrupo = [...new Set(eventos.filter(ev => ev.grupo_id === g.id).map(ev => ev.tipo_evento))];
                
                return (
                <tr key={g.id}>
                  <td>
                    <span style={{
                        display:'inline-flex', padding:'3px 8px', borderRadius:'12px', fontSize:'0.65rem', fontWeight:800,
                        background: (g.isMuted ? '#fecaca' : '#dcfce7'),
                        color: (g.isMuted ? '#b91c1c' : '#15803d')
                    }}>
                        {g.isMuted ? '📵 DESCONECTADO' : '🟢 ATIVO'}
                    </span>
                  </td>
                  <td className="fw-bold" style={{fontSize:'0.95rem'}}>{g.nome}</td>
                  <td>
                    <div style={{display:'flex', alignItems:'center', gap:'4px'}}>
                        <span style={{fontSize:'0.8rem'}}>👥</span> {g.participantes}
                    </div>
                  </td>
                  <td>
                    <div style={{display:'flex', flexWrap:'wrap', gap:'4px'}}>
                        {tiposNoGrupo.length === 0 ? <span className="text-muted" style={{fontSize:'0.7rem'}}>Nenhuma</span> : tiposNoGrupo.map(t => (
                            <span 
                                key={t} 
                                onClick={() => {
                                    setSearchQuery(''); // Limpar busca global para não conflitar
                                    setFilterGroup(g.id);
                                    setFilterType(t);
                                    setActiveTab('eventos');
                                    toast.info(`A filtrar ${t.toUpperCase()} em ${g.nome}`, { autoClose: 3000 });
                                }}
                                title="Clique para ver estes eventos"
                                style={{
                                    fontSize:'0.65rem', padding:'2px 6px', borderRadius:'4px', fontWeight:600, cursor:'pointer',
                                    background: tiposEvento.find(te => te.nome === t)?.cor + '22' || '#f1f5f9',
                                    color: tiposEvento.find(te => te.nome === t)?.cor || '#64748b',
                                    border: `1px solid ${tiposEvento.find(te => te.nome === t)?.cor || '#e2e8f0'}`,
                                    transition: 'transform 0.2s'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.1)'}
                                onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                            >
                                {t.toUpperCase()}
                            </span>
                        ))}
                    </div>
                  </td>
                  <td>
                    <div className="toolbar-buttons" style={{justifyContent:'flex-end'}}>
                      {canEdit && (
                        <>
                          <button 
                            onClick={async () => {
                                const isNowMuted = !g.isMuted;
                                if (isNowMuted) setMutedGroups(prev => [...prev, g.id]);
                                else setMutedGroups(prev => prev.filter(id => id !== g.id));

                                try {
                                    await fetch(`${apiBase}/api/auth/grupos/toggle-mute`, {
                                        method: 'POST',
                                        headers: jsonHeaders,
                                        body: JSON.stringify({ grupo_id: g.id, nome: g.nome, is_muted: isNowMuted })
                                    });
                                    refreshData(); 
                                } catch (e) {
                                    console.error('Erro ao sincronizar mute:', e);
                                }

                                Swal.fire({
                                    toast: true,
                                    position: 'top-end',
                                    icon: 'success',
                                    title: `Grupo ${isNowMuted ? 'Desconectado 📵' : 'Reativado 🔌'}!`,
                                    showConfirmButton: false,
                                    timer: 3000,
                                    timerProgressBar: true,
                                    background: isNowMuted ? '#ef4444' : '#10b981',
                                    color: '#fff'
                                });
                            }} 
                            className="btn-submit" 
                            style={{padding:'0.4rem 1rem', fontSize:'0.8rem', background: g.isMuted ? '#10b981' : '#ef4444', width:'auto'}}
                          >
                            {g.isMuted ? '🔌 Conectar' : '📵 Desconectar'}
                          </button>
                          
                          <button onClick={() => {
                            const copiar = (texto) => {
                              navigator.clipboard.writeText(texto).then(() => {
                                Swal.fire({
                                    toast: true,
                                    position: 'top-end',
                                    icon: 'success',
                                    title: '📋 ID Copiado!',
                                    showConfirmButton: false,
                                    timer: 4000,
                                    timerProgressBar: true,
                                    background: '#475569',
                                    color: '#fff',
                                    iconColor: '#fff'
                                });
                              });
                            };
                            copiar(g.id);
                          }} className="btn-submit" style={{padding:'0.3rem 0.6rem',fontSize:'0.75rem',background:'#475569'}}>📋 ID</button>
                        </>
                      )}
                      {isAdmin && <button onClick={()=>handleTesteConexao(g.id, g.nome)} className="btn-submit" style={{padding:'0.4rem 1rem', fontSize:'0.8rem', background:'var(--info)', width:'auto'}}>🤖 Testar</button>}
                    </div>
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      </div>
    </div>
  );
};

  /* ========== RENDER: HISTÓRICO (LOGS) ========== */
  const renderLogs = () => {
    const filteredLogs = logFilter === 'todos' ? logs : 
                         logFilter === 'falha' ? logs.filter(l => l.status === 'falha') :
                         logs.filter(l => l.tipo_log === logFilter);
    return (
      <div className="panel-card">
        <div className="audit-toolbar" style={{display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', marginBottom:'1rem'}}>
          <div className="panel-title" style={{margin:0}}>📖 Histórico de Interações (Audit)</div>
          <div className="audit-controls" style={{display:'flex', gap:'0.5rem'}}>
            <select className="inline-input" value={logFilter} onChange={e=>setLogFilter(e.target.value)} style={{margin:0, width:'200px'}}>
              <option value="todos">🔍 Todos os Eventos</option>
              <option value="falha">🚨 Falhas Críticas ({stats.falhasHoje})</option>
              <option value="lembrete_enviado">✅ Lembretes Enviados</option>
              <option value="auto_resposta">🤖 Respostas Automáticas</option>
              <option value="registo_whatsapp">📱 Criação via Bot</option>
              <option value="config_grupo">⚙️ Gestão de Grupos</option>
              <option value="erro_registo">⚠️ Erros do Bot</option>
              <option value="lembrete_falha">❌ Falhas de Envio</option>
            </select>
            <button className="btn-submit" onClick={handleRefreshLogs} style={{margin:0}}>🔄 Atualizar</button>
            {isAdmin && (
                <button className="btn-submit" onClick={handleClearLogs} style={{margin:0, background:'#ef4444'}}>🗑️ Limpar Tudo</button>
            )}
          </div>
        </div>
        
        <p className="text-muted" style={{fontSize:'0.85rem', marginBottom:'1rem'}}>Histórico detalhado de tudo o que o bot disparou, ouviu ou reportou.</p>
        
        <div className="table-responsive">
          <table className="table-minimal">
            <thead><tr><th>Data/Hora</th><th>Natureza</th><th>Status</th><th>Detalhes / Mensagem Trocada</th><th>Destinatário</th><th>Ações</th></tr></thead>
            <tbody>
              {filteredLogs.length === 0 ? <tr><td colSpan="6">Nenhum registo encontrado para este filtro.</td></tr> : filteredLogs.map(l => (
                <tr key={l.id}>
                  <td className="text-small" style={{whiteSpace:'nowrap', color:'#475569'}}>{new Date(l.criado_em).toLocaleString('pt-PT')}</td>
                  <td>
                    <span style={{
                      fontSize:'0.75rem', padding:'0.2rem 0.5rem', borderRadius:'6px', fontWeight:600,
                      background: l.tipo_log === 'auto_resposta' ? '#e0e7ff' : l.tipo_log === 'lembrete_enviado' ? '#dcfce7' : l.tipo_log === 'config_grupo' ? '#fef9c3' : '#f1f5f9',
                      color: l.tipo_log === 'auto_resposta' ? '#4f46e5' : l.tipo_log === 'lembrete_enviado' ? '#16a34a' : l.tipo_log === 'config_grupo' ? '#854d0e' : '#475569'
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
                  <td>
                    <button 
                        className="btn-action" 
                        onClick={() => handleDeleteLog(l.id)}
                        style={{background:'transparent', border:'none', cursor:'pointer', color:'#ef4444', fontSize:'1.1rem'}}
                        title="Apagar este registo"
                    >
                      🗑️
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  /* ========== RENDER: COMPONENTES (LIMPO) ========== */
  /* Fim da Secção Limpa */

  /* ========== RENDER: CALENDÁRIO INTERATIVO ========== */
  const renderCalendario = () => {
    const mesesPT = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
    const diasSemana = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
    // Criar mapeamento dinâmico de cores baseado nos tipos existentes
    const coresEvento = tiposEvento.reduce((acc, t) => ({ ...acc, [t.nome]: t.cor }), { 
      casamento:'#3b82f6', aniversario:'#10b981', batizado:'#8b5cf6' 
    });
    
    const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
    const firstWeekDay = new Date(calYear, calMonth, 1).getDay();
    
    // Eventos do mês (aniversario anual - mesmo dia e mês)
    const getEventosForDay = (day) => eventos.filter(ev => {
      // 1. Filtro de Segurança para Leitores (se não for admin/editor, tem restrições)
      if (!canEdit) {
         const tipoPermitido = user.tipos_permitidos?.includes(ev.tipo_evento);
         const grupoPermitido = user.grupos_permitidos?.includes(ev.grupo_id);
         if (!tipoPermitido || !grupoPermitido) return false;
      }

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
        <div className={`panel-card sync-container ${tutorialStep === 6 ? 'tutorial-highlight' : ''}`} id="step-calendar-sync" style={{display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:'1rem'}}>
          <div>
            <h3 style={{margin:'0 0 0.5rem 0', display:'flex', alignItems:'center', gap:'0.5rem'}}>📅 Sincronização Google Calendar / Apple</h3>
            <p className="text-muted" style={{margin:0, fontSize:'0.85rem'}}>Adicione este link à sua aplicação de calendário para ver todos os eventos do CRM lá.</p>
          </div>
          <div className="sync-controls" style={{display:'flex', gap:'0.5rem', flex:'1', minWidth:'300px'}}>
            <input type="text" readOnly value={`${apiBase}/api/eventos/feed.ics`} className="inline-input" style={{flex:1, background:'#f8fafc', minWidth:'100%'}} />
            <div style={{display:'flex', gap:'0.5rem', width:'100%'}}>
                <button onClick={() => { navigator.clipboard.writeText(`${apiBase}/api/eventos/feed.ics`); Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: '📋 Link copiado!', showConfirmButton: false, timer: 3000, timerProgressBar: true, background: '#10b981', color: '#fff', iconColor: '#fff' }); }} className="btn-submit" style={{flex:1}}>📋 Copiar</button>
                <a href={`${apiBase}/api/eventos/feed.ics`} target="_blank" rel="noreferrer" className="btn-submit" style={{background:'#2563eb', textDecoration:'none', color:'#fff', flex:1, textAlign:'center'}}>📥 Baixar</a>
            </div>
          </div>
        </div>

        <div style={{display:'flex', gap:'1.5rem', flexWrap:'wrap', alignItems:'flex-start'}}>
        <div className={`panel-card ${tutorialStep === 7 ? 'tutorial-highlight' : ''}`} id="step-calendar-grid" style={{flex:'1', minWidth:'320px'}}>
          {/* Header do calendário */}
          <div className="cal-nav" style={{display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'1rem'}}>
            <button onClick={prevMonth} className="cal-btn-nav-isolated">&#8249;</button>
            <div className="panel-title cal-nav-title" style={{margin:0}}>{mesesPT[calMonth]} {calYear}</div>
            <button onClick={nextMonth} className="cal-btn-nav-isolated">&#8250;</button>
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
                  {ev.foto_url && <img src={`${apiBase}/api/imagem-evento/${ev.id}`} alt="" style={{width:'42px', height:'42px', borderRadius:'50%', objectFit:'cover', border:'2px solid #fff', boxShadow:'0 2px 4px rgba(0,0,0,0.1)'}} />}
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
            {['casamento','aniversario','batizado'].map(tipo => {
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

  const renderBodaGlossary = () => {
    const list = {
        1: { n: "Papel", s: "Simboliza a fragilidade e a flexibilidade do início da relação." },
        2: { n: "Algodão", s: "Representa o conforto e a suavidade de dois anos de convivência." },
        3: { n: "Couro", s: "Simboliza a resistência e a durabilidade que o casal está a construir." },
        4: { n: "Flores e Frutas", s: "Indica a vitalidade e a doçura da união que está a florescer." },
        5: { n: "Madeira", s: "Representa raízes fortes e um crescimento sólido." },
        6: { n: "Açúcar ou Perfume", s: "Celebra o aroma doce e a essência suave da vida a dois." },
        7: { n: "Lã ou Latão", s: "Simboliza o calor que protege o lar e a resistência dos laços." },
        8: { n: "Barro ou Papoula", s: "Representa a fertilidade e a união que ganha forma com o tempo." },
        9: { n: "Cerâmica ou Vime", s: "Indica a arte de moldar a convivência com paciência e dedicação." },
        10: { n: "Estanho ou Zinco", s: "Simboliza a maleabilidade necessária para manter a união por uma década." },
        11: { n: "Aço", s: "Representa uma união que se tornou inquebrável sob pressão." },
        12: { n: "Seda ou Ônix", s: "Simboliza a suavidade, a sofisticação e a proteção mútua." },
        13: { n: "Renda", s: "Representa a delicadeza e a transparência de 13 anos de história." },
        14: { n: "Marfim", s: "Um símbolo de nobreza e da força acumulada ao longo dos anos." },
        15: { n: "Cristal", s: "Representa a transparência, confiança e clareza da relação." },
        16: { n: "Turmalina", s: "Simboliza a vitalidade e a pedra que revigora as energias do casal." },
        17: { n: "Rosa", s: "A celebração do amor que continua a florescer e a exalar perfume." },
        18: { n: "Turquesa", s: "Símbolo de tranquilidade e o azul profundo da união serena." },
        19: { n: "Cretone", s: "Representa a força de um tecido resistente que une as partes." },
        20: { n: "Porcelana", s: "Simboliza a beleza e o cuidado necessário para manter a união preciosa." },
        21: { n: "Zircão", s: "Representa o brilho e a resistência que o tempo lapidou." },
        22: { n: "Louça", s: "Símbolo da utilidade e da arte de servir um ao outro diariamente." },
        23: { n: "Palha", s: "Representa a construção paciente de um ninho seguro e acolhedor." },
        24: { n: "Opala", s: "Simboliza a variedade de cores e emoções vividas em quase 25 anos." },
        25: { n: "Prata", s: "Um marco de brilho e resistência após um quarto de século." },
        26: { n: "Alexandrita", s: "Representa a transformação e a adaptação constante do casal." },
        27: { n: "Crisoprásio", s: "Simboliza a fidelidade e a esperança que nunca desvanecem." },
        28: { n: "Hematita", s: "Representa a força do sangue e o vigor da vida partilhada." },
        29: { n: "Erva", s: "Simboliza a renovação constante e a vida que brota do cuidado." },
        30: { n: "Pérola", s: "Representa algo precioso construído camada por camada ao longo do tempo." },
        31: { n: "Nácar", s: "A substância que protege a pérola, simbolizando proteção mútua." },
        32: { n: "Pinho", s: "Representa a imortalidade do amor e a resistência aos invernos." },
        33: { n: "Crizo", s: "Simboliza o valor espiritual e a pureza da vossa caminhada." },
        34: { n: "Oliveira", s: "O símbolo da paz e da longevidade que colhem hoje." },
        35: { n: "Coral", s: "Representa o amadurecimento e a beleza das profundezas marinhas." },
        36: { n: "Cedro", s: "Simboliza a dignidade e a força de uma árvore milenar." },
        37: { n: "Aventurira", s: "Representa a sorte de se terem encontrado e a aventura contínua." },
        38: { n: "Carvalho", s: "A árvore da sabedoria e da resistência inabalável." },
        39: { n: "Mármore", s: "Simboliza a polidez e a estabilidade da vossa estrutura familiar." },
        40: { n: "Esmeralda", s: "Simboliza o amor incondicional e a paciência eterna." },
        41: { n: "Seda", s: "Volta ao toque suave, agora com a força de quatro décadas." },
        42: { n: "Prata Dourada", s: "A combinação do valor da prata com o nobre brilho do ouro." },
        43: { n: "Azevinho", s: "Símbolo de proteção e de um amor que brilha mesmo no inverno." },
        44: { n: "Carbonato", s: "Representa a cristalização final de uma vida em comum." },
        45: { n: "Rubi", s: "A cor da paixão que permanece viva e ardente após décadas." },
        46: { n: "Alabastro", s: "Simboliza a pureza e a luz que emana de uma vida bem vivida." },
        47: { n: "Jaspe", s: "Representa a alegria, a coragem e o conforto espiritual." },
        48: { n: "Feldspato", s: "Símbolo da criatividade e da renovação espiritual do casal." },
        49: { n: "Heliotrópio", s: "Representa o foco no sol e na luz que guia o vosso caminho." },
        50: { n: "Ouro", s: "O metal mais precioso para celebrar uma vida inteira de partilha." },
        51: { n: "Bronze", s: "Simboliza a liga inseparável de dois metais que se tornaram um só." },
        52: { n: "Argila", s: "A terra que vos sustenta e a capacidade de se moldarem sempre." },
        53: { n: "Antimônio", s: "Simboliza a proteção contra as adversidades externas." },
        54: { n: "Níquel", s: "Representa a resistência à corrosão e ao desgaste do tempo." },
        55: { n: "Ametista", s: "Símbolo da paz, da espiritualidade e da sobriedade emocional." },
        56: { n: "Malaquita", s: "Representa o progresso e a cura através do amor mútuo." },
        57: { n: "Lápis Lazúli", s: "Simboliza a verdade, a sabedoria e a união celestial." },
        58: { n: "Vidro", s: "Representa a transparência total e a luz que atravessa o vosso lar." },
        59: { n: "Cereja", s: "Simboliza a doçura e a colheita dos frutos de uma vida longa." },
        60: { n: "Diamante", s: "Representa a indestrutibilidade absoluta da vossa união." },
        61: { n: "Cobre", s: "Simboliza a condutividade do amor e o brilho avermelhado da vida." },
        62: { n: "Telurita", s: "Representa a ligação profunda com a terra e as origens." },
        63: { n: "Sândalo", s: "O perfume que resiste ao tempo e acalma a alma." },
        64: { n: "Fabulita", s: "A celebração de uma história que parece uma fábula real." },
        65: { n: "Platina", s: "O metal mais raro e nobre para celebrar a raridade do vosso amor." },
        66: { n: "Ébano", s: "Representa a profundidade e a resistência de uma base escura e sólida." },
        67: { n: "Neve", s: "Simboliza a pureza absoluta e o silêncio respeitoso de décadas." },
        68: { n: "Chumbo", s: "Representa a densidade e o peso de uma história inamovível." },
        69: { n: "Mercúrio", s: "Simboliza a fluidez e a capacidade de se adaptarem a tudo." },
        70: { n: "Vinho", s: "Representa uma união que envelheceu com dignidade e se tornou melhor." },
        71: { n: "Zinco", s: "Proteção constante contra qualquer sinal de desgaste." },
        72: { n: "Aveia", s: "Símbolo da nutrição e do sustento que deram um ao outro." },
        73: { n: "Cafu", s: "Representa a raridade e o valor de uma caminhada única." },
        74: { n: "Maçã", s: "Simboliza a vitalidade e a saúde de um amor que nutre." },
        75: { n: "Brilhante", s: "A luz máxima que emana de 75 anos de transparência e amor." },
        76: { n: "Cipreste", s: "Simboliza a imortalidade e a glória de uma vida honrada." },
        77: { n: "Alfazema", s: "O aroma da tranquilidade e da harmonia plena." },
        78: { n: "Benjoim", s: "Representa a proteção espiritual e o perfume sagrado do lar." },
        79: { n: "Café", s: "A energia e o calor matinal que sustentam a vossa jornada." },
        80: { n: "Carvalho", s: "A força inabalável que resiste a todos os ventos da história." },
        81: { n: "Manjerona", s: "Simboliza a alegria, o conforto e o bem-estar duradouro." },
        82: { n: "Salvia", s: "Representa a saúde, a longevidade e a sabedoria acumulada." },
        83: { n: "Resina", s: "A substância que une e cura, mantendo tudo coeso e forte." },
        84: { n: "Hortênsia", s: "Simboliza a gratidão por serem compreendidos e amados." },
        85: { n: "Girassol", s: "Foco total na luz e na positividade após 85 anos juntos." },
        86: { n: "Hortelã", s: "Representa o frescor e a renovação dos sentimentos." },
        87: { n: "Cássia", s: "Simboliza a proteção divina e o aroma da retidão." },
        88: { n: "Estrela-do-mar", s: "Representa a regeneração e a capacidade de se renovar." },
        89: { n: "Álamo", s: "A árvore que sussurra segredos de paz e proteção." },
        90: { n: "Diamante Negro", s: "A raridade extrema e o mistério de uma união quase centenária." },
        91: { n: "Pinheiro", s: "Simboliza o crescimento eterno e a esperança que nunca morre." },
        92: { n: "Salgueiro", s: "Representa a flexibilidade e a resiliência perante as marés da vida." },
        93: { n: "Figueira", s: "Símbolo da prosperidade e do fruto doce da vossa descendência." },
        94: { n: "Palmeira", s: "Representa a vitória e a glória de quem atravessou o deserto unido." },
        95: { n: "Sândalo", s: "O aroma sagrado que marca o fim de um século de história." },
        96: { n: "Oliveira", s: "A confirmação da paz eterna e da sabedoria plena." },
        97: { n: "Abeto", s: "Símbolo da elevação espiritual e da vida que sempre se renova." },
        98: { n: "Pinheiro", s: "A resistência final antes do grande marco centenário." },
        99: { n: "Pinheiro", s: "A contagem final para um século de amor indestrutível." },
        100: { n: "Jequitibá ou Ossos", s: "Simboliza a eternidade absoluta, a imortalidade e a força indestrutível da vossa alma gémea." }
    };
    return (
        <div style={{marginTop:'1.5rem', background:'#fff', padding:'1rem', borderRadius:'12px', border:'1px solid #e2e8f0'}}>
            <details>
                <summary style={{fontWeight:700, cursor:'pointer', color:'#1e293b', fontSize:'0.9rem'}}>📚 Ver Dicionário de Bodas & Significados</summary>
                <div style={{marginTop:'1rem', maxHeight:'250px', overflowY:'auto'}}>
                    <table className="table-minimal" style={{fontSize:'0.75rem'}}>
                        <thead><tr><th>Ano</th><th>Boda</th><th>Significado</th></tr></thead>
                        <tbody>
                            {Object.entries(list).map(([ano, info]) => (
                                <tr key={ano}>
                                    <td style={{fontWeight:700}}>{ano}</td>
                                    <td><span className="badge-tipo" style={{background:'#ebf5ff', color:'#3b82f6', border:'1px solid #3b82f6'}}>{info.n.toUpperCase()}</span></td>
                                    <td className="text-muted">{info.s}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </details>
        </div>
    );
  };

  const renderConfig = () => {
    const subTabStyle = (active) => ({
        padding: '0.8rem 1.5rem',
        cursor: 'pointer',
        borderBottom: active ? '3px solid var(--primary)' : '3px solid transparent',
        color: active ? 'var(--primary)' : 'var(--text-secondary)',
        fontWeight: active ? 700 : 500,
        fontSize: '0.9rem',
        transition: '0.3s',
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        whiteSpace: 'nowrap'
    });

    return (
      <div style={{display:'flex', flexDirection:'column', gap:'1.5rem'}}>
        {/* SUB-NAVEGAÇÃO INTERNA */}
        <div style={{display:'flex', borderBottom:'1px solid var(--border)', background:'var(--surface)', borderRadius:'12px', padding:'0 1rem', overflowX:'auto', gap:'1rem'}}>
            <div style={subTabStyle(configSubTab==='geral')} onClick={()=>setConfigSubTab('geral')}>⚙️ Geral</div>
            <div style={subTabStyle(configSubTab==='automacao')} onClick={()=>setConfigSubTab('automacao')}>🤖 Automação</div>
            <div style={subTabStyle(configSubTab==='personalizacao')} onClick={()=>setConfigSubTab('personalizacao')}>🎨 Personalização</div>
            {isAdmin && <div style={subTabStyle(configSubTab==='seguranca')} onClick={()=>setConfigSubTab('seguranca')}>🛡️ Segurança & Acesso</div>}
            {isAdmin && <div style={subTabStyle(configSubTab==='auditoria')} onClick={()=>setConfigSubTab('auditoria')}>🕵️ Auditoria (Logs)</div>}
        </div>

        <div className="tab-content" key={configSubTab}>
            {configSubTab === 'geral' && (
                <div style={{display:'flex', flexDirection:'column', gap:'1.5rem', animation: 'fadeIn 0.3s'}}>
                    <div style={{display:'flex', gap:'1.5rem', flexWrap:'wrap'}}>
                      <div className="panel-card" style={{flex:1, minWidth:'300px'}}>
                        <div className="panel-title">⏰ Hora de Envio Automático</div>
                        <p className="text-muted" style={{fontSize:'0.85rem', marginBottom:'1.2rem'}}>Defina a que horas o sistema deve disparar as mensagens diárias.</p>
                        <div className="flex-wrap-responsive">
                          <input type="time" className="inline-input" value={horaLembrete} onChange={(e) => setHoraLembrete(e.target.value)} style={{fontSize:'1.2rem', padding:'0.5rem', flex:1}} />
                          <button onClick={() => handleSaveConfig('hora_lembrete', horaLembrete)} className="btn-submit" style={{padding:'0.6rem 1.5rem', flex:1}}>💾 Actualizar Hora</button>
                        </div>
                      </div>

                      <div className="panel-card" style={{flex:1, minWidth:'300px', border:'2px dashed #10b981', background:'#f0fdf4'}}>
                        <div className="panel-title" style={{color:'#059669'}}>🚀 Testar Lembretes Agora</div>
                        <p className="text-muted" style={{fontSize:'0.85rem', marginBottom:'1.2rem'}}>Dispare o lembrete de hoje agora mesmo para todos os destinatários.</p>
                        <button onClick={handleTestarLembretes} className="btn-submit" style={{width:'100%', background:'#10b981', fontSize:'1rem'}}>🤖 Disparar Eventos de Hoje</button>
                      </div>
                    </div>

                    <div className="panel-card">
                      <div className="panel-title" style={{display:'flex', alignItems:'center', gap:'0.5rem'}}>💡 Ajuda e Suporte</div>
                      <p className="text-muted" style={{fontSize:'0.85rem', marginBottom:'1.2rem'}}>Precisa de ajuda ou quer rever as funcionalidades principais?</p>
                      <button 
                        onClick={() => { localStorage.removeItem('tutorial_done'); setTutorialStep(1); setActiveTab('dashboard'); toast.success('Tour reiniciado!'); }} 
                        className="btn-submit" 
                        style={{width:'auto', alignSelf:'flex-start', padding:'0.4rem 1.2rem', fontSize:'0.8rem', background:'#6366f1', color:'white', border:'none', borderRadius:'6px', fontWeight:700, display:'inline-flex'}}
                      >
                        🚀 Reiniciar Tour
                      </button>
                    </div>
                </div>
            )}

            {configSubTab === 'automacao' && (
                <div style={{display:'flex', flexDirection:'column', gap:'1.5rem', animation: 'fadeIn 0.3s'}}>
                    <div className="panel-card">
                      <div className="panel-title">🤝 Resposta Padrão do Bot (Fallback)</div>
                      <p className="text-muted" style={{fontSize:'0.85rem', marginBottom:'1.2rem'}}>Mensagem enviada quando alguém agradece e não existe template específico.</p>
                      <textarea className="inline-input" rows={3} placeholder="Ex: A LNSOTECH agradece!" value={respostaPadraoBot} onChange={(e) => setRespostaPadraoBot(e.target.value)} style={{width:'100%', fontSize:'0.9rem', resize:'vertical'}} />
                      <button onClick={() => handleSaveConfig('resposta_padrao_bot', respostaPadraoBot)} className="btn-submit" style={{alignSelf:'flex-start', padding:'0.6rem 2rem', background:'var(--info)', marginTop:'1rem'}}>💾 Salvar Resposta Padrão</button>
                    </div>

                    <div className="panel-card">
                      <div className="panel-title">✍️ Assinatura Automática do Bot</div>
                      <p className="text-muted" style={{fontSize:'0.85rem', marginBottom:'1.2rem'}}>Texto adicionado ao final de todas as mensagens (Branding).</p>
                      <textarea className="inline-input" rows={3} placeholder="Ex: ⚡ Enviado via LNSOTECH" value={assinaturaBot} onChange={(e) => setAssinaturaBot(e.target.value)} style={{width:'100%', fontFamily:'monospace', fontSize:'0.9rem', resize:'vertical'}} />
                      <button onClick={() => handleSaveConfig('assinatura_bot', assinaturaBot)} className="btn-submit" style={{alignSelf:'flex-start', padding:'0.6rem 2rem', marginTop:'1rem'}}>💾 Salvar Assinatura</button>
                    </div>
                </div>
            )}

            {configSubTab === 'personalizacao' && (
                <div style={{display:'flex', flexDirection:'column', gap:'1.5rem', animation: 'fadeIn 0.3s'}}>
                    <div className="panel-card">
                      <div className="panel-title">🎨 Gestão de Tipos de Evento</div>
                      <div className="table-responsive">
                        <table className="table-minimal">
                          <thead><tr><th>Nome</th><th>Cor</th><th>Resposta (Reply)</th><th style={{textAlign:'right'}}>Acções</th></tr></thead>
                          <tbody>
                            {tiposEvento.map(t => (
                              <tr key={t.id}>
                                <td>{editingTipoId === t.id ? <input className="inline-input" value={editTipoForm.nome} onChange={e=>setEditTipoForm({...editTipoForm, nome: e.target.value.toLowerCase()})} /> : <span className="badge-tipo" style={{background: t.cor, color:'#fff'}}>{t.nome.toUpperCase()}</span>}</td>
                                <td>{editingTipoId === t.id ? <input type="color" value={editTipoForm.cor} onChange={e=>setEditTipoForm({...editTipoForm, cor: e.target.value})} /> : <div style={{display:'flex', alignItems:'center', gap:'0.5rem'}}><div style={{width:'12px', height:'12px', borderRadius:'50%', background:t.cor}} /> {t.cor}</div>}</td>
                                <td>{editingTipoId === t.id ? <textarea className="inline-input" value={editTipoForm.template_resposta} onChange={e=>setEditTipoForm({...editTipoForm, template_resposta: e.target.value})} rows={1} /> : <span className="text-small text-muted">{t.template_resposta || 'Padrão'}</span>}</td>
                                <td style={{textAlign:'right'}}>
                                  <div style={{display:'flex', gap:'0.4rem', justifyContent:'flex-end'}}>
                                    {editingTipoId === t.id ? (
                                      <button onClick={handleUpdateTipo} className="btn-action" style={{color:'#10b981'}}>Salvar</button>
                                    ) : (
                                      <>
                                        <button onClick={() => startEditTipo(t)} className="btn-action" style={{color:'#3b82f6'}}>Editar</button>
                                        <button onClick={() => handleDeleteTipo(t.id)} className="btn-action" style={{color:'#ef4444'}}>Eliminar</button>
                                      </>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <div style={{marginTop:'1.5rem', borderTop:'1px solid #eee', paddingTop:'1rem'}}>
                        <div className="panel-title" style={{fontSize:'0.9rem'}}>+ Adicionar Novo Tipo</div>
                        <div style={{display:'flex', gap:'0.5rem', marginTop:'0.5rem'}}><input className="inline-input" placeholder="Nome" value={newTipoNome} onChange={e=>setNewTipoNome(e.target.value)} style={{flex:1}} /><input type="color" value={newTipoCor} onChange={e=>setNewTipoCor(e.target.value)} style={{width:'40px'}} /><button onClick={handleCreateTipo} className="btn-submit">Adicionar</button></div>
                      </div>
                    </div>

                    <div className="panel-card">
                      <div className="panel-title">📝 Templates de Mensagem</div>
                      {templates.map(t => (
                        <div key={t.id} style={{marginBottom:'1rem', padding:'1rem', background:'#f8fafc', borderRadius:'8px', border:'1px solid #eee'}}>
                          <div style={{fontWeight:700, marginBottom:'0.4rem', fontSize:'0.85rem'}}>{t.tipo_evento.toUpperCase()}</div>
                          <textarea className="inline-input" style={{width:'100%', minHeight:'50px', background:'#fff', fontSize:'0.85rem'}} defaultValue={t.mensagem} onBlur={(e) => handleUpdateTemplate(t.id, e.target.value)} />
                        </div>
                      ))}
                      {renderBodaGlossary()}
                    </div>
                </div>
            )}

            {configSubTab === 'seguranca' && isAdmin && (
                <div style={{display:'flex', flexDirection:'column', gap:'1.5rem', animation: 'fadeIn 0.3s'}}>
                    <div className="panel-card">
                        <div className="panel-title">👥 Gestão de Utilizadores</div>
                        <div className="table-responsive">
                            <table className="table-minimal">
                                <thead><tr><th>Nome</th><th>Email</th><th>Nível</th><th style={{textAlign:'right'}}>Acções</th></tr></thead>
                                <tbody>
                                    {usuarios.map(u => (
                                        <tr key={u.id}>
                                            <td>
                                                {editingUserId === u.id ? (
                                                    <input className="inline-input" value={editUserForm.nome} onChange={e=>setEditUserForm({...editUserForm, nome: e.target.value})} style={{fontSize:'0.8rem'}} />
                                                ) : (
                                                    <span>{u.nome} {u.id === 1 && '⭐'} {u.id === user.id && '(Eu)'}</span>
                                                )}
                                            </td>
                                            <td>
                                                {editingUserId === u.id ? (
                                                    <div style={{display:'flex', flexDirection:'column', gap:'0.4rem'}}>
                                                        <input className="inline-input" value={editUserForm.email} onChange={e=>setEditUserForm({...editUserForm, email: e.target.value})} style={{fontSize:'0.8rem'}} placeholder="Email" />
                                                        <input type="password" placeholder="Nova senha (vazio p/ manter)" className="inline-input" value={editUserForm.senha} onChange={e=>setEditUserForm({...editUserForm, senha: e.target.value})} style={{fontSize:'0.8rem'}} />
                                                    </div>
                                                ) : u.email}
                                            </td>
                                            <td>
                                                {editingUserId === u.id ? (
                                                    <div style={{display:'flex', flexDirection:'column', gap:'0.4rem'}}>
                                                        <select className="inline-input" value={editUserForm.nivel_acesso} onChange={e=>setEditUserForm({...editUserForm, nivel_acesso: e.target.value})} style={{fontSize:'0.8rem'}}>
                                                            <option value="leitor">LEITOR</option>
                                                            <option value="editor">EDITOR</option>
                                                            <option value="admin">ADMIN</option>
                                                        </select>
                                                        {editUserForm.nivel_acesso === 'leitor' && (
                                                            <div style={{display:'flex', gap:'0.4rem'}}>
                                                                <select multiple className="inline-input" value={editUserForm.tipos_permitidos} onChange={e=>setEditUserForm({...editUserForm, tipos_permitidos: Array.from(e.target.selectedOptions, o=>o.value)})} style={{fontSize:'0.7rem', flex:1}} title="Tipos (Ctrl/Cmd para vários)">
                                                                    {tiposEvento.map(t => <option key={t.id || t.nome} value={t.nome}>{t.nome}</option>)}
                                                                </select>
                                                                <select multiple className="inline-input" value={editUserForm.grupos_permitidos} onChange={e=>setEditUserForm({...editUserForm, grupos_permitidos: Array.from(e.target.selectedOptions, o=>o.value)})} style={{fontSize:'0.7rem', flex:1}} title="Grupos (Ctrl/Cmd para vários)">
                                                                    {grupos.map(g => <option key={g.id} value={g.id}>{g.nome}</option>)}
                                                                </select>
                                                            </div>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <span className="badge-tipo" style={{background:'#f1f5f9', color:'#475569'}}>{u.nivel_acesso.toUpperCase()}</span>
                                                )}
                                            </td>
                                            <td style={{textAlign:'right'}}>
                                                {editingUserId === u.id ? (
                                                    <div style={{display:'flex', gap:'0.4rem', justifyContent:'flex-end'}}>
                                                        <button onClick={handleUpdateUser} className="btn-action" style={{color:'#10b981'}}>✔</button>
                                                        <button onClick={()=>setEditingUserId(null)} className="btn-action">✖</button>
                                                    </div>
                                                ) : (
                                                    <div style={{display:'flex', gap:'0.4rem', justifyContent:'flex-end'}}>
                                                        <button onClick={() => startEditUser(u)} className="btn-action" style={{color:'#3b82f6'}}>Editar</button>
                                                        {u.id !== 1 && u.id !== user.id && (
                                                            <button onClick={() => handleDeleteUsuario(u.id)} className="btn-action" style={{color:'#ef4444'}}>Eliminar</button>
                                                        )}
                                                    </div>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <div style={{marginTop:'1.5rem', borderTop:'1px solid #eee', paddingTop:'1rem'}}>
                            <div className="panel-title" style={{fontSize:'0.9rem'}}>+ Novo Utilizador</div>
                            <div style={{display:'flex', gap:'0.5rem', flexWrap:'wrap', marginTop:'0.5rem'}}>
                                <input className="inline-input" placeholder="Nome" value={newUserNome} onChange={e=>setNewUserNome(e.target.value)} style={{flex:1}} />
                                <input className="inline-input" placeholder="Email" value={newUserEmail} onChange={e=>setNewUserEmail(e.target.value)} style={{flex:1}} />
                                <input type="password" className="inline-input" placeholder="Senha" value={newUserSenha} onChange={e=>setNewUserSenha(e.target.value)} style={{flex:1}} />
                                <select className="inline-input" value={newUserRole} onChange={e=>setNewUserRole(e.target.value)} style={{flex:0.5}}>
                                    <option value="leitor">Leitor</option>
                                    <option value="editor">Editor</option>
                                    <option value="admin">Admin</option>
                                </select>
                                <button onClick={handleCreateUsuario} className="btn-submit" style={{padding:'0.4rem 1rem'}}>Criar</button>
                            </div>
                            
                            {newUserRole === 'leitor' && (
                                <div style={{display:'flex', gap:'0.5rem', flexWrap:'wrap', marginTop:'0.5rem'}}>
                                    <div style={{flex:1}}>
                                        <label style={{fontSize:'0.75rem', fontWeight:600}}>Tipos de Evento Permitidos (Ctrl/Cmd para múltipla seleção)</label>
                                        <select multiple className="inline-input" value={newUserTipos} onChange={e=>setNewUserTipos(Array.from(e.target.selectedOptions, o=>o.value))} style={{width:'100%', minHeight:'60px'}}>
                                            {tiposEvento.map(t => <option key={t.id || t.nome} value={t.nome}>{t.nome}</option>)}
                                        </select>
                                    </div>
                                    <div style={{flex:1}}>
                                        <label style={{fontSize:'0.75rem', fontWeight:600}}>Grupos Permitidos (Ctrl/Cmd para múltipla seleção)</label>
                                        <select multiple className="inline-input" value={newUserGrupos} onChange={e=>setNewUserGrupos(Array.from(e.target.selectedOptions, o=>o.value))} style={{width:'100%', minHeight:'60px'}}>
                                            {grupos.map(g => <option key={g.id} value={g.id}>{g.nome}</option>)}
                                        </select>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="panel-card">
                        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                            <div className="panel-title">🗄️ Base de Dados & Backups</div>
                            <div style={{display:'flex', gap:'0.5rem'}}>
                                <input type="file" id="upload-backup" style={{display:'none'}} onChange={e => handleUploadRestore(e.target.files[0])} />
                                <button onClick={() => document.getElementById('upload-backup').click()} className="btn-submit" style={{background:'#f59e0b', fontSize:'0.8rem'}}>📤 Upload e Restaurar</button>
                                <button onClick={async () => { Swal.fire({ title: '📦 Gerando Backup...', allowOutsideClick: false, didOpen: () => Swal.showLoading() }); const r = await fetch(`${apiBase}/api/auth/backups/gerar`, { method: 'POST', headers }); if (r.ok) { Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: '✅ Backup!', showConfirmButton: false, timer: 3000, background: '#10b981', color: '#fff' }); fetchData(); } }} className="btn-submit" style={{background:'#6366f1', fontSize:'0.8rem'}}>➕ Gerar Backup</button>
                            </div>
                        </div>
                        <div className="table-responsive" style={{marginTop:'1.5rem'}}>
                            <table className="table-minimal">
                                <thead><tr><th>Arquivo</th><th>Data</th><th style={{textAlign:'right'}}>Ações</th></tr></thead>
                                <tbody>
                                  {backups.map(b => (
                                    <tr key={b.name}>
                                      <td>📄 {b.name}</td>
                                      <td>{new Date(b.date).toLocaleDateString()}</td>
                                      <td style={{textAlign:'right'}}>
                                        <div style={{display:'flex', gap:'0.4rem', justifyContent:'flex-end'}}>
                                          <a href={`${apiBase}/api/auth/backups/download/${b.name}?token=${token}`} download className="btn-action" style={{color:'#3b82f6'}}>Baixar</a>
                                          <button onClick={()=>handleRestoreBackup(b.name)} className="btn-action" style={{color:'#f59e0b'}}>Restaurar</button>
                                          <button onClick={()=>handleDeleteBackup(b.name)} className="btn-action" style={{color:'#ef4444'}}>Eliminar</button>
                                        </div>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {configSubTab === 'auditoria' && isAdmin && (
                <div style={{display:'flex', flexDirection:'column', gap:'1.5rem', animation: 'fadeIn 0.3s'}}>
                    <div className="panel-card">
                        <div className="panel-title" style={{display:'flex', alignItems:'center', gap:'0.5rem'}}>🕵️ Log de Atividades da Equipa</div>
                        <p className="text-muted" style={{fontSize:'0.85rem'}}>Acompanhe aqui todas as criações, edições e remoções de eventos feitas pelos utilizadores do sistema. Os registos são imutáveis.</p>
                        
                        <div className="table-responsive" style={{marginTop:'1.5rem'}}>
                            <table className="table-minimal">
                                <thead><tr><th>Ocorrente</th><th>Ação</th><th>Detalhes</th><th>Tempo (UTC)</th></tr></thead>
                                <tbody>
                                    {logsAuditoria.length === 0 ? (
                                        <tr><td colSpan="4" style={{textAlign:'center', padding:'2rem', color:'#94a3b8'}}>Nenhuma atividade registada.</td></tr>
                                    ) : logsAuditoria.map(log => (
                                        <tr key={log.id}>
                                            <td style={{fontWeight:600}}>{log.nome_usuario} <span className="text-muted" style={{fontWeight:400, fontSize:'0.7rem'}}>ID:{log.usuario_id || '?'}</span></td>
                                            <td>
                                                <span className="badge-tipo" style={{
                                                    background: log.acao === 'CRIAR' ? '#dcfce7' : log.acao === 'REMOVER' ? '#fee2e2' : log.acao==='IMPORTAR' ? '#fef3c7' : '#e0f2fe',
                                                    color: log.acao === 'CRIAR' ? '#166534' : log.acao === 'REMOVER' ? '#991b1b' : log.acao==='IMPORTAR' ? '#92400e' : '#075985'
                                                }}>{log.acao} {log.entidade}</span>
                                            </td>
                                            <td style={{fontSize:'0.8rem', color:'#475569'}}>{log.detalhes}</td>
                                            <td className="text-muted" style={{fontSize:'0.8rem'}}>{new Date(log.data_hora).toLocaleString('pt-PT')}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}
        </div>
      </div>
    );
  };

  /* ========== RENDER: TUTORIAL OVERLAY ========== */
  const renderTutorial = () => {
    if (tutorialStep === 0) return null;

    const steps = [
        { title: "👋 Olá!", text: "Benvindo ao seu novo CRM. Vamos configurar tudo em 1 minuto?", target: null },
        { title: "📊 Visão Geral", text: "Aqui vê o resumo vital: eventos, grupos ativos e lembretes de hoje.", target: "step-stats" },
        { title: "🤖 Status Bot", text: "Mantenha o WhatsApp ligado. Se ficar a vermelho, re-conecte o QR.", target: "step-bot" },
        { title: "🔌 Conectar Grupos", text: "Active ou silencie grupos individualmente para controlar os envios.", target: "step-groups-list" },
        { title: "✍️ Novo Registo", text: "Adicione datas especiais num instante usando este formulário expresso.", target: "step-new-event" },
        { title: "📲 Sincronizar", text: "Link ICS para importar todos os eventos para o seu telemóvel.", target: "step-calendar-sync" },
        { title: "🗓️ Mapa Mensal", text: "Planeie o seu mês. Clique nos dias coloridos para ver os detalhes.", target: "step-calendar-grid" },
        { title: "📂 Exportar", text: "Gere relatórios PDF/Excel para backups ou auditorias externas.", target: "step-export" },
        { title: "🚀 Sucesso!", text: "Tudo configurado! Explore à vontade e automatize o seu negócio.", target: null }
    ];

    const current = steps[tutorialStep - 1] || steps[0];
    const progress = Math.round((tutorialStep / steps.length) * 100);

    return (
        <div style={{ position: 'fixed', inset: 0, zIndex: 20000, pointerEvents: 'none', background: tutorialStep === 1 || tutorialStep === 9 ? 'rgba(0,0,0,0.7)' : 'transparent', backdropFilter: tutorialStep === 1 || tutorialStep === 9 ? 'blur(4px)' : 'none', transition: '0.3s' }}>
            <div className="panel-modal" style={{ 
                position: 'fixed', bottom: '2rem', right: '2rem', maxWidth: '420px', width: '90%', 
                textAlign: 'left', padding: '1.8rem', pointerEvents: 'auto',
                borderLeft: '8px solid var(--primary)', 
                boxShadow: '0 30px 80px -15px rgba(0,0,0,0.6), 0 0 35px rgba(99, 102, 241, 0.3)', 
                background: 'rgba(255, 255, 255, 1)', 
                backdropFilter: 'blur(15px)',
                borderRadius: '16px',
                animation: 'fadeIn 0.6s cubic-bezier(0.16, 1, 0.3, 1)',
                zIndex: 20001
            }}>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                    <div className="tutorial-icon-display" style={{ fontSize: '2.5rem' }}>
                        {current.title.split(' ')[0]}
                    </div>
                    <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.3rem' }}>
                            <h3 style={{ margin: 0, color: 'var(--text)', fontSize: '1.05rem', fontWeight: 700 }}>{current.title.split(' ').slice(1).join(' ') || current.title}</h3>
                            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--primary)', background: '#eff6ff', padding: '2px 10px', borderRadius: '12px' }}>{progress}%</span>
                        </div>
                        <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', fontSize: '0.85rem', lineHeight: '1.4' }}>{current.text}</p>
                        <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
                            {tutorialStep > 1 && <button onClick={prevTutorial} className="btn-secondary tutorial-btn" style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}>← Anterior</button>}
                            
                            {tutorialStep < steps.length ? (
                                <>
                                    <button onClick={nextTutorial} className="btn-submit tutorial-btn" style={{ padding: '0.4rem 1.5rem', fontSize: '0.8rem', background: 'var(--primary)' }}>Próximo →</button>
                                    <button onClick={skipTutorial} className="btn-secondary tutorial-btn" style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', border:'none', color:'var(--text-secondary)' }}>Pular</button>
                                </>
                            ) : (
                                <button onClick={() => {
                                    skipTutorial(); 
                                    Swal.fire({ 
                                        title: '🎉 Tudo Pronto!', 
                                        text: 'O seu CRM está configurado e pronto para dominar o mercado.', 
                                        icon: 'success', 
                                        confirmButtonText: 'Vamos a isso!', 
                                        confirmButtonColor: '#10b981',
                                        background: '#fff', 
                                        color: '#1e293b' 
                                    });
                                }} className="btn-submit tutorial-btn" style={{ padding: '0.5rem 2rem', fontSize: '0.85rem', background: '#10b981' }}>Começar Agora!</button>
                            )}
                        </div>
                    </div>
                </div>
                <div style={{ marginTop: '1rem', display: 'flex', gap: '4px' }}>
                    {steps.map((_, i) => (
                        <div key={i} style={{ flex: 1, height: '4px', borderRadius: '2px', background: (i + 1) === tutorialStep ? 'var(--primary)' : (i + 1) < tutorialStep ? '#dbeafe' : '#f1f5f9', transition: '0.4s' }} />
                    ))}
                </div>
            </div>

            <style>{`
                @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
                @keyframes pulse { 0% { transform: scale(1); box-shadow: 0 0 0 0 rgba(99, 102, 241, 0.4); } 70% { transform: scale(1.02); box-shadow: 0 0 0 20px rgba(99, 102, 241, 0); } 100% { transform: scale(1); } }
                @keyframes bounce { 0%, 20%, 50%, 80%, 100% {transform: translateY(0);} 40% {transform: translateY(-10px);} 60% {transform: translateY(-5px);} }
                
                .tutorial-highlight { 
                    box-shadow: 0 0 0 9999px rgba(0,0,0,0.8), 0 0 35px var(--primary) !important; 
                    z-index: 10001 !important; 
                    position: relative !important; 
                    pointer-events: none;
                    animation: pulse 2s infinite !important;
                    border: 2px solid var(--primary) !important;
                }

                @media (max-width: 768px) {
                    .panel-modal {
                        bottom: 0 !important;
                        right: 0 !important;
                        left: 0 !important;
                        width: 100% !important;
                        max-width: 100% !important;
                        border-radius: 20px 20px 0 0 !important;
                        border-left: none !important;
                        border-top: 5px solid var(--primary) !important;
                        padding: 1.2rem !important;
                    }
                    .tutorial-icon-display { display: none; }
                    .tutorial-btn {
                        padding: 0.35rem 0.7rem !important;
                        font-size: 0.75rem !important;
                    }
                }

                .tutorial-arrow {
                    position: absolute;
                    font-size: 3rem;
                    color: var(--primary);
                    z-index: 10002;
                    animation: bounce 2s infinite;
                    pointer-events: none;
                }
            `}</style>
            
            {current.target && document.getElementById(current.target) && (
                <div className="tutorial-arrow" style={{
                    top: document.getElementById(current.target).getBoundingClientRect().top - 60,
                    left: document.getElementById(current.target).getBoundingClientRect().left + (document.getElementById(current.target).offsetWidth / 2) - 15
                }}>
                    👇
                </div>
            )}
        </div>
    );
  };

  /* ========== LAYOUT ========== */
  return (
    <div className="dashboard-layout">
      {renderTutorial()}
      <ToastContainer position="top-right" autoClose={30000} hideProgressBar={false} newestOnTop closeOnClick pauseOnFocusLoss draggable pauseOnHover theme="colored" />
      
      {/* Overlay para fechar ao clicar fora no mobile */}
      <div className={`sidebar-overlay ${sidebarOpen ? 'visible' : ''}`} onClick={() => setSidebarOpen(false)}></div>

      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-logo">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z"></path><path d="M2 17l10 5 10-5"></path><path d="M2 12l10 5 10-5"></path></svg>
          <span>LNSOTECH</span>
        </div>
        <nav className="nav-menu">
          {canEdit && <div className={`nav-item ${activeTab==='dashboard'?'active':''}`} onClick={()=>changeTab('dashboard')}><span>📊</span><span>Dashboard</span></div>}
          {canEdit && <div className={`nav-item ${activeTab==='eventos'?'active':''}`} onClick={()=>changeTab('eventos')}><span>👥</span><span>Eventos</span></div>}
          <div className={`nav-item ${activeTab==='calendario'?'active':''}`} onClick={()=>changeTab('calendario')}><span>📅</span><span>Calendário</span></div>
          {canEdit && <div className={`nav-item ${activeTab==='grupos'?'active':''}`} onClick={()=>changeTab('grupos')}><span>📱</span><span>Grupos WhatsApp</span></div>}
          {isAdmin && <div className={`nav-item ${activeTab==='logs'?'active':''}`} onClick={()=>changeTab('logs')}><span>📖</span><span>Histórico</span></div>}
          {(isAdmin || isEditor) && <div className={`nav-item ${activeTab==='configuracoes'?'active':''}`} onClick={()=>changeTab('configuracoes')}><span>⚙️</span><span>Configurações</span></div>}
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
          <button className="mobile-menu-btn" onClick={() => setSidebarOpen(true)}>☰</button>
          <div className="search-bar-container" style={{visibility:'hidden', flex:1}}>
             {/* Busca removida do Header global */}
          </div>
          <div className="topbar-icons">
            <span className="icon-btn" title={`Nível: ${user.nivel_acesso}`}>{isAdmin ? '🛡️' : (isEditor ? '✏️' : '👁️')}</span>
            
            {!isOnline && <span className="icon-btn notification-badge" style={{background:'#f59e0b'}} title="Sistma Offline. Lembretes pendentes.">📴</span>}
            {offlineQueueLength > 0 && <span className="icon-btn notification-badge" style={{background:'#3b82f6'}} title={`${offlineQueueLength} registos por sincronizar.`}>⏳ {offlineQueueLength}</span>}
            {stats.falhasHoje > 0 && <span className="icon-btn notification-badge" onClick={() => changeTab('logs')} title="Existem falhas!">🔔</span>}
            
            <button 
              onClick={toggleTheme} 
              className="icon-btn" 
              style={{background:'none', border:'none', fontSize:'1.2rem', padding:'0.5rem'}}
              title="Trocar Tema"
            >
              {theme === 'light' ? '🌙' : '☀️'}
            </button>

            <div className="user-avatar topbar-avatar">{user?.nome?.charAt(0) || 'U'}</div>
          </div>
        </header>

        <div className="content-wrapper">
          <h2 className="page-title">{
            {dashboard:'Painel Executivo', eventos:'Gestão de Eventos', calendario:'Calendário de Eventos', grupos:'Grupos WhatsApp', logs:'Histórico e Auditoria', configuracoes:'Configurações'}[activeTab]
          }</h2>
          <p className="page-subtitle">LNSOTECH Automation CRM — {user.nivel_acesso?.toUpperCase()}</p>
          
          {canEdit && activeTab === 'dashboard' && renderDashboard()}
          {canEdit && activeTab === 'eventos' && renderEventos()}
          {activeTab === 'calendario' && renderCalendario()}
          {canEdit && activeTab === 'grupos' && 
          renderMultiBot()}
          {isAdmin && activeTab === 'logs' && renderLogs()}
          {(isAdmin || isEditor) && activeTab === 'configuracoes' && renderConfig()}
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
                            <option value="casamento">💍 Casamento</option>
                            <option value="aniversario">🎂 Aniversário</option>
                            <option value="batizado">🕊️ Batizado</option>
                            {tiposEvento.filter(t => !['casamento','aniversario','batizado'].includes(t.nome)).map(t => (
                                <option key={t.id} value={t.nome}>{t.nome.charAt(0).toUpperCase() + t.nome.slice(1)}</option>
                            ))}
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
                    <button onClick={handleUpdateEvento} className="btn-submit" style={{flex:1, padding:'0.8rem', background:'var(--primary)'}}>💾 Guardar Alterações</button>
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
                            <thead><tr><th>Data</th><th>Autor</th><th>Alterações</th></tr></thead>
                            <tbody>
                                {historicoAlteracoes.map(h => (
                                    <tr key={h.id}>
                                        <td className="text-small" style={{whiteSpace:'nowrap', verticalAlign:'top'}}>{new Date(h.data_alteracao).toLocaleString('pt-PT')}</td>
                                        <td className="fw-bold" style={{verticalAlign:'top'}}>{h.usuario_nome || 'Sistema'}</td>
                                        <td>
                                            {renderDiff(h.dados_anteriores, h.dados_novos)}
                                        </td>
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
