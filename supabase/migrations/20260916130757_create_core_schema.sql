/*
# Reviyo Core Database Schema

## Overview
Creates the foundational database tables for Reviyo, an AI-assisted Google review
platform for small businesses. This migration creates all core tables with proper
constraints, indexes, and relationships.

## New Tables

1. **profiles** — Extends Supabase auth.users with role information
   - id (uuid, PK, references auth.users)
   - email (text, not null)
   - full_name (text, nullable)
   - role (text, 'user' or 'admin', default 'user')
   - created_at, updated_at (timestamps)

2. **businesses** — Business registered on the platform
   - id (uuid, PK)
   - owner_id (uuid, references auth.users)
   - name, slug (unique), category, logo_url, google_review_url, welcome_message
   - is_active (boolean, default true)
   - created_at, updated_at

3. **review_topics** — Configurable tags for customer review flow
   - id (uuid, PK)
   - business_id (uuid, references businesses)
   - label, display_order, active
   - created_at

4. **review_sessions** — Anonymous customer review sessions
   - id (uuid, PK)
   - business_id (uuid, references businesses)
   - session_token (uuid, unique per session for anonymous identification)
   - rating (1-5), customer_comment, generated_review, status
   - created_at, updated_at

5. **review_session_topics** — Join table for sessions and selected topics
   - review_session_id, topic_id (composite PK)

6. **private_feedback** — Private feedback from customers to business
   - id (uuid, PK)
   - business_id, review_session_id, rating, message, status (new/seen/resolved)
   - created_at

7. **analytics_events** — Event tracking for customer flow
   - id (uuid, PK)
   - business_id, review_session_id, event_type, metadata (jsonb)
   - created_at

8. **subscriptions** — Business subscription plans
   - id (uuid, PK)
   - business_id, plan (6_months/12_months), status (trial/active/expired/cancelled)
   - starts_at, expires_at, payment_reference
   - created_at, updated_at

9. **ai_generation_log** — Rate limiting for AI generation
   - id (uuid, PK)
   - business_id, review_session_id, created_at

## Indexes
- Unique slug lookup on businesses
- Owner lookup on businesses
- Business-scoped queries on all child tables
- Event type and date filtering on analytics_events
- Session token lookup on review_sessions

## Notes
- RLS policies and SECURITY DEFINER functions are added in a follow-up migration.
- All primary keys use UUIDs via gen_random_uuid().
- Foreign keys use ON DELETE CASCADE for cleanup when parent records are removed.
*/

-- Profiles table (extends auth.users)
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  full_name text,
  role text NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Businesses table
CREATE TABLE IF NOT EXISTS businesses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  category text NOT NULL,
  logo_url text,
  google_review_url text,
  welcome_message text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Review topics table
CREATE TABLE IF NOT EXISTS review_topics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  label text NOT NULL,
  display_order int NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Review sessions table
CREATE TABLE IF NOT EXISTS review_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  session_token uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  rating int CHECK (rating >= 1 AND rating <= 5),
  customer_comment text,
  generated_review text,
  status text NOT NULL DEFAULT 'started' CHECK (status IN ('started', 'rated', 'topics_selected', 'comment_added', 'review_generated', 'completed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Review session topics join table
CREATE TABLE IF NOT EXISTS review_session_topics (
  review_session_id uuid NOT NULL REFERENCES review_sessions(id) ON DELETE CASCADE,
  topic_id uuid NOT NULL REFERENCES review_topics(id) ON DELETE CASCADE,
  PRIMARY KEY (review_session_id, topic_id)
);

-- Private feedback table
CREATE TABLE IF NOT EXISTS private_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  review_session_id uuid REFERENCES review_sessions(id) ON DELETE SET NULL,
  rating int CHECK (rating >= 1 AND rating <= 5),
  message text NOT NULL,
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'seen', 'resolved')),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Analytics events table
CREATE TABLE IF NOT EXISTS analytics_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  review_session_id uuid REFERENCES review_sessions(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Subscriptions table
CREATE TABLE IF NOT EXISTS subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  plan text NOT NULL CHECK (plan IN ('6_months', '12_months')),
  status text NOT NULL DEFAULT 'trial' CHECK (status IN ('trial', 'active', 'expired', 'cancelled')),
  starts_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  payment_reference text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- AI generation log table (for rate limiting)
CREATE TABLE IF NOT EXISTS ai_generation_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  review_session_id uuid REFERENCES review_sessions(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_businesses_slug ON businesses(slug);
CREATE INDEX IF NOT EXISTS idx_businesses_owner ON businesses(owner_id);
CREATE INDEX IF NOT EXISTS idx_review_topics_business ON review_topics(business_id);
CREATE INDEX IF NOT EXISTS idx_review_sessions_business ON review_sessions(business_id);
CREATE INDEX IF NOT EXISTS idx_review_sessions_token ON review_sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_review_session_topics_session ON review_session_topics(review_session_id);
CREATE INDEX IF NOT EXISTS idx_private_feedback_business ON private_feedback(business_id);
CREATE INDEX IF NOT EXISTS idx_private_feedback_status ON private_feedback(status);
CREATE INDEX IF NOT EXISTS idx_analytics_events_business ON analytics_events(business_id);
CREATE INDEX IF NOT EXISTS idx_analytics_events_type ON analytics_events(event_type);
CREATE INDEX IF NOT EXISTS idx_analytics_events_created ON analytics_events(created_at);
CREATE INDEX IF NOT EXISTS idx_subscriptions_business ON subscriptions(business_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_ai_gen_log_business ON ai_generation_log(business_id);
CREATE INDEX IF NOT EXISTS idx_ai_gen_log_session ON ai_generation_log(review_session_id);
CREATE INDEX IF NOT EXISTS idx_ai_gen_log_created ON ai_generation_log(created_at);
