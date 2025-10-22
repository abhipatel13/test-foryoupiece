'use client'

import { useState, useEffect, useCallback, FC, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { authFetch } from '@/lib/utils/auth-interceptor';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface Notification {
    id: string;
    title: string;
    message: string;
    read: boolean;
}

interface ProfileNotificationsProps {
    initialData: any;
    userId: string | undefined;
}

export const ProfileNotifications: FC<ProfileNotificationsProps> = ({ initialData, userId }) => {
    const [items, setItems] = useState<Notification[]>(initialData?.notifications || []);
    const [unread, setUnread] = useState(initialData?.unread_count || 0);
    const [page, setPage] = useState(1);
    const limit = 7;
    const [total, setTotal] = useState(initialData?.metadata?.total_notifications || 0);
    const [loading, setLoading] = useState(false);
    const [hasTriedInitialLoad, setHasTriedInitialLoad] = useState(false);
    const [isLoadingData, setIsLoadingData] = useState(false);
    const isLoadingRef = useRef(false);

    const load = useCallback(async (pageNum: number) => {
        if (!userId) { 
            console.warn('ProfileNotifications: No userId provided');
            return; 
        }
        
        // Prevent duplicate calls using ref for immediate check
        if (isLoadingRef.current) {
            console.log('ProfileNotifications: Already loading, skipping duplicate call');
            return;
        }
        
        isLoadingRef.current = true;
        setIsLoadingData(true);
        setLoading(true);
        try {
            const offset = (pageNum - 1) * limit;
            console.log(`ProfileNotifications: Loading page ${pageNum}, offset ${offset}`);
            const res = await authFetch(`/api/user/notifications?limit=${limit}&offset=${offset}`);
            if (res.ok) {
                const data = await res.json();
                setItems(data.notifications || []);
                setUnread(data.unread_count || 0);
                setTotal(data.metadata?.total_notifications || 0);
            } else {
                console.error('ProfileNotifications: API request failed', res.status, res.statusText);
            }
        } catch (e) { 
            console.error('ProfileNotifications: Failed to load notifications', e); 
        } finally { 
            setLoading(false);
            setIsLoadingData(false);
            isLoadingRef.current = false;
        }
    }, [userId]);

    // Load initial data when component mounts or when initialData changes
    useEffect(() => {
        if (userId && (!initialData?.notifications || initialData?.notifications?.length === 0) && !hasTriedInitialLoad && !isLoadingRef.current) {
            setHasTriedInitialLoad(true);
            load(1);
        }
    }, [userId, initialData, load, hasTriedInitialLoad]);

    // Fallback: Load data if no initial data is provided after a short delay
    useEffect(() => {
        if (userId && !initialData && !hasTriedInitialLoad && !isLoadingRef.current) {
            const timer = setTimeout(() => {
                setHasTriedInitialLoad(true);
                load(1);
            }, 1000);
            return () => clearTimeout(timer);
        }
    }, [userId, initialData, load, hasTriedInitialLoad]);

    useEffect(() => {
        // Load data when page changes (for pagination)
        if (page > 1) {
            load(page);
        }
    }, [page, load]);

    useEffect(() => {
        const refreshHandler = () => load(1);
        window.addEventListener('notifications:refresh', refreshHandler as any);
        return () => window.removeEventListener('notifications:refresh', refreshHandler as any);
    }, [load]);

    useEffect(() => {
        const supabase = createClient();
        if (!supabase || !userId) return;
        const channel = supabase
            .channel(`profile-notifications-${userId}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` }, 
            () => { load(page); }
        ).subscribe();
        return () => { try { supabase.removeChannel(channel) } catch {} };
    }, [userId, load, page]);

    const markOne = async (id: string) => {
        try {
            const res = await authFetch(`/api/user/notifications/${id}/read`, { method: 'POST' });
            if (res.ok) {
                setItems(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
                setUnread((u: number) => Math.max(0, u - 1));
            }
        } catch {}
    };


    const totalPages = Math.max(1, Math.ceil(total / limit));

    return (
        <Card role="region" aria-labelledby="notifications-title" id="notifications">
            <CardHeader className="!pb-0 h-[120px] sm:h-auto !grid-rows-1 items-center overflow-hidden">
                <div className="flex items-center justify-between h-full">
                    <div className="min-w-0">
                        <CardTitle id="notifications-title" className="text-lg truncate">Notifications</CardTitle>
                        <CardDescription className="truncate">Your latest updates</CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" className="min-h-[44px]" onClick={async () => {
                            try {
                                await authFetch('/api/user/notifications/mark-all-read', { method: 'POST' });
                                toast.success('All notifications marked as read');
                                window.dispatchEvent(new CustomEvent('notifications:refresh'));
                            } catch {}
                        }}>
                            Mark all read
                        </Button>
                        <Button variant="destructive" size="sm" className="min-h-[44px]" onClick={async () => {
                            try {
                                if (!confirm('Are you sure you want to clear all notifications?')) return;
                                await authFetch('/api/user/notifications/clear-all', { method: 'POST' });
                                toast.success('All notifications cleared');
                                window.dispatchEvent(new CustomEvent('notifications:cleared'));
                                window.dispatchEvent(new CustomEvent('notifications:refresh'));
                            } catch {}
                        }}>
                            Clear all
                        </Button>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                <div className="space-y-2 h-[70vh] overflow-y-auto sm:h-auto">
                    {loading ? (
                        <div className="space-y-2">
                            {Array.from({ length: limit }).map((_, i) => (
                                <div key={i} className="p-3 rounded-lg border bg-white">
                                    <div className="animate-pulse space-y-2">
                                        <div className="h-4 bg-gray-200 rounded w-1/2" />
                                        <div className="h-3 bg-gray-100 rounded w-3/4" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : items.length === 0 ? (
                        <div className="text-center text-gray-500 py-6">
                            <div className="text-sm">No notifications yet</div>
                            <div className="text-xs text-gray-400 mt-1">Check back later for updates</div>
                        </div>
                    ) : (
                        items.map((n) => (
                            <div key={n.id} className={`p-3 rounded-lg border ${n.read ? 'bg-white' : 'bg-blue-50 border-blue-200'}`}>
                                <div className="flex items-start gap-3">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <p className="text-sm font-medium truncate">{n.title}</p>
                                            {!n.read && <span className="w-2 h-2 bg-blue-600 rounded-full" />}
                                        </div>
                                        <p className="text-xs text-gray-600 mt-1">{n.message}</p>
                                    </div>
                                    {!n.read && (
                                        <Button size="sm" variant="ghost" className="text-xs" onClick={() => markOne(n.id)}>Mark read</Button>
                                    )}
                                </div>
                            </div>
                        ))
                    )}
                </div>
                <div className="flex items-center justify-between pt-2">
                    <Button variant="outline" size="sm" disabled={page <= 1 || loading} onClick={() => setPage((p) => Math.max(1, p - 1))}>Previous</Button>
                    <span className="text-xs text-muted-foreground">Page {page} of {totalPages}</span>
                    <Button variant="outline" size="sm" disabled={page >= totalPages || loading} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>Next</Button>
                </div>
            </CardContent>
        </Card>
    );
};