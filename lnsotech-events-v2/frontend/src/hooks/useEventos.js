import { useState, useEffect, useCallback } from 'react';

export const useEventos = (token, searchQuery = '') => {
    const [eventos, setEventos] = useState([]);
    const [stats, setStats] = useState({ 
        totalEventos: 0, totalBodas: 0, totalAniversarios: 0, 
        gruposAtivos: 0, lembretesEnviados: 0, falhasHoje: 0 
    });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const apiBase = '';
    const headers = { 'Authorization': `Bearer ${token}` };

    const fetchEventos = useCallback(async () => {
        try {
            setLoading(true);
            const url = searchQuery ? `${apiBase}/api/eventos?search=${searchQuery}` : `${apiBase}/api/eventos`;
            const res = await fetch(url, { headers });
            if (res.ok) {
                const data = await res.json();
                setEventos(data);
            } else {
                setError('Falha ao buscar eventos');
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [token, searchQuery]);

    const fetchStats = useCallback(async () => {
        try {
            const res = await fetch(`${apiBase}/api/eventos/stats`, { headers });
            if (res.ok) {
                const data = await res.json();
                setStats(data);
            }
        } catch (err) {
            console.error('Erro ao buscar estatísticas:', err);
        }
    }, [token]);

    useEffect(() => {
        fetchEventos();
        fetchStats();
    }, [fetchEventos, fetchStats]);

    return { 
        eventos, 
        stats, 
        loading, 
        error, 
        refresh: () => { fetchEventos(); fetchStats(); } 
    };
};
