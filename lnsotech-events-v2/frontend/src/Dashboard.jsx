import React, { useState, useEffect } from 'react';

export default function Dashboard({ token, user, onLogout }) {
  const [eventos, setEventos] = useState([]);
  const [loading, setLoading] = useState(true);

  const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:3000';

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

  const handleDelete = async (id) => {
    if (!window.confirm('Certeza que deseja apagar este evento permanentemente?')) return;
    
    try {
      const res = await fetch(`${apiBase}/api/eventos/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setEventos(eventos.filter(e => e.id !== id));
      }
    } catch (err) {
      alert('Erro ao apagar');
    }
  };

  return (
    <div className="app-container">
      <header className="dashboard-header glass-panel" style={{ borderBottom: 'none', borderRadius: '0 0 16px 16px' }}>
        <div className="logo-brand">
          💍 <span>LNSOTECH <span style={{color: 'var(--primary)', fontWeight: '300'}}>Events</span></span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
            Logado como: <strong style={{ color: 'white'}}>{user.nome}</strong> 
            <span className="badge" style={{ marginLeft: '10px', background: 'rgba(255,255,255,0.1)' }}>{user.nivel}</span>
          </div>
          <button className="btn-logout" onClick={onLogout}>Sair</button>
        </div>
      </header>

      <main className="dashboard-content">
        <div className="section-head">
          <div>
            <h2 style={{ fontSize: '1.8rem', marginBottom: '0.5rem' }}>Painel de Controlo</h2>
            <p style={{ color: 'var(--text-muted)' }}>Gira as datas e envie belas recordações aos seus clientes.</p>
          </div>
          <button className="btn-primary" style={{ width: 'auto', padding: '0.75rem 1.5rem' }}>+ Novo Registo Manual</button>
        </div>

        <div className="glass-panel" style={{ padding: '2px' }}>
          <div className="data-table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Nomes Principais</th>
                  <th>Data do Evento</th>
                  <th>Categoria</th>
                  <th>ID WhatsApp</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan="6" style={{ textAlign: 'center', padding: '2rem' }}>Carregando eventos...</td></tr>
                ) : eventos.length === 0 ? (
                  <tr><td colSpan="6" style={{ textAlign: 'center', padding: '2rem' }}>Nenhum evento registado na V2 ainda. Use o comando !reg no WhatsApp!</td></tr>
                ) : (
                  eventos.map(ev => (
                    <tr key={ev.id}>
                      <td>#{ev.id}</td>
                      <td style={{ fontWeight: '500' }}>{ev.nomes_principais}</td>
                      <td>{new Date(ev.data_evento).toLocaleDateString('pt-PT')}</td>
                      <td>
                        <span className={`badge badge-${ev.tipo_evento}`}>
                          {ev.tipo_evento}
                        </span>
                      </td>
                      <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{ev.grupo_id?.substring(0, 15)}...</td>
                      <td>
                        <button className="btn-danger" onClick={() => handleDelete(ev.id)}>Apagar</button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
