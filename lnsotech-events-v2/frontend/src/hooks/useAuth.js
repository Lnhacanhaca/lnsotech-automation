import { useMemo } from 'react';

export const useAuth = (rawUser, token, onLogout) => {
    const user = useMemo(() => ({
        ...(rawUser || {}),
        nivel_acesso: rawUser?.nivel_acesso || rawUser?.nivel || 'leitor'
    }), [rawUser]);

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
