#!/bin/bash

# Source the .env file to load environment variables
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
fi

echo "🗄️  Setting up Staging Database..."

# Check if staging credentials are set
if [ -z "$STAGING_SUPABASE_URL" ] || [ -z "$STAGING_SUPABASE_ANON_KEY" ]; then
    echo "❌ Error: STAGING_SUPABASE_URL and STAGING_SUPABASE_ANON_KEY must be set in your .env file"
    echo "Please add your staging Supabase credentials to .env file:"
    echo "STAGING_SUPABASE_URL=https://your-staging-project.supabase.co"
    echo "STAGING_SUPABASE_ANON_KEY=your-staging-anon-key"
    exit 1
fi

echo "✅ Staging credentials found"
echo "📋 Next steps:"
echo "1. Go to your staging Supabase project dashboard"
echo "2. Go to SQL Editor"
echo "3. Run the SQL migrations from supabase/migrations/"
echo "4. Set up Row Level Security (RLS) policies"
echo "5. Create test data"

echo ""
echo "🔗 Staging Dashboard: $STAGING_SUPABASE_URL"
echo "📝 You can find your SQL migrations in: supabase/migrations/" 