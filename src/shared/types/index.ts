export * from './database';

export interface AppError {
    message: string;
    code?: string;
}

export type Theme = 'light' | 'dark' | 'system';

export type ChatType = 'text' | 'video';

export type ConnectionStatus = 'idle' | 'searching' | 'connected' | 'disconnected' | 'error';
