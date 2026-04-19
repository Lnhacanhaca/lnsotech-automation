import { useState, useEffect } from 'react';

export const useOfflineSync = (token, onSyncSuccess) => {
    const [isOnline, setIsOnline] = useState(navigator.onLine);
    const [queueLength, setQueueLength] = useState(() => {
        return JSON.parse(localStorage.getItem('offline_events') || '[]').length;
    });

    const apiBase = '';
    const jsonHeaders = { 
        'Content-Type': 'application/json', 
        'Authorization': `Bearer ${token}` 
    };

    const syncQueue = async () => {
        const queue = JSON.parse(localStorage.getItem('offline_events') || '[]');
        if (queue.length === 0) return;

        let successCount = 0;
        for (const payload of queue) {
            try {
                const res = await fetch(`${apiBase}/api/eventos`, { 
                    method: 'POST', 
                    headers: jsonHeaders, 
                    body: JSON.stringify(payload) 
                });
                if (res.ok) successCount++;
            } catch (err) {
                console.error('Sync error', err);
            }
        }

        localStorage.removeItem('offline_events');
        setQueueLength(0);
        if (successCount > 0 && onSyncSuccess) {
            onSyncSuccess(successCount);
        }
    };

    useEffect(() => {
        const handleOnline = () => {
            setIsOnline(true);
            syncQueue();
        };
        const handleOffline = () => setIsOnline(false);

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, [token]);

    const addToQueue = (payload) => {
        const queue = JSON.parse(localStorage.getItem('offline_events') || '[]');
        queue.push(payload);
        localStorage.setItem('offline_events', JSON.stringify(queue));
        setQueueLength(queue.length);
    };

    return { isOnline, queueLength, addToQueue };
};
