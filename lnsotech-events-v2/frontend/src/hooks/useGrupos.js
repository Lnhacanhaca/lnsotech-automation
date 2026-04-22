import { useState, useEffect, useCallback, useMemo } from 'react';
import { toast } from 'react-toastify';

export const useGrupos = (token, activeTab, mutedGroups = []) => {
    const [rawGrupos, setRawGrupos] = useState([]);
    const [loading, setLoading] = useState(false);

    const apiBase = '';
    const headers = { 'Authorization': `Bearer ${token}` };

    const fetchGrupos = useCallback(async (botId) => {
        setLoading(true);
        try {
            const url = botId ? `${apiBase}/api/eventos/grupos?botId=${botId}` : `${apiBase}/api/eventos/grupos`;
            const res = await fetch(url, { headers });
            if (res.ok) {
                const data = await res.json();
                setRawGrupos(data);
            } else {
                const d = await res.json();
                toast.error(d.erro || 'Instância offline ao buscar grupos');
            }
        } catch (e) {
            toast.error('Falha ao carregar grupos (Servidor)');
        } finally {
            setLoading(false);
        }
    }, [token]);

    useEffect(() => {
        // Agora o carregamento automático só acontece se já houver grupos salvos ou o user escolher um bot
    }, [activeTab, fetchGrupos]);

    const grupos = useMemo(() => {
        return rawGrupos.map(g => ({
            ...g,
            isMuted: mutedGroups.includes(g.id)
        }));
    }, [rawGrupos, mutedGroups]);

    return { grupos, loading, refresh: fetchGrupos };
};
