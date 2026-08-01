import { useState, useEffect, useRef, useCallback } from 'react';
import { WebRTCService } from '../services/webrtcService';

interface UseVideoOptions {
    matchId: string | null;
    userId: string | null;
    partnerId: string | null;
    enabled: boolean;
}

export function useVideo({ matchId, userId, partnerId, enabled }: UseVideoOptions) {
    const [localStream, setLocalStream] = useState<MediaStream | null>(null);
    const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
    const [camOn, setCamOn] = useState(true);
    const [micOn, setMicOn] = useState(true);
    const [connectionState, setConnectionState] = useState<RTCPeerConnectionState>('new');
    const webrtcRef = useRef<WebRTCService | null>(null);
    const streamRef = useRef<MediaStream | null>(null);

    // Get local media when enabled
    useEffect(() => {
        if (!enabled) {
            streamRef.current?.getTracks().forEach((t) => t.stop());
            streamRef.current = null;
            setLocalStream(null);
            return;
        }

        let cancelled = false;

        async function getMedia() {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
                if (!cancelled) {
                    streamRef.current = stream;
                    setLocalStream(stream);
                    setCamOn(true);
                    setMicOn(true);
                } else {
                    stream.getTracks().forEach((t) => t.stop());
                }
            } catch {
                try {
                    const stream = await navigator.mediaDevices.getUserMedia({ video: false, audio: true });
                    if (!cancelled) {
                        streamRef.current = stream;
                        setLocalStream(stream);
                        setCamOn(false);
                        setMicOn(true);
                    } else {
                        stream.getTracks().forEach((t) => t.stop());
                    }
                } catch {
                    console.warn('[video] no media devices available');
                }
            }
        }

        getMedia();
        return () => { cancelled = true; };
    }, [enabled]);

    // Start/restart WebRTC when matchId, userId, partnerId, or localStream changes
    // Using matchId+userId+partnerId as the key ensures a fresh peer connection
    // whenever we switch to video mid-call
    useEffect(() => {
        // Destroy any existing connection first
        if (webrtcRef.current) {
            webrtcRef.current.destroy();
            webrtcRef.current = null;
            setRemoteStream(null);
            setConnectionState('new');
        }

        if (!matchId || !userId || !partnerId || !localStream || !enabled) return;

        const isInitiator = userId < partnerId;
        console.log('[video] starting WebRTC, isInitiator:', isInitiator, 'matchId:', matchId);

        const svc = new WebRTCService(matchId, userId, setRemoteStream, setConnectionState);
        webrtcRef.current = svc;
        svc.start(localStream, isInitiator);

        return () => {
            svc.destroy();
            webrtcRef.current = null;
            setRemoteStream(null);
            setConnectionState('new');
        };
    }, [matchId, userId, partnerId, localStream, enabled]);

    const toggleCam = useCallback(() => {
        const tracks = streamRef.current?.getVideoTracks();
        if (!tracks?.length) return;
        const next = !tracks[0].enabled;
        tracks.forEach((t) => { t.enabled = next; });
        setCamOn(next);
    }, []);

    const toggleMic = useCallback(() => {
        const tracks = streamRef.current?.getAudioTracks();
        if (!tracks?.length) return;
        const next = !tracks[0].enabled;
        tracks.forEach((t) => { t.enabled = next; });
        setMicOn(next);
    }, []);

    const stopAll = useCallback(() => {
        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        setLocalStream(null);
        setRemoteStream(null);
        webrtcRef.current?.destroy();
        webrtcRef.current = null;
        setConnectionState('new');
    }, []);

    return { localStream, remoteStream, camOn, micOn, connectionState, toggleCam, toggleMic, stopAll };
}
