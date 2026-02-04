-- =============================================================================
-- Source Database Initialization Script
-- Creates the schema and populates sample data for the CDC migration source.
-- =============================================================================

-- Enable pgcrypto for UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- -------------------------
-- Users table
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
-- Orders table
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
-- Sample data: Users
-- -------------------------
INSERT INTO users (username, email, password_hash, full_name, is_active, role) VALUES
    ('alice.johnson',   'alice@example.com',    '$2b$12$LJ3m4ys2Kq9Zv0r5N1u0xOHgRfYbKj8Wp3nXqDm7TsZ1vF4aBC12', 'Alice Johnson',    TRUE,  'admin'),
    ('bob.smith',       'bob@example.com',      '$2b$12$Qw3e4r5t6y7u8i9o0pLkJhGfDsAzXcVbNm1234567890AbCdEfGh', 'Bob Smith',        TRUE,  'customer'),
    ('carol.williams',  'carol@example.com',    '$2b$12$Mn0b9v8c7x6z5a4s3d2f1gHjKlQwErTyUiOpZxCvBnMaSdFgHjKl', 'Carol Williams',   TRUE,  'customer'),
    ('dave.brown',      'dave@example.com',     '$2b$12$Pl0o9i8u7y6t5r4e3w2q1aZxSwEdCrFvTgByHnUjMiKoLpQaWsXe', 'Dave Brown',       TRUE,  'customer'),
    ('eve.davis',       'eve@example.com',      '$2b$12$Zx1c2v3b4n5m6a7s8d9f0gHjKlQwErTyUiOpMnBvCxZaSdFgHjKl', 'Eve Davis',        FALSE, 'customer'),
    ('frank.miller',    'frank@example.com',    '$2b$12$Rt5y6u7i8o9p0qWeRtYuIoPlKjHgFdSaZxCvBnMqWeRtYuIoPlKj', 'Frank Miller',     TRUE,  'support'),
    ('grace.wilson',    'grace@example.com',    '$2b$12$Yh8j9k0l1zXcVbNm2qWeRtYuIoPlKjHgFdSaZxCvBnMqWeRtYuIo', 'Grace Wilson',     TRUE,  'customer'),
    ('henry.moore',     'henry@example.com',    '$2b$12$Ui7y6t5r4e3w2q1pOlKjHgFdSaZxCvBnMqWeRtYuIoPlKjHgFdSa', 'Henry Moore',      TRUE,  'customer'),
    ('ivy.taylor',      'ivy@example.com',      '$2b$12$Bn3m4a5s6d7f8g9h0jKlQwErTyUiOpMnBvCxZaSdFgHjKlQwErTy', 'Ivy Taylor',       TRUE,  'customer'),
    ('jack.anderson',   'jack@example.com',     '$2b$12$Cv4b5n6m7q8w9e0rTyUiOpLkJhGfDsAzXcVbNmQwErTyUiOpLkJh', 'Jack Anderson',    TRUE,  'customer');

-- -------------------------
-- Sample data: Orders
-- -------------------------
INSERT INTO orders (user_id, order_number, status, total_amount, currency, shipping_address, notes) VALUES
    (2, 'ORD-2026-0001', 'delivered',   149.99, 'USD', '{"street": "123 Main St", "city": "Portland", "state": "OR", "zip": "97201", "country": "US"}', NULL),
    (2, 'ORD-2026-0002', 'shipped',      59.50, 'USD', '{"street": "123 Main St", "city": "Portland", "state": "OR", "zip": "97201", "country": "US"}', 'Leave at front door'),
    (3, 'ORD-2026-0003', 'confirmed',   299.00, 'USD', '{"street": "456 Oak Ave", "city": "Seattle", "state": "WA", "zip": "98101", "country": "US"}', NULL),
    (4, 'ORD-2026-0004', 'pending',      42.75, 'USD', '{"street": "789 Pine Rd", "city": "Denver", "state": "CO", "zip": "80201", "country": "US"}', 'Gift wrap requested'),
    (4, 'ORD-2026-0005', 'processing',  175.00, 'EUR', '{"street": "789 Pine Rd", "city": "Denver", "state": "CO", "zip": "80201", "country": "US"}', NULL),
    (7, 'ORD-2026-0006', 'delivered',    89.99, 'USD', '{"street": "321 Elm Blvd", "city": "Austin", "state": "TX", "zip": "73301", "country": "US"}', NULL),
    (7, 'ORD-2026-0007', 'cancelled',    34.50, 'USD', '{"street": "321 Elm Blvd", "city": "Austin", "state": "TX", "zip": "73301", "country": "US"}', 'Customer requested cancellation'),
    (8, 'ORD-2026-0008', 'shipped',     450.00, 'USD', '{"street": "654 Birch Ln", "city": "Chicago", "state": "IL", "zip": "60601", "country": "US"}', NULL),
    (9, 'ORD-2026-0009', 'pending',      22.99, 'GBP', '{"street": "10 Downing St", "city": "London", "postcode": "SW1A 2AA", "country": "GB"}', NULL),
    (10, 'ORD-2026-0010', 'confirmed',  199.99, 'USD', '{"street": "987 Cedar Ct", "city": "Miami", "state": "FL", "zip": "33101", "country": "US"}', 'Expedited shipping');

-- -------------------------
-- Publication for Debezium logical replication
-- -------------------------
CREATE PUBLICATION dbz_publication FOR TABLE users, orders;
