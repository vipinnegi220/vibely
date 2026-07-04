import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/shared/components/ui/button';

export default function NotFoundPage() {
    const navigate = useNavigate();
    return (
        <div className="min-h-screen bg-background flex items-center justify-center p-4">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-center"
            >
                <p className="text-8xl font-bold text-vibely-600 mb-4">404</p>
                <h1 className="text-2xl font-semibold mb-2">Page not found</h1>
                <p className="text-muted-foreground mb-8">The page you're looking for doesn't exist.</p>
                <Button variant="vibely" onClick={() => navigate('/')}>
                    Go home
                </Button>
            </motion.div>
        </div>
    );
}
