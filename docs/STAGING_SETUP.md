# Staging Environment Setup

This document explains how to set up and use the staging environment for Ultimate Team development.

## Overview

The staging environment allows you to:
- Test new features safely
- Use a separate database for development
- Avoid affecting production data
- Share working demos with stakeholders

## Setup Instructions

### 1. Create Staging Supabase Project

1. Go to [https://app.supabase.com](https://app.supabase.com)
2. Click "New Project"
3. Name: `UltimateTeam-Staging`
4. Choose region and set password
5. Wait for project creation

### 2. Get Staging Credentials

1. Go to your staging project dashboard
2. Navigate to Settings → API
3. Copy the Project URL and anon public key

### 3. Update Environment Variables

Edit your `.env` file and add:

```bash
# --- Staging Environment ---
STAGING_SUPABASE_URL=https://your-staging-project.supabase.co
STAGING_SUPABASE_ANON_KEY=your-staging-anon-key
```

### 4. Set Up Staging Database

Run the setup script:
```bash
./scripts/setup-staging-db.sh
```

Then manually:
1. Go to SQL Editor in your staging project
2. Run all migrations from `supabase/migrations/`
3. Set up Row Level Security policies
4. Create test data

### 5. Start Staging Environment

```bash
# Start staging version
./scripts/start-staging.sh

# Or start production version
./scripts/start-production.sh
```

## Environment Differences

| Feature | Production | Staging |
|---------|------------|---------|
| App Name | "Ultimate Team" | "Ultimate Team (Staging)" |
| Bundle ID | `com.ultimateteam.app` | `com.ultimateteam.app.staging` |
| Database | Production Supabase | Staging Supabase |
| Data | Real user data | Test data only |

## Best Practices

1. **Never use production data in staging**
2. **Create realistic test data** for development
3. **Test all features** in staging before production
4. **Use staging for demos** and client presentations
5. **Keep staging database clean** - delete test data regularly

## Switching Environments

- **For development**: Use staging environment
- **For testing with real data**: Use production environment
- **For demos**: Use staging environment with test data

## Troubleshooting

### Staging app shows "Missing Supabase configuration"
- Check that `STAGING_SUPABASE_URL` and `STAGING_SUPABASE_ANON_KEY` are set in `.env`
- Verify the credentials are correct

### Database connection fails
- Check that your staging Supabase project is active
- Verify the URL and key are correct
- Ensure the database schema is set up

### App doesn't start
- Make sure you're using the correct script (`start-staging.sh` vs `start-production.sh`)
- Check that the config file exists 