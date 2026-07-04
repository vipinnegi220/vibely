import { motion } from 'framer-motion';
import { Zap } from 'lucide-react';
import { Skeleton } from '@/shared/components/ui/skeleton';

// Placeholder — will be built in Phase 2
export default function ChatPage() {
    return (
        <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-6 p-4">
            <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center"
            >
                <div className="h-12 w-12 rounded-xl bg-vibely-600 flex items-center justify-center mx-auto mb-4">
                    <Zap className="h-6 w-6 text-white" />
                </div>
                <h1 className="text-2xl font-bold mb-2">Finding someone...</h1>
                <p className="text-muted-foreground text-sm">Setting up your chat experience</p>
            </motion.div>
            <div className="w-full max-w-3xl space-y-3">
                <Skeleton className="h-64 w-full rounded-2xl" />
                <div className="flex gap-2">
                    <Skeleton className="h-12 flex-1 rounded-xl" />
                    <Skeleton className="h-12 w-12 rounded-xl" />
                </div>
            </div>
        </div>
    );
}
