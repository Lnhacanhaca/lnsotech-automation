import { useMemo } from 'react';

export const useAuth = (rawUser, token, onLogout) => {
    const user = useMemo(() => {
        let gp = [];
        let tp = [];
        try { gp = typeof rawUser?.grupos_permitidos === 'string' ? JSON.parse(rawUser.grupos_permitidos) : (rawUser?.grupos_permitidos || []); } catch(e){}
        try { tp = typeof rawUser?.tipos_permitidos === 'string' ? JSON.parse(rawUser.tipos_permitidos) : (rawUser?.tipos_permitidos || []); } catch(e){}

        return {
            ...(rawUser || {}),
            nivel_acesso: rawUser?.nivel_acesso || rawUser?.nivel || 'leitor',
            grupos_permitidos: gp,
            tipos_permitidos: tp
        };
    }, [rawUser]);

    const isAdmin = user.nivel_acesso === 'admin';
    const isEditor = user.nivel_acesso === 'editor';
    const canEdit = isAdmin || isEditor;

    const headers = useMemo(() => ({ 
        'Authorization': `Bearer ${token}` 
    }), [token]);

    const jsonHeaders = useMemo(() => ({ 
        'Content-Type': 'application/json', 
        'Authorization': `Bearer ${token}` 
    }), [token]);

    return { user, isAdmin, isEditor, canEdit, headers, jsonHeaders, onLogout };
};
