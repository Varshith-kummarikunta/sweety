-- Sweety: Blood Glucose Tracker - Database Schema

-- Enable UUID extension if required (PostgreSQL 13+ includes gen_random_uuid natively)
-- CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Users Table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Case-insensitive unique index for emails
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_lower ON users (LOWER(email));

-- 2. Readings Table
CREATE TABLE IF NOT EXISTS readings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reading_date DATE NOT NULL,
  time_slot VARCHAR(50) NOT NULL CHECK (
    time_slot IN (
      'Morning (fasting)',
      'After breakfast',
      'After lunch',
      'After dinner'
    )
  ),
  value INTEGER NOT NULL CHECK (value >= 40 AND value <= 600),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_user_reading_slot UNIQUE (user_id, reading_date, time_slot)
);

-- Performance Indexes for user and date-based queries & reporting
CREATE INDEX IF NOT EXISTS idx_readings_user_id ON readings (user_id);
CREATE INDEX IF NOT EXISTS idx_readings_user_date ON readings (user_id, reading_date);
CREATE INDEX IF NOT EXISTS idx_readings_user_created ON readings (user_id, created_at);
