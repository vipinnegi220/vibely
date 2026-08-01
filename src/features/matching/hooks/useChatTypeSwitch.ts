import { useEffect, useCallback } from 'react';
import { matchingService } from '../services/matchingService';
import type { ChatType } from '@/shared/types';

interface UseChatTypeSwitchOptions {
    matchId: string | null;
    userId: string | null;
    onPartnerSwitched: (newType: ChatType) => void;
}

export function useChatTypeSwitch({ matchId, userId, onPartnerSwitched }: UseChatTypeSwitchOptions) {
    useEffect(() => {
        if (!matchId || !userId) return;
        const unsub = matchingService.subscribeToTypeSwitch(matchId, userId, onPartnerSwitched);
        return () => {
            unsub();
        };
    }, [matchId, userId, onPartnerSwitched]);

    const switchType = useCallback(async (newType: ChatType) => {
        if (!matchId || !userId) return;
        await matchingService.broadcastTypeSwitch(matchId, userId, newType);
    }, [matchId, userId]);

    return { switchType };
}
