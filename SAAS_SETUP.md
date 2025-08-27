# Meetily SaaS Setup Guide

This guide will help you transform your Meetily project into a SaaS application using Supabase for authentication and PostgreSQL database.

## Prerequisites

1. A Supabase account and project
2. Your existing Meetily project
3. Anthropic API key for Claude Sonnet 4

## Step 1: Database Setup

### 1.1 Create Supabase Project
1. Go to [Supabase](https://supabase.com)
2. Create a new project
3. Note down your project URL and keys

### 1.2 Run Database Schema
Execute the `database.sql` file in your Supabase SQL editor to create all necessary tables and policies.

## Step 2: Environment Configuration

### 2.1 Frontend Environment Variables
Create `frontend/.env.local`:
```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

### 2.2 Backend Environment Variables
Create `backend/.env`:
```bash
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_JWT_SECRET=your-jwt-secret
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
ANTHROPIC_API_KEY=your-anthropic-api-key
```

## Step 3: Install Dependencies

### 3.1 Frontend
```bash
cd frontend
pnpm install
```

### 3.2 Backend
```bash
cd backend
pip install -r requirements.txt
```

## Step 4: Deploy

### 4.1 Backend with Docker
```bash
cd backend
docker-compose -f docker-compose.saas.yml up -d
```

### 4.2 Frontend (Tauri Development)
```bash
cd frontend
pnpm run tauri dev
```

## Key Changes Made

### Authentication
- ✅ Added Supabase authentication with JWT token validation
- ✅ User registration with organization creation
- ✅ Protected all API endpoints with authentication middleware

### API Key Management
- ✅ Removed user API key input fields
- ✅ Hardcoded Claude 3.5 Sonnet as the AI model
- ✅ Centralized API key management (environment variable)

### Database Schema
- ✅ Multi-tenant architecture with organizations
- ✅ Row Level Security (RLS) policies
- ✅ User profiles linked to Supabase auth
- ✅ Meeting isolation by organization

### Frontend Updates
- ✅ Login/Signup modal components
- ✅ Authentication guard for protected routes
- ✅ Updated settings to show account info instead of API keys
- ✅ Sign out functionality

### Backend Updates
- ✅ JWT token validation middleware
- ✅ User context in all API endpoints
- ✅ Removed API key configuration endpoints
- ✅ Hardcoded Claude Sonnet 4 model

## Supabase Configuration

### Enable Email Authentication
1. Go to Authentication > Settings
2. Enable email authentication
3. Configure email templates if needed

### Create Organization on User Signup
You can add a trigger in Supabase to automatically create an organization when a user signs up:

```sql
-- Function to handle user signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    org_id UUID;
BEGIN
    -- Create organization
    INSERT INTO organizations (name, slug)
    VALUES (
        COALESCE(NEW.raw_user_meta_data->>'organization_name', 'My Organization'),
        LOWER(REPLACE(COALESCE(NEW.raw_user_meta_data->>'organization_name', 'my-organization'), ' ', '-'))
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

-- Trigger on user creation
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION handle_new_user();
```

## Testing

1. Start the backend: `docker-compose -f docker-compose.saas.yml up -d`
2. Start the frontend: `pnpm run tauri dev`
3. Try signing up with a new account
4. Create a meeting and test the AI summarization

## Production Deployment

### Backend
- Deploy using Docker with proper environment variables
- Use a production PostgreSQL database (Supabase provides this)
- Set up proper logging and monitoring

### Frontend
- Build the Tauri app: `pnpm run tauri build`
- Distribute the built application

## Security Considerations

- ✅ All API endpoints are protected with authentication
- ✅ Database uses Row Level Security (RLS)
- ✅ JWT tokens are validated on every request
- ✅ API keys are managed server-side only
- ✅ Multi-tenant isolation at the database level

Your Meetily project is now a fully functional SaaS application with user authentication, multi-tenancy, and centralized AI model management!
