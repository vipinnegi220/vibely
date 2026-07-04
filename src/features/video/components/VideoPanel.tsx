import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Mic, MicOff, Video, VideoOff, Maximize2 } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { cn } from '@/lib/utils';

interface VideoPanelProps {
    localStream: MediaStream | null;
    remoteStream: MediaStream | null;
    camOn: boolean;
    micOn: boolean;
    onToggleCam: () => void;
    onToggleMic: () => void;
    partnerNickname?: string;
}

function VideoEl({ stream, muted = false, className }: { stream: MediaStream | null; muted?: boolean; className?: string }) {
    const ref = useRef<HTMLVideoElement>(null);
    useEffect(() => {
        if (ref.current && stream) {
            ref.current.srcObject = stream;
        }
    }, [stream]);

    return (
        <video
            ref={ref}
            autoPlay
            playsInline
            muted={muted}
            className={cn('w-full h-full object-cover', className)}
        />
    );
}

export function VideoPanel({ localStream, remoteStream, camOn, micOn, onToggleCam, onToggleMic, partnerNickname }: VideoPanelProps) {
    const containerRef = useRef<HTMLDivElement>(null);

    function toggleFullscreen() {
        if (!document.fullscreenElement) {
            containerRef.current?.requestFullscreen();
        } else {
            document.exitFullscreen();
        }
    }

    return (
        <div ref={containerRef} className="relative w-full h-full bg-zinc-900 rounded-2xl overflow-hidden">
            {/* Remote video (main) */}
            {remoteStream ? (
                <VideoEl stream={remoteStream} className="absolute inset-0" />
            ) : (
                <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-center text-zinc-500">
                        <Video className="h-12 w-12 mx-auto mb-2 opacity-30" />
                        <p className="text-sm">Waiting for video...</p>
                    </div>
                </div>
            )}

            {/* Partner name */}
            {partnerNickname && (
                <div className="absolute top-3 left-3 px-3 py-1 rounded-full bg-black/50 text-white text-sm backdrop-blur-sm">
                    {partnerNickname}
                </div>
            )}

            {/* Local video (PiP) */}
            <motion.div
                drag
                dragConstraints={containerRef}
                className="absolute bottom-16 right-3 w-28 h-20 sm:w-36 sm:h-24 rounded-xl overflow-hidden border-2 border-white/20 shadow-xl cursor-grab active:cursor-grabbing z-10"
            >
                {camOn && localStream ? (
                    <VideoEl stream={localStream} muted className="scale-x-[-1]" />
                ) : (
                    <div className="w-full h-full bg-zinc-800 flex items-center justify-center">
                        <VideoOff className="h-5 w-5 text-zinc-500" />
                    </div>
                )}
            </motion.div>

            {/* Controls */}
            <div className="absolute bottom-3 left-0 right-0 flex items-center justify-center gap-3 z-10">
                <Button
                    size="icon"
                    variant={micOn ? 'secondary' : 'destructive'}
                    className="rounded-full shadow-lg"
                    onClick={onToggleMic}
                >
                    {micOn ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
                </Button>
                <Button
                    size="icon"
                    variant={camOn ? 'secondary' : 'destructive'}
                    className="rounded-full shadow-lg"
                    onClick={onToggleCam}
                >
                    {camOn ? <Video className="h-4 w-4" /> : <VideoOff className="h-4 w-4" />}
                </Button>
                <Button
                    size="icon"
                    variant="secondary"
                    className="rounded-full shadow-lg"
                    onClick={toggleFullscreen}
                >
                    <Maximize2 className="h-4 w-4" />
                </Button>
            </div>
        </div>
    );
}
