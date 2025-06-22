SELECT pg_type.typname, pg_enum.enumlabel FROM pg_type JOIN pg_enum ON pg_enum.enumtypid = pg_type.oid WHERE pg_type.typname = 'payment_status_type';
