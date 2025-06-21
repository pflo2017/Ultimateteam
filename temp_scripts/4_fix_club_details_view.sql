-- First check current club_details view definition
SELECT pg_get_viewdef('public.club_details', true);

-- Drop and recreate the club_details view without auth.users reference
DROP VIEW IF EXISTS public.club_details;

CREATE VIEW public.club_details AS
SELECT 
    c.id,
    c.name,
    c.city,
    COALESCE(c.country, ''::text) AS country,
    c.description,
    c.email,
    c.phone_number,
    c.logo_url,
    c.is_suspended,
    c.admin_id,
    c.created_at,
    ap.admin_name,
    -- Remove the auth.users reference by only using admin_email from admin_profiles
    COALESCE(ap.admin_email, NULL) AS admin_email,
    c.city || 
        CASE
            WHEN c.country IS NOT NULL AND c.country <> ''::text THEN ', '::text || c.country
            ELSE ''::text
        END AS location
FROM clubs c
LEFT JOIN admin_profiles ap ON c.admin_id = ap.user_id;

-- Important: Check your application functionality after applying this change! 