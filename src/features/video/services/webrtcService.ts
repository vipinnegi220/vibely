import { supabase } from '@/lib/supabase';

const ICE_SERVERS: RTCIceServer[] = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
];

type SignalPayload =
    | { type: 'offer'; sdp: string }
    | { type: 'answer'; sdp: string }
    | { type: 'ice'; candidate: RTCIceCandidateInit };

export class WebRTCService {
    private pc: RTCPeerConnection | null = null;
    private channel: ReturnType<typeof supabase.channel> | null = null;
    private matchId: string;
    private userId: string;
    private onRemoteStream: (stream: MediaStream) => void;
    private onConnectionChange: (state: RTCPeerConnectionState) => void;

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

        // Remote stream
        const remoteStream = new MediaStream();
        this.pc.ontrack = (e) => {
            e.streams[0]?.getTracks().forEach((t) => remoteStream.addTrack(t));
            this.onRemoteStream(remoteStream);
        };

        // Connection state
        this.pc.onconnectionstatechange = () => {
            if (this.pc) this.onConnectionChange(this.pc.connectionState);
        };

        // Signaling channel via Supabase Broadcast
        this.channel = supabase.channel(`webrtc:${this.matchId}`);

        this.channel.on('broadcast', { event: 'signal' }, async ({ payload }) => {
            const signal = payload as SignalPayload & { from: string };
            if (signal.from === this.userId) return; // ignore own signals

            if (signal.type === 'offer') {
                await this.pc!.setRemoteDescription({ type: 'offer', sdp: signal.sdp });
                const answer = await this.pc!.createAnswer();
                await this.pc!.setLocalDescription(answer);
                this.send({ type: 'answer', sdp: answer.sdp! });
            } else if (signal.type === 'answer') {
                await this.pc!.setRemoteDescription({ type: 'answer', sdp: signal.sdp });
            } else if (signal.type === 'ice') {
                try { await this.pc!.addIceCandidate(signal.candidate); } catch { /* ignore */ }
            }
        });

        await new Promise<void>((resolve) => this.channel!.subscribe(() => resolve()));

        // ICE candidates
        this.pc.onicecandidate = (e) => {
            if (e.candidate) this.send({ type: 'ice', candidate: e.candidate.toJSON() });
        };

        // Initiator creates the offer
        if (isInitiator) {
            const offer = await this.pc.createOffer();
            await this.pc.setLocalDescription(offer);
            this.send({ type: 'offer', sdp: offer.sdp! });
        }
    }

    private send(payload: SignalPayload) {
        this.channel?.send({
            type: 'broadcast',
            event: 'signal',
            payload: { ...payload, from: this.userId },
        });
    }

    replaceTrack(newTrack: MediaStreamTrack) {
        const sender = this.pc?.getSenders().find((s) => s.track?.kind === newTrack.kind);
        sender?.replaceTrack(newTrack);
    }

    destroy() {
        this.pc?.close();
        this.pc = null;
        if (this.channel) supabase.removeChannel(this.channel);
        this.channel = null;
    }
}
