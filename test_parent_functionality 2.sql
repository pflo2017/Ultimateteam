-- Test parent phone number check function
SELECT check_parent_phone('+40721234567') as phone_exists;

-- Try to insert a test parent
INSERT INTO public.parents (name, phone_number, password)
VALUES ('Test Parent', '+40721234567', 'test123')
RETURNING id, name, phone_number, phone_verified, is_active;

-- Test phone verification function
SELECT verify_parent_phone('+40721234567') as phone_verified;

-- Test password verification function
SELECT verify_parent_password('+40721234567', 'test123') as parent_id; 