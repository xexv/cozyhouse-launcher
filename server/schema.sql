-- SQL Schema for Cloudflare D1 Database (Cozy House Launcher & Server)

-- Users Table: Stores account credentials, Minecraft UUID, and profile info
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    uuid TEXT UNIQUE NOT NULL,
    skin_url TEXT DEFAULT NULL,
    balance_coins INTEGER DEFAULT 0,
    role TEXT DEFAULT 'user',
    created_at INTEGER NOT NULL
);

-- Sessions Table: Stores active launcher tokens for client-server handshake
CREATE TABLE IF NOT EXISTS sessions (
    access_token TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    client_token TEXT NOT NULL,
    expires_at INTEGER NOT NULL,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_uuid ON users(uuid);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
