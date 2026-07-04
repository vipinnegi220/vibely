-- Vibely Database Schema
-- Version 1.0

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Profiles Table
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    nickname TEXT NOT NULL,
    gender TEXT CHECK (gender IN ('male', 'female', 'other')),
    age INTEGER CHECK (age >= 13 AND age <= 120),
    country TEXT,
    interests TEXT[] DEFAULT '{}',
    avatar_url TEXT,
    is_online BOOLEAN DEFAULT false,
    last_seen TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Waiting Queue Table
CREATE TABLE IF NOT EXISTS public.waiting_queue (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    gender_filter TEXT DEFAULT 'any' CHECK (gender_filter IN ('male', 'female', 'any')),
    country_filter TEXT,
    interests TEXT[] DEFAULT '{}',
    chat_type TEXT DEFAULT 'video' CHECK (chat_type IN ('text', 'video')),
    joined_at TIMESTAMPTZ DEFAULT NOW()
);

-- Matches Table
CREATE TABLE IF NOT EXISTS public.matches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user1_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    user2_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    chat_type TEXT DEFAULT 'video' CHECK (chat_type IN ('text', 'video')),
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'ended')),
    started_at TIMESTAMPTZ DEFAULT NOW(),
    ended_at TIMESTAMPTZ,
    CONSTRAINT different_users CHECK (user1_id != user2_id)
);

-- Messages Table
CREATE TABLE IF NOT EXISTS public.messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    match_id UUID NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Reports Table
CREATE TABLE IF NOT EXISTS public.reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    reporter_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    reported_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    reason TEXT NOT NULL,
    details TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Blocks Table
CREATE TABLE IF NOT EXISTS public.blocks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    blocker_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    blocked_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(blocker_id, blocked_id)
);

-- User Preferences Table
CREATE TABLE IF NOT EXISTS public.user_preferences (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE UNIQUE,
    theme TEXT DEFAULT 'system' CHECK (theme IN ('light', 'dark', 'system')),
    notifications_enabled BOOLEAN DEFAULT true,
    sound_enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for Performance
CREATE INDEX IF NOT EXISTS idx_profiles_is_online ON public.profiles(is_online);
CREATE INDEX IF NOT EXISTS idx_waiting_queue_user_id ON public.waiting_queue(user_id);
CREATE INDEX IF NOT EXISTS idx_waiting_queue_chat_type ON public.waiting_queue(chat_type);
CREATE INDEX IF NOT EXISTS idx_matches_user1 ON public.matches(user1_id);
CREATE INDEX IF NOT EXISTS idx_matches_user2 ON public.matches(user2_id);
CREATE INDEX IF NOT EXISTS idx_matches_status ON public.matches(status);
CREATE INDEX IF NOT EXISTS idx_messages_match_id ON public.messages(match_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON public.messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_blocks_blocker ON public.blocks(blocker_id);
CREATE INDEX IF NOT EXISTS idx_blocks_blocked ON public.blocks(blocked_id);

-- Function: Update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers
CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_preferences_updated_at
    BEFORE UPDATE ON public.user_preferences
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.waiting_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Profiles
CREATE POLICY "Users can view any profile" ON public.profiles
    FOR SELECT USING (true);

CREATE POLICY "Users can update own profile" ON public.profiles
    FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON public.profiles
    FOR INSERT WITH CHECK (auth.uid() = id);

-- RLS Policies: Waiting Queue
CREATE POLICY "Users can view own queue entries" ON public.waiting_queue
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own queue entries" ON public.waiting_queue
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own queue entries" ON public.waiting_queue
    FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies: Matches
CREATE POLICY "Users can view own matches" ON public.matches
    FOR SELECT USING (auth.uid() = user1_id OR auth.uid() = user2_id);

CREATE POLICY "Users can update own matches" ON public.matches
    FOR UPDATE USING (auth.uid() = user1_id OR auth.uid() = user2_id);

-- RLS Policies: Messages
CREATE POLICY "Users can view messages in their matches" ON public.messages
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.matches
            WHERE matches.id = messages.match_id
            AND (matches.user1_id = auth.uid() OR matches.user2_id = auth.uid())
        )
    );

CREATE POLICY "Users can insert messages in their matches" ON public.messages
    FOR INSERT WITH CHECK (
        auth.uid() = sender_id AND
        EXISTS (
            SELECT 1 FROM public.matches
            WHERE matches.id = match_id
            AND (matches.user1_id = auth.uid() OR matches.user2_id = auth.uid())
            AND matches.status = 'active'
        )
    );

-- RLS Policies: Reports
CREATE POLICY "Users can insert reports" ON public.reports
    FOR INSERT WITH CHECK (auth.uid() = reporter_id);

-- RLS Policies: Blocks
CREATE POLICY "Users can view own blocks" ON public.blocks
    FOR SELECT USING (auth.uid() = blocker_id);

CREATE POLICY "Users can insert own blocks" ON public.blocks
    FOR INSERT WITH CHECK (auth.uid() = blocker_id);

CREATE POLICY "Users can delete own blocks" ON public.blocks
    FOR DELETE USING (auth.uid() = blocker_id);

-- RLS Policies: User Preferences
CREATE POLICY "Users can view own preferences" ON public.user_preferences
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own preferences" ON public.user_preferences
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own preferences" ON public.user_preferences
    FOR INSERT WITH CHECK (auth.uid() = user_id);
