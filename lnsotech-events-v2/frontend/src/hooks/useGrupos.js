import { useState, useEffect, useCallback, useMemo } from 'react';
import { toast } from 'react-toastify';

export const useGrupos = (token, activeTab, mutedGroups = []) => {
    const [rawGrupos, setRawGrupos] = useState([]);
    const [loading, setLoading] = useState(false);

    const apiBase = '';

    const fetchGrupos = useCallback(async (botId) => {
        if (!token) return; // Não tenta buscar sem token
        
        setLoading(true);
        try {
            const headers = { 'Authorization': `Bearer ${token}` };
            const url = botId ? `${apiBase}/api/eventos/grupos?botId=${botId}` : `${apiBase}/api/eventos/grupos`;
            const res = await fetch(url, { headers });
            
            if (res.ok) {
                const data = await res.json();
                setRawGrupos(data);
            } else {
                // Silencioso se for erro de autenticação inicial ou 404 momentâneo
                if (res.status !== 401 && res.status !== 404) {
                    try {
                        const d = await res.json();
                        toast.error(d.erro || 'Instância offline ao buscar grupos');
                    } catch(e) {
                        console.error('Erro ao processar resposta de grupos');
                    }
                }
            }
        } catch (e) {
            // Log no console em vez de toast para evitar spam no refresh
            console.error('Falha ao carregar grupos:', e);
        } finally {
            setLoading(false);
        }
    }, [token]);

    useEffect(() => {
        // Carregamento inicial silenciado ou por demanda
    }, [activeTab, fetchGrupos]);

    const grupos = useMemo(() => {
        return rawGrupos.map(g => ({
            ...g,
            isMuted: mutedGroups.includes(g.id)
        }));
    }, [rawGrupos, mutedGroups]);

    return { grupos, loading, refresh: fetchGrupos };
};
