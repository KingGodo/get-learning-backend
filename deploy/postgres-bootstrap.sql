-- Run as the postgres superuser if getlearning_db already exists:
--   sudo -u postgres psql -f deploy/postgres-bootstrap.sql
--
-- Creates an app role that can use getlearning_db over 127.0.0.1.
-- Change CHANGE_ME before running.

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'getleaning') THEN
    CREATE ROLE getleaning LOGIN PASSWORD 'CHANGE_ME';
  END IF;
END
$$;

GRANT ALL PRIVILEGES ON DATABASE getlearning_db TO getleaning;
ALTER DATABASE getlearning_db OWNER TO getleaning;

\c getlearning_db

GRANT ALL ON SCHEMA public TO getleaning;
ALTER SCHEMA public OWNER TO getleaning;
