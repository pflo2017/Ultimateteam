# UltimateTeam Master Admin Dashboard

This is a web-based administration dashboard for UltimateTeam that allows master administrators to:

1. View and manage all clubs using the app
2. Enable/disable club access
3. Track billing and payments
4. Generate invoices based on player counts

## Setup Instructions

### Prerequisites

- Node.js 16+ installed
- Yarn or NPM package manager
- Access to the UltimateTeam Supabase project

### Installation

1. Install dependencies:

```bash
cd admin-dashboard
npm install
# or
yarn install
```

2. Create a `.env` file in the root directory with your Supabase credentials:

```
REACT_APP_SUPABASE_URL=https://ulltpjezntzgiawchmaj.supabase.co
REACT_APP_SUPABASE_ANON_KEY=your-anon-key
```

3. Run the development server:

```bash
npm start
# or
yarn start
```

4. Open [http://localhost:3000](http://localhost:3000) to view the dashboard

## Database Setup

The dashboard requires specific tables and functions to be set up in your Supabase database. Run the migration file:

```
supabase/migrations/20250615_add_club_access_control.sql
```

This migration adds:

- `is_access_enabled` column to the clubs table
- `club_payment_history` table for tracking invoices and payments
- `master_admins` table for dashboard administrators
- Required views and functions

## Creating a Master Admin

To access the dashboard, you need to create a master admin user:

1. Create a regular user through Supabase Auth
2. Connect to your database and run:

```sql
INSERT INTO master_admins (user_id, email, name, is_super_admin)
VALUES ('user-id-from-auth', 'admin@example.com', 'Admin Name', true);
```

## Dashboard Features

- **Clubs Management**: View all clubs, their status, player counts, and toggle access
- **Billing**: Generate invoices, track payments, and view payment history
- **Reports**: View statistics on app usage, player counts, and payment rates
- **Settings**: Manage master admin accounts and dashboard configuration

## Implementation Notes

- The dashboard uses the same Supabase backend as the mobile app
- Access control is managed through Row Level Security policies
- The dashboard is completely separate from the mobile app codebase 