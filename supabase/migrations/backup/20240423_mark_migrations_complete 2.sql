-- Mark existing migrations as completed
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES 
    ('20240423_add_coach_to_teams', '20240423_add_coach_to_teams.sql', ''),
    ('20240423_create_coaches_table', '20240423_create_coaches_table.sql', ''),
    ('20240423_create_players_table', '20240423_create_players_table.sql', '')
ON CONFLICT (version) DO NOTHING; 