-- The dev admin user is NOT seeded here with a hardcoded hash.
-- It is created at application startup by
-- com.onetutor.config.DataSeeder, which uses the real Spring
-- Security PasswordEncoder bean so the hash always matches the
-- app's current hashing configuration. See DataSeeder.java for
-- the dev credentials.

INSERT INTO categories (name, description, status)
VALUES
    ('Web Development', 'Frontend, backend, and full-stack web courses', 'active'),
    ('Data & Analytics', 'Data analysis, SQL, and analytics courses', 'active')
ON CONFLICT DO NOTHING;
