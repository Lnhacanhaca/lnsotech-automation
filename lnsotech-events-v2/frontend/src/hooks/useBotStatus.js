import { useState, useEffect, useCallback } from 'react';

export const useBotStatus = (token, activeTab) => {
    const [status, setStatus] = useState({ qr: null, status: 'desconhecido', lastUpdate: null });
    const [loading, setLoading] = useState(false);

    const apiBase = '';
    const headers = { 'Authorization': `Bearer ${token}` };

    const fetchStatus = useCallback(async () => {
        try {
            const res = await fetch(`${apiBase}/api/eventos/whatsapp-status`, { headers });
            if (res.ok) {
                const data = await res.json();
                setStatus(data);
            } else {
                // Se o servidor responder erro, provavelmente está a reiniciar
                setStatus(prev => ({ ...prev, status: 'sincronizando...' }));
            }
        } catch (err) {
            // Se falhar a conexão, o bot está off ou a subir
            setStatus(prev => ({ ...prev, status: 'conectando...' }));
        }
    }, [token, headers]);

    useEffect(() => {
        let interval;
        if (activeTab === 'grupos' || activeTab === 'configuracoes' || activeTab === 'dashboard') {
            fetchStatus();
            interval = setInterval(fetchStatus, 3000);
        }
        return () => clearInterval(interval);
    }, [activeTab, fetchStatus]);

    const reconnect = async () => {
        setLoading(true);
        try {
            const res = await fetch(`${apiBase}/api/eventos/whatsapp-reconectar`, { 
                method: 'POST', 
                headers: { ...headers, 'Content-Type': 'application/json' } 
            });
            const data = await res.json();
            return data;
        } finally {
            setLoading(false);
            fetchStatus();
        }
    };

    return { status, reconnect, loading };
};
