-- Supabase trigger to automatically create organization and user profile on signup
-- Run this in your Supabase SQL editor

-- Function to handle user signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    org_id UUID;
    org_slug TEXT;
BEGIN
    -- Generate organization slug from name
    org_slug := LOWER(REPLACE(
        COALESCE(NEW.raw_user_meta_data->>'organization_name', 'my-organization'),
        ' ', '-'
    ));

    -- Ensure slug is unique by appending timestamp if needed
    IF EXISTS (SELECT 1 FROM organizations WHERE slug = org_slug) THEN
        org_slug := org_slug || '-' || EXTRACT(EPOCH FROM NOW())::TEXT;
    END IF;

    -- Create organization
    INSERT INTO organizations (name, slug, subscription_status, subscription_tier)
    VALUES (
        COALESCE(NEW.raw_user_meta_data->>'organization_name', 'My Organization'),
        org_slug,
        'trial',
        'basic'
    )
    RETURNING id INTO org_id;

    -- Create user profile
    INSERT INTO user_profiles (id, organization_id, email, full_name, role)
    VALUES (
        NEW.id,
        org_id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
        'owner'
    );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on user creation
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Function to handle user deletion (cleanup)
CREATE OR REPLACE FUNCTION handle_user_delete()
RETURNS TRIGGER AS $$
BEGIN
    -- Delete user profile (this will cascade to delete organization if user is owner)
    DELETE FROM user_profiles WHERE id = OLD.id;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on user deletion
DROP TRIGGER IF EXISTS on_auth_user_deleted ON auth.users;
CREATE TRIGGER on_auth_user_deleted
    AFTER DELETE ON auth.users
    FOR EACH ROW EXECUTE FUNCTION handle_user_delete();
