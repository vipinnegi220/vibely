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

    // Get local media
    useEffect(() => {
        if (!enabled) return;
        let stream: MediaStream;

        navigator.mediaDevices
            .getUserMedia({ video: true, audio: true })
            .then((s) => {
                stream = s;
                setLocalStream(s);
            })
            .catch(() => {
                // fallback: audio only
                navigator.mediaDevices
                    .getUserMedia({ video: false, audio: true })
                    .then((s) => { stream = s; setLocalStream(s); })
                    .catch(() => { /* no media */ });
            });

        return () => {
            stream?.getTracks().forEach((t) => t.stop());
        };
    }, [enabled]);

    // Start WebRTC when we have match + local stream
    useEffect(() => {
        if (!matchId || !userId || !partnerId || !localStream || !enabled) return;

        const isInitiator = userId < partnerId; // deterministic initiator
        const svc = new WebRTCService(matchId, userId, setRemoteStream, setConnectionState);
        webrtcRef.current = svc;
        svc.start(localStream, isInitiator);

        return () => {
            svc.destroy();
            webrtcRef.current = null;
        };
    }, [matchId, userId, partnerId, localStream, enabled]);

    const toggleCam = useCallback(() => {
        localStream?.getVideoTracks().forEach((t) => {
            t.enabled = !t.enabled;
        });
        setCamOn((v) => !v);
    }, [localStream]);

    const toggleMic = useCallback(() => {
        localStream?.getAudioTracks().forEach((t) => {
            t.enabled = !t.enabled;
        });
        setMicOn((v) => !v);
    }, [localStream]);

    const stopAll = useCallback(() => {
        localStream?.getTracks().forEach((t) => t.stop());
        setLocalStream(null);
        setRemoteStream(null);
        webrtcRef.current?.destroy();
        webrtcRef.current = null;
    }, [localStream]);

    return { localStream, remoteStream, camOn, micOn, connectionState, toggleCam, toggleMic, stopAll };
}
