-- =============================================================================
-- Target Database Initialization Script
-- Creates the matching schema for the CDC migration target.
-- No sample data is inserted; all data arrives via the CDC consumer.
-- =============================================================================

-- Enable pgcrypto for UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- -------------------------
-- Users table (matches source schema)
-- -------------------------
CREATE TABLE IF NOT EXISTS users (
    id              BIGSERIAL PRIMARY KEY,
    uuid            UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
    username        VARCHAR(100) NOT NULL UNIQUE,
    email           VARCHAR(255) NOT NULL UNIQUE,
    password_hash   VARCHAR(255) NOT NULL,
    full_name       VARCHAR(200),
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    role            VARCHAR(50) NOT NULL DEFAULT 'customer',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users (email);
CREATE INDEX idx_users_username ON users (username);
CREATE INDEX idx_users_role ON users (role);

-- -------------------------
-- Orders table (matches source schema)
-- -------------------------
CREATE TABLE IF NOT EXISTS orders (
    id              BIGSERIAL PRIMARY KEY,
    uuid            UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
    user_id         BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    order_number    VARCHAR(50) NOT NULL UNIQUE,
    status          VARCHAR(30) NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded')),
    total_amount    NUMERIC(12, 2) NOT NULL CHECK (total_amount >= 0),
    currency        VARCHAR(3) NOT NULL DEFAULT 'USD',
    shipping_address JSONB,
    notes           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_orders_user_id ON orders (user_id);
CREATE INDEX idx_orders_status ON orders (status);
CREATE INDEX idx_orders_order_number ON orders (order_number);
CREATE INDEX idx_orders_created_at ON orders (created_at);

-- -------------------------
-- Updated-at trigger function
-- -------------------------
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_orders_updated_at
    BEFORE UPDATE ON orders
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- -------------------------
-- CDC tracking table
-- Stores the last processed Kafka offset per topic-partition for idempotency.
-- -------------------------
CREATE TABLE IF NOT EXISTS _cdc_offsets (
    topic           VARCHAR(255) NOT NULL,
    partition_id    INTEGER NOT NULL,
    committed_offset BIGINT NOT NULL,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (topic, partition_id)
);
