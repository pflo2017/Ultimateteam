# Supabase Setup Guide

This guide explains how to set up the Supabase backend for the Ultimate Team application.

## Setup Steps

1. Create a new Supabase project at [https://app.supabase.com](https://app.supabase.com)

2. Once your project is created, go to Project Settings > API to find your:
   - Project URL (`EXPO_PUBLIC_SUPABASE_URL`)
   - Project API Key (`EXPO_PUBLIC_SUPABASE_ANON_KEY`)

3. Copy these values to your `.env` file in the root directory of the project.

4. Go to the SQL Editor in your Supabase dashboard.

5. Copy the contents of `schema.sql` and execute it in the SQL Editor.

## Database Schema

### Tables

#### admin_profiles
- `id`: UUID (Primary Key)
- `user_id`: UUID (Foreign Key to auth.users)
- `club_name`: TEXT
- `club_location`: TEXT
- `admin_name`: TEXT
- `club_logo`: TEXT (URL)
- `created_at`: TIMESTAMP
- `updated_at`: TIMESTAMP

### Storage

#### club-logos bucket
- Public bucket for storing club logo images
- Accepts .jpg, .jpeg, and .png files
- Maximum file size: 2MB
- Public read access
- Authenticated write access

## Security Policies

### Row Level Security (RLS)

The following policies are implemented:

#### admin_profiles table
- Users can only view all admin profiles
- Users can only create their own profile
- Users can only update their own profile
- Users can only delete their own profile

#### Storage
- Anyone can view club logos
- Only authenticated users can upload club logos
- Users can only update/delete their own uploaded logos

## Authentication

The project uses Supabase Auth with email/password authentication for administrators.

## Environment Variables

Make sure to set up the following environment variables in your `.env` file:

```bash
EXPO_PUBLIC_SUPABASE_URL=your_project_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
``` 