import { useState, useEffect, useCallback, useMemo } from 'react';
import { toast } from 'react-toastify';

export const useGrupos = (token, activeTab, mutedGroups = []) => {
    const [rawGrupos, setRawGrupos] = useState([]);
    const [loading, setLoading] = useState(false);

    const apiBase = '';
    const headers = { 'Authorization': `Bearer ${token}` };

    const fetchGrupos = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch(`${apiBase}/api/eventos/grupos`, { headers });
            if (res.ok) {
                const data = await res.json();
                setRawGrupos(data);
            } else {
                const d = await res.json();
                toast.error(d.erro || 'Bot offline ao buscar grupos');
            }
        } catch (e) {
            toast.error('Falha ao carregar grupos');
        } finally {
            setLoading(false);
        }
    }, [token]);

    useEffect(() => {
        if (activeTab === 'grupos' && rawGrupos.length === 0) {
            fetchGrupos();
        }
    }, [activeTab, fetchGrupos, rawGrupos.length]);

    const grupos = useMemo(() => {
        return rawGrupos.map(g => ({
            ...g,
            isMuted: mutedGroups.includes(g.id)
        }));
    }, [rawGrupos, mutedGroups]);

    return { grupos, loading, refresh: fetchGrupos };
};
