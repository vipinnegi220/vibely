export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

export interface Database {
    public: {
        Tables: {
            profiles: {
                Row: {
                    id: string;
                    nickname: string;
                    gender: 'male' | 'female' | 'other' | null;
                    age: number | null;
                    country: string | null;
                    interests: string[];
                    avatar_url: string | null;
                    is_online: boolean;
                    last_seen: string;
                    created_at: string;
                    updated_at: string;
                };
                Insert: {
                    id: string;
                    nickname: string;
                    gender?: 'male' | 'female' | 'other' | null;
                    age?: number | null;
                    country?: string | null;
                    interests?: string[];
                    avatar_url?: string | null;
                    is_online?: boolean;
                    last_seen?: string;
                };
                Update: Partial<Database['public']['Tables']['profiles']['Insert']>;
            };
            waiting_queue: {
                Row: {
                    id: string;
                    user_id: string;
                    gender_filter: 'male' | 'female' | 'any';
                    country_filter: string | null;
                    interests: string[];
                    chat_type: 'text' | 'audio' | 'video';
                    joined_at: string;
                };
                Insert: Omit<Database['public']['Tables']['waiting_queue']['Row'], 'joined_at'>;
                Update: Partial<Database['public']['Tables']['waiting_queue']['Insert']>;
            };
            matches: {
                Row: {
                    id: string;
                    user1_id: string;
                    user2_id: string;
                    chat_type: 'text' | 'audio' | 'video';
                    status: 'active' | 'ended';
                    started_at: string;
                    ended_at: string | null;
                };
                Insert: Omit<Database['public']['Tables']['matches']['Row'], 'started_at'>;
                Update: Partial<Database['public']['Tables']['matches']['Insert']>;
            };
            messages: {
                Row: {
                    id: string;
                    match_id: string;
                    sender_id: string;
                    content: string;
                    created_at: string;
                };
                Insert: Omit<Database['public']['Tables']['messages']['Row'], 'created_at'>;
                Update: never;
            };
            reports: {
                Row: {
                    id: string;
                    reporter_id: string;
                    reported_id: string;
                    reason: string;
                    details: string | null;
                    created_at: string;
                };
                Insert: Omit<Database['public']['Tables']['reports']['Row'], 'created_at'>;
                Update: never;
            };
            blocks: {
                Row: {
                    id: string;
                    blocker_id: string;
                    blocked_id: string;
                    created_at: string;
                };
                Insert: Omit<Database['public']['Tables']['blocks']['Row'], 'created_at'>;
                Update: never;
            };
            user_preferences: {
                Row: {
                    id: string;
                    user_id: string;
                    theme: 'light' | 'dark' | 'system';
                    notifications_enabled: boolean;
                    sound_enabled: boolean;
                    created_at: string;
                    updated_at: string;
                };
                Insert: Omit<Database['public']['Tables']['user_preferences']['Row'], 'created_at' | 'updated_at'>;
                Update: Partial<Database['public']['Tables']['user_preferences']['Insert']>;
            };
        };
        Views: Record<string, never>;
        Functions: Record<string, never>;
        Enums: Record<string, never>;
    };
}

// Convenience type aliases
export type Profile = Database['public']['Tables']['profiles']['Row'];
export type WaitingQueue = Database['public']['Tables']['waiting_queue']['Row'];
export type Match = Database['public']['Tables']['matches']['Row'];
export type Message = Database['public']['Tables']['messages']['Row'];
export type Report = Database['public']['Tables']['reports']['Row'];
export type Block = Database['public']['Tables']['blocks']['Row'];
export type UserPreferences = Database['public']['Tables']['user_preferences']['Row'];
