-- Supabase Schema for Meeting Minutes SaaS
-- This file contains the complete database schema for the SaaS version

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Organizations table (multi-tenant support)
CREATE TABLE organizations (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    subscription_status VARCHAR(50) DEFAULT 'trial',
    subscription_tier VARCHAR(50) DEFAULT 'basic',
    stripe_customer_id VARCHAR(255),
    stripe_subscription_id VARCHAR(255),
    trial_ends_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Users table (extends Supabase auth.users)
CREATE TABLE user_profiles (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    full_name VARCHAR(255),
    role VARCHAR(50) DEFAULT 'member',
    avatar_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Meetings table (updated for multi-tenant)
CREATE TABLE meetings (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE NOT NULL,
    title VARCHAR(500) NOT NULL,
    description TEXT,
    status VARCHAR(50) DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Transcripts table (updated for multi-tenant)
CREATE TABLE transcripts (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    meeting_id UUID REFERENCES meetings(id) ON DELETE CASCADE NOT NULL,
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
    transcript TEXT NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    summary TEXT,
    action_items TEXT,
    key_points TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Summary processes table (updated for multi-tenant)
CREATE TABLE summary_processes (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    meeting_id UUID REFERENCES meetings(id) ON DELETE CASCADE NOT NULL,
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    result JSONB,
    error TEXT,
    start_time TIMESTAMP WITH TIME ZONE,
    end_time TIMESTAMP WITH TIME ZONE,
    chunk_count INTEGER DEFAULT 0,
    processing_time REAL DEFAULT 0.0,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Transcript chunks table (updated for multi-tenant)
CREATE TABLE transcript_chunks (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    meeting_id UUID REFERENCES meetings(id) ON DELETE CASCADE NOT NULL,
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
    meeting_name VARCHAR(500),
    transcript_text TEXT NOT NULL,
    model VARCHAR(100) NOT NULL,
    model_name VARCHAR(100) NOT NULL,
    chunk_size INTEGER,
    overlap INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Settings table (organization-specific settings)
CREATE TABLE organization_settings (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
    provider VARCHAR(100) NOT NULL,
    model VARCHAR(100) NOT NULL,
    whisper_model VARCHAR(100) NOT NULL,
    api_keys JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(organization_id)
);

-- Transcript settings table (organization-specific)
CREATE TABLE transcript_settings (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
    provider VARCHAR(100) NOT NULL,
    model VARCHAR(100) NOT NULL,
    api_keys JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(organization_id)
);

-- Usage tracking table for billing
CREATE TABLE usage_tracking (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE NOT NULL,
    resource_type VARCHAR(50) NOT NULL, -- 'meeting', 'transcript', 'summary'
    resource_id UUID,
    usage_amount INTEGER DEFAULT 1,
    billing_period DATE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Subscription plans table
CREATE TABLE subscription_plans (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(50) UNIQUE NOT NULL,
    price_monthly INTEGER NOT NULL, -- in cents
    price_yearly INTEGER NOT NULL, -- in cents
    stripe_price_id_monthly VARCHAR(255),
    stripe_price_id_yearly VARCHAR(255),
    features JSONB NOT NULL DEFAULT '{}',
    limits JSONB NOT NULL DEFAULT '{}', -- meeting_limit, transcript_hours, etc.
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default subscription plans
INSERT INTO subscription_plans (name, slug, price_monthly, price_yearly, features, limits) VALUES
('Basic', 'basic', 999, 9990,
 '{"ai_summaries": true, "basic_transcription": true, "email_support": true}',
 '{"meetings_per_month": 50, "transcript_hours_per_month": 10, "storage_gb": 5}'
),
('Pro', 'pro', 2999, 29990,
 '{"ai_summaries": true, "advanced_transcription": true, "priority_support": true, "api_access": true, "custom_models": true}',
 '{"meetings_per_month": 200, "transcript_hours_per_month": 50, "storage_gb": 50}'
),
('Enterprise', 'enterprise', 9999, 99990,
 '{"ai_summaries": true, "advanced_transcription": true, "dedicated_support": true, "api_access": true, "custom_models": true, "sso": true, "custom_integrations": true}',
 '{"meetings_per_month": -1, "transcript_hours_per_month": -1, "storage_gb": 500}'
);

-- Row Level Security (RLS) Policies

-- Enable RLS on all tables
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE transcripts ENABLE ROW LEVEL SECURITY;
ALTER TABLE summary_processes ENABLE ROW LEVEL SECURITY;
ALTER TABLE transcript_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE transcript_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_plans ENABLE ROW LEVEL SECURITY;

-- User profiles policies
CREATE POLICY "Users can view their own profile" ON user_profiles
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile" ON user_profiles
    FOR UPDATE USING (auth.uid() = id);

-- Organization policies
CREATE POLICY "Users can view their organization" ON organizations
    FOR SELECT USING (
        id IN (
            SELECT organization_id
            FROM user_profiles
            WHERE id = auth.uid()
        )
    );

-- Meetings policies
CREATE POLICY "Users can view meetings in their organization" ON meetings
    FOR SELECT USING (
        organization_id IN (
            SELECT organization_id
            FROM user_profiles
            WHERE id = auth.uid()
        )
    );

CREATE POLICY "Users can insert meetings in their organization" ON meetings
    FOR INSERT WITH CHECK (
        organization_id IN (
            SELECT organization_id
            FROM user_profiles
            WHERE id = auth.uid()
        )
        AND user_id = auth.uid()
    );

CREATE POLICY "Users can update their own meetings" ON meetings
    FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own meetings" ON meetings
    FOR DELETE USING (user_id = auth.uid());

-- Transcripts policies
CREATE POLICY "Users can view transcripts in their organization" ON transcripts
    FOR SELECT USING (
        organization_id IN (
            SELECT organization_id
            FROM user_profiles
            WHERE id = auth.uid()
        )
    );

CREATE POLICY "Users can insert transcripts in their organization" ON transcripts
    FOR INSERT WITH CHECK (
        organization_id IN (
            SELECT organization_id
            FROM user_profiles
            WHERE id = auth.uid()
        )
    );

-- Similar policies for other tables...
CREATE POLICY "Users can view summary processes in their organization" ON summary_processes
    FOR SELECT USING (
        organization_id IN (
            SELECT organization_id
            FROM user_profiles
            WHERE id = auth.uid()
        )
    );

CREATE POLICY "Users can insert summary processes in their organization" ON summary_processes
    FOR INSERT WITH CHECK (
        organization_id IN (
            SELECT organization_id
            FROM user_profiles
            WHERE id = auth.uid()
        )
    );

CREATE POLICY "Users can update summary processes in their organization" ON summary_processes
    FOR UPDATE USING (
        organization_id IN (
            SELECT organization_id
            FROM user_profiles
            WHERE id = auth.uid()
        )
    );

-- Transcript chunks policies
CREATE POLICY "Users can view transcript chunks in their organization" ON transcript_chunks
    FOR SELECT USING (
        organization_id IN (
            SELECT organization_id
            FROM user_profiles
            WHERE id = auth.uid()
        )
    );

CREATE POLICY "Users can insert transcript chunks in their organization" ON transcript_chunks
    FOR INSERT WITH CHECK (
        organization_id IN (
            SELECT organization_id
            FROM user_profiles
            WHERE id = auth.uid()
        )
    );

-- Settings policies
CREATE POLICY "Users can view their organization settings" ON organization_settings
    FOR SELECT USING (
        organization_id IN (
            SELECT organization_id
            FROM user_profiles
            WHERE id = auth.uid() AND role IN ('admin', 'owner')
        )
    );

CREATE POLICY "Admins can update organization settings" ON organization_settings
    FOR UPDATE USING (
        organization_id IN (
            SELECT organization_id
            FROM user_profiles
            WHERE id = auth.uid() AND role IN ('admin', 'owner')
        )
    );

-- Usage tracking policies
CREATE POLICY "Users can view usage in their organization" ON usage_tracking
    FOR SELECT USING (
        organization_id IN (
            SELECT organization_id
            FROM user_profiles
            WHERE id = auth.uid()
        )
    );

-- Subscription plans are public (read-only)
CREATE POLICY "Anyone can view subscription plans" ON subscription_plans
    FOR SELECT USING (is_active = true);

-- Functions and triggers for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Add triggers for updated_at
CREATE TRIGGER update_organizations_updated_at BEFORE UPDATE ON organizations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_user_profiles_updated_at BEFORE UPDATE ON user_profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_meetings_updated_at BEFORE UPDATE ON meetings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_summary_processes_updated_at BEFORE UPDATE ON summary_processes FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_organization_settings_updated_at BEFORE UPDATE ON organization_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_transcript_settings_updated_at BEFORE UPDATE ON transcript_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_subscription_plans_updated_at BEFORE UPDATE ON subscription_plans FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Indexes for performance
CREATE INDEX idx_meetings_organization_id ON meetings(organization_id);
CREATE INDEX idx_meetings_user_id ON meetings(user_id);
CREATE INDEX idx_meetings_created_at ON meetings(created_at DESC);
CREATE INDEX idx_transcripts_meeting_id ON transcripts(meeting_id);
CREATE INDEX idx_transcripts_organization_id ON transcripts(organization_id);
CREATE INDEX idx_summary_processes_meeting_id ON summary_processes(meeting_id);
CREATE INDEX idx_summary_processes_organization_id ON summary_processes(organization_id);
CREATE INDEX idx_transcript_chunks_meeting_id ON transcript_chunks(meeting_id);
CREATE INDEX idx_transcript_chunks_organization_id ON transcript_chunks(organization_id);
CREATE INDEX idx_usage_tracking_organization_id ON usage_tracking(organization_id);
CREATE INDEX idx_usage_tracking_billing_period ON usage_tracking(billing_period);
CREATE INDEX idx_user_profiles_organization_id ON user_profiles(organization_id);
