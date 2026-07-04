import { motion } from 'framer-motion';
import { Zap } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';

interface SearchingScreenProps {
    onCancel: () => void;
}

export function SearchingScreen({ onCancel }: SearchingScreenProps) {
    return (
        <div className="flex flex-col items-center justify-center h-full gap-6 p-8">
            <div className="relative">
                {/* Pulse rings */}
                {[1, 2, 3].map((i) => (
                    <span
                        key={i}
                        className="absolute inset-0 rounded-full border-2 border-vibely-600/40 animate-ping"
                        style={{ animationDelay: `${i * 0.4}s`, animationDuration: '2s' }}
                    />
                ))}
                <motion.div
                    animate={{ scale: [1, 1.05, 1] }}
                    transition={{ repeat: Infinity, duration: 2 }}
                    className="relative h-16 w-16 rounded-full bg-vibely-600 flex items-center justify-center shadow-lg shadow-vibely-600/30"
                >
                    <Zap className="h-7 w-7 text-white" />
                </motion.div>
            </div>

            <div className="text-center">
                <h2 className="text-xl font-semibold mb-1">Finding someone...</h2>
                <p className="text-sm text-muted-foreground">Looking for a match worldwide</p>
            </div>

            <Button variant="outline" size="sm" onClick={onCancel}>
                Cancel
            </Button>
        </div>
    );
}
