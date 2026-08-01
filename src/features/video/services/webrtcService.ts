import { supabase } from '@/lib/supabase';

const ICE_SERVERS: RTCIceServer[] = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    {
        urls: 'turn:openrelay.metered.ca:80',
        username: 'openrelayproject',
        credential: 'openrelayproject',
    },
    {
        urls: 'turn:openrelay.metered.ca:443',
        username: 'openrelayproject',
        credential: 'openrelayproject',
    },
];

type SignalPayload =
    | { type: 'offer'; sdp: string; from: string }
    | { type: 'answer'; sdp: string; from: string }
    | { type: 'ice'; candidate: RTCIceCandidateInit; from: string };

export class WebRTCService {
    private pc: RTCPeerConnection | null = null;
    private signalingChannel: ReturnType<typeof supabase.channel> | null = null;
    private matchId: string;
    private userId: string;
    private onRemoteStream: (stream: MediaStream) => void;
    private onConnectionChange: (state: RTCPeerConnectionState) => void;
    private pendingCandidates: RTCIceCandidateInit[] = [];
    private remoteDescSet = false;

    constructor(
        matchId: string,
        userId: string,
        onRemoteStream: (stream: MediaStream) => void,
        onConnectionChange: (state: RTCPeerConnectionState) => void
    ) {
        this.matchId = matchId;
        this.userId = userId;
        this.onRemoteStream = onRemoteStream;
        this.onConnectionChange = onConnectionChange;
    }

    async start(localStream: MediaStream, isInitiator: boolean) {
        this.pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

        // Add local tracks
        localStream.getTracks().forEach((t) => this.pc!.addTrack(t, localStream));

        // Handle remote stream
        const remoteStream = new MediaStream();
        this.pc.ontrack = (e) => {
            e.streams[0]?.getTracks().forEach((t) => remoteStream.addTrack(t));
            this.onRemoteStream(remoteStream);
        };

        this.pc.onconnectionstatechange = () => {
            if (this.pc) {
                console.log('[webrtc] connection state:', this.pc.connectionState);
                this.onConnectionChange(this.pc.connectionState);
            }
        };

        this.pc.oniceconnectionstatechange = () => {
            console.log('[webrtc] ICE state:', this.pc?.iceConnectionState);
        };

        // Set up signaling BEFORE creating offer/answer
        await this.setupSignaling();

        this.pc.onicecandidate = (e) => {
            if (e.candidate) {
                this.send({ type: 'ice', candidate: e.candidate.toJSON(), from: this.userId });
            }
        };

        if (isInitiator) {
            console.log('[webrtc] creating offer as initiator');
            const offer = await this.pc.createOffer({
                offerToReceiveAudio: true,
                offerToReceiveVideo: true,
            });
            await this.pc.setLocalDescription(offer);
            this.send({ type: 'offer', sdp: offer.sdp!, from: this.userId });
        }
    }

    private setupSignaling(): Promise<void> {
        return new Promise((resolve) => {
            const channel = supabase
                .channel(`webrtc:${this.matchId}`)
                .on('broadcast', { event: 'signal' }, async ({ payload }) => {
                    const signal = payload as SignalPayload;
                    if (signal.from === this.userId) return; // ignore own signals

                    console.log('[webrtc] received signal:', signal.type);

                    if (signal.type === 'offer') {
                        await this.pc!.setRemoteDescription({ type: 'offer', sdp: signal.sdp });
                        this.remoteDescSet = true;
                        await this.flushPendingCandidates();
                        const answer = await this.pc!.createAnswer();
                        await this.pc!.setLocalDescription(answer);
                        this.send({ type: 'answer', sdp: answer.sdp!, from: this.userId });
                    } else if (signal.type === 'answer') {
                        await this.pc!.setRemoteDescription({ type: 'answer', sdp: signal.sdp });
                        this.remoteDescSet = true;
                        await this.flushPendingCandidates();
                    } else if (signal.type === 'ice') {
                        if (this.remoteDescSet) {
                            try { await this.pc!.addIceCandidate(signal.candidate); } catch { /* ignore */ }
                        } else {
                            this.pendingCandidates.push(signal.candidate);
                        }
                    }
                })
                .subscribe((status) => {
                    console.log('[webrtc] signaling channel:', status);
                    if (status === 'SUBSCRIBED') resolve();
                });

            this.signalingChannel = channel;
        });
    }

    private async flushPendingCandidates() {
        for (const c of this.pendingCandidates) {
            try { await this.pc!.addIceCandidate(c); } catch { /* ignore */ }
        }
        this.pendingCandidates = [];
    }

    private send(payload: SignalPayload) {
        this.signalingChannel?.send({
            type: 'broadcast',
            event: 'signal',
            payload,
        });
    }

    replaceTrack(newTrack: MediaStreamTrack) {
        const sender = this.pc?.getSenders().find((s) => s.track?.kind === newTrack.kind);
        sender?.replaceTrack(newTrack);
    }

    destroy() {
        this.pc?.close();
        this.pc = null;
        if (this.signalingChannel) {
            supabase.removeChannel(this.signalingChannel);
            this.signalingChannel = null;
        }
    }
}
