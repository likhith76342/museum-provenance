CREATE EXTENSION IF NOT EXISTS vector;      -- pgvector: vector type + similarity operators
CREATE EXTENSION IF NOT EXISTS pgcrypto;    -- crypt()/gen_salt() for bcrypt password hashes
CREATE EXTENSION IF NOT EXISTS btree_gist;  -- needed for the ownership no-overlap exclusion constraint
