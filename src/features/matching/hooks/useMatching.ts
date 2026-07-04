import { useState, useCallback, useRef, useEffect } from 'react';
import { matchingService } from '../services/matchingService';
import { useAuthStore } from '@/features/auth/store/authStore';
import type { Match, ConnectionStatus, ChatType } from '@/shared/types';

interface UseMatchingReturn {
    status: ConnectionStatus;
    match: Match | null;
    chatType: ChatType;
    setChatType: (t: ChatType) => void;
    startSearching: () => void;
    stopSearching: () => void;
    skipPartner: () => void;
}

export function useMatching(): UseMatchingReturn {
    const { user } = useAuthStore();
    const [status, setStatus] = useState<ConnectionStatus>('idle');
    const [match, setMatch] = useState<Match | null>(null);
    const [chatType, setChatType] = useState<ChatType>('video');
    const unsubRef = useRef<(() => void) | null>(null);
    const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const cleanup = useCallback(() => {
        if (unsubRef.current) { unsubRef.current(); unsubRef.current = null; }
        if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    }, []);

    const startSearching = useCallback(async () => {
        if (!user) return;
        setStatus('searching');
        setMatch(null);

        try {
            await matchingService.joinQueue(user.id, chatType);

            // Subscribe to realtime match events
            unsubRef.current = matchingService.subscribeToQueue(user.id, (newMatch) => {
                cleanup();
                setMatch(newMatch);
                setStatus('connected');
            });

            // Also poll every 2s as fallback
            pollRef.current = setInterval(async () => {
                const found = await matchingService.findMatch(user.id, chatType);
                if (found) {
                    cleanup();
                    setMatch(found);
                    setStatus('connected');
                }
            }, 2000);
        } catch {
            setStatus('error');
        }
    }, [user, chatType, cleanup]);

    const stopSearching = useCallback(async () => {
        if (!user) return;
        cleanup();
        await matchingService.leaveQueue(user.id);
        setStatus('idle');
        setMatch(null);
    }, [user, cleanup]);

    const skipPartner = useCallback(async () => {
        if (!user || !match) return;
        cleanup();
        await matchingService.endMatch(match.id);
        setMatch(null);
        // Re-enter queue
        startSearching();
    }, [user, match, cleanup, startSearching]);

    // Cleanup on unmount
    useEffect(() => () => cleanup(), [cleanup]);

    return { status, match, chatType, setChatType, startSearching, stopSearching, skipPartner };
}
