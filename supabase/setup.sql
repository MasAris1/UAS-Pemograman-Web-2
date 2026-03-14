-- Clean setup script for Hotel Reservation System
-- Run this in Supabase SQL Editor

-- ============================================
-- STEP 1: Drop existing tables (CLEAN SLATE)
-- WARNING: This deletes all data!
-- ============================================
DROP TABLE IF EXISTS audit_logs CASCADE;
DROP TABLE IF EXISTS reservations CASCADE;
DROP TABLE IF EXISTS room_rates CASCADE;
DROP TABLE IF EXISTS rooms CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;

-- ============================================
-- STEP 2: Enable extensions
-- ============================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_cron";
CREATE EXTENSION IF NOT EXISTS "btree_gist";

-- ============================================
-- STEP 3: Create tables
-- ============================================

CREATE TABLE rooms (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    base_price INTEGER NOT NULL CHECK (base_price > 0),
    image_url TEXT,
    deleted_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE room_rates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    rate_date DATE NOT NULL,
    price INTEGER NOT NULL CHECK (price > 0),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(room_id, rate_date)
);

CREATE TABLE reservations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    room_id UUID NOT NULL REFERENCES rooms(id),
    check_in DATE NOT NULL,
    check_out DATE NOT NULL,
    total_price INTEGER NOT NULL CHECK (total_price > 0),
    status VARCHAR(20) NOT NULL DEFAULT 'unpaid'
        CHECK (status IN ('unpaid', 'paid', 'expired', 'checked_in', 'checked_out', 'refunded')),
    midtrans_order_id VARCHAR(255),
    midtrans_transaction_id VARCHAR(255),
    payment_method VARCHAR(50),
    paid_at TIMESTAMP WITH TIME ZONE,
    refunded_at TIMESTAMP WITH TIME ZONE,
    refunded_by UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT no_overlapping_bookings
        EXCLUDE USING gist (
            room_id WITH =,
            daterange(check_in, check_out, '[]') WITH &&
        )
        WHERE (status NOT IN ('expired', 'refunded'))
);

CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    table_name VARCHAR(50) NOT NULL,
    record_id UUID NOT NULL,
    action VARCHAR(20) NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
    old_data JSONB,
    new_data JSONB,
    performed_by UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    first_name VARCHAR(255),
    last_name VARCHAR(255),
    role VARCHAR(20) NOT NULL DEFAULT 'guest'
        CHECK (role IN ('guest', 'admin')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- STEP 4: Create indexes
-- ============================================
CREATE INDEX idx_rooms_deleted_at ON rooms(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX idx_room_rates_room_date ON room_rates(room_id, rate_date);
CREATE INDEX idx_reservations_user ON reservations(user_id);
CREATE INDEX idx_reservations_room ON reservations(room_id);
CREATE INDEX idx_reservations_status ON reservations(status);
CREATE INDEX idx_reservations_dates ON reservations(check_in, check_out);
CREATE INDEX idx_audit_logs_record ON audit_logs(table_name, record_id);
CREATE INDEX idx_audit_logs_created ON audit_logs(created_at);

-- ============================================
-- STEP 5: Profile and audit helpers
-- ============================================
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS TEXT
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT COALESCE(
        (
            SELECT role
            FROM public.profiles
            WHERE id = auth.uid()
        ),
        'guest'
    );
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user_profile()
RETURNS TRIGGER AS $$
DECLARE
    v_full_name TEXT;
    v_first_name TEXT;
    v_last_name TEXT;
BEGIN
    v_full_name := COALESCE(
        NEW.raw_user_meta_data ->> 'full_name',
        NEW.raw_user_meta_data ->> 'name',
        ''
    );
    v_first_name := NULLIF(
        COALESCE(
            NEW.raw_user_meta_data ->> 'first_name',
            split_part(v_full_name, ' ', 1)
        ),
        ''
    );
    v_last_name := NULLIF(
        COALESCE(
            NEW.raw_user_meta_data ->> 'last_name',
            NULLIF(trim(substr(v_full_name, length(split_part(v_full_name, ' ', 1)) + 1)), '')
        ),
        ''
    );

    INSERT INTO public.profiles (id, first_name, last_name, role)
    VALUES (
        NEW.id,
        v_first_name,
        v_last_name,
        COALESCE(NULLIF(NEW.raw_app_meta_data ->> 'role', ''), 'guest')
    )
    ON CONFLICT (id) DO NOTHING;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user_profile();

CREATE OR REPLACE FUNCTION public.create_audit_log()
RETURNS TRIGGER AS $$
DECLARE
    v_actor_id TEXT;
    v_user_id UUID;
BEGIN
    v_actor_id := NULLIF(current_setting('app.current_actor_id', true), '');

    BEGIN
        v_user_id := v_actor_id::UUID;
    EXCEPTION WHEN OTHERS THEN
        v_user_id := NULL;
    END;

    IF v_user_id IS NULL THEN
        v_user_id := auth.uid();
    END IF;

    IF v_user_id IS NULL THEN
        BEGIN
            v_user_id := COALESCE(NEW.user_id, OLD.user_id);
        EXCEPTION WHEN OTHERS THEN
            v_user_id := NULL;
        END;
    END IF;

    IF (TG_OP = 'INSERT') THEN
        INSERT INTO audit_logs (table_name, record_id, action, new_data, performed_by)
        VALUES (TG_TABLE_NAME, NEW.id, 'INSERT', row_to_json(NEW), v_user_id);
        RETURN NEW;
    ELSIF (TG_OP = 'UPDATE') THEN
        INSERT INTO audit_logs (table_name, record_id, action, old_data, new_data, performed_by)
        VALUES (TG_TABLE_NAME, NEW.id, 'UPDATE', row_to_json(OLD), row_to_json(NEW), v_user_id);
        RETURN NEW;
    ELSIF (TG_OP = 'DELETE') THEN
        INSERT INTO audit_logs (table_name, record_id, action, old_data, performed_by)
        VALUES (TG_TABLE_NAME, OLD.id, 'DELETE', row_to_json(OLD), v_user_id);
        RETURN OLD;
    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS reservations_audit_trigger ON reservations;
CREATE TRIGGER reservations_audit_trigger
    AFTER INSERT OR UPDATE OR DELETE ON reservations
    FOR EACH ROW
    EXECUTE FUNCTION public.create_audit_log();

CREATE OR REPLACE FUNCTION public.update_reservation_status(
    p_reservation_id UUID,
    p_status VARCHAR,
    p_actor_id UUID
)
RETURNS public.reservations AS $$
DECLARE
    v_reservation public.reservations;
BEGIN
    PERFORM set_config('app.current_actor_id', COALESCE(p_actor_id::TEXT, ''), true);

    UPDATE public.reservations
    SET
        status = p_status,
        updated_at = NOW()
    WHERE id = p_reservation_id
    RETURNING * INTO v_reservation;

    IF v_reservation IS NULL THEN
        RAISE EXCEPTION 'Reservation not found';
    END IF;

    RETURN v_reservation;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.mark_reservation_refunded(
    p_reservation_id UUID,
    p_actor_id UUID
)
RETURNS public.reservations AS $$
DECLARE
    v_reservation public.reservations;
BEGIN
    PERFORM set_config('app.current_actor_id', COALESCE(p_actor_id::TEXT, ''), true);

    UPDATE public.reservations
    SET
        status = 'refunded',
        refunded_at = NOW(),
        refunded_by = p_actor_id,
        updated_at = NOW()
    WHERE id = p_reservation_id
    RETURNING * INTO v_reservation;

    IF v_reservation IS NULL THEN
        RAISE EXCEPTION 'Reservation not found';
    END IF;

    RETURN v_reservation;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- STEP 6: Create cron job for expired reservations
-- ============================================
CREATE OR REPLACE FUNCTION expire_old_reservations()
RETURNS void AS $$
BEGIN
    UPDATE reservations
    SET
        status = 'expired',
        updated_at = NOW()
    WHERE
        status = 'unpaid'
        AND created_at < NOW() - INTERVAL '1 hour';
END;
$$ LANGUAGE plpgsql;

SELECT cron.schedule(
    'expire-old-reservations',
    '* * * * *',
    'SELECT expire_old_reservations()'
);

-- ============================================
-- STEP 7: Enable RLS
-- ============================================
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Rooms are viewable by everyone" ON rooms
    FOR SELECT USING (deleted_at IS NULL);

CREATE POLICY "Rooms are manageable by admin" ON rooms
    FOR ALL USING (public.current_user_role() = 'admin')
    WITH CHECK (public.current_user_role() = 'admin');

CREATE POLICY "Room rates are viewable by everyone" ON room_rates
    FOR SELECT USING (true);

CREATE POLICY "Room rates are manageable by admin" ON room_rates
    FOR ALL USING (public.current_user_role() = 'admin')
    WITH CHECK (public.current_user_role() = 'admin');

CREATE POLICY "Users can view own reservations" ON reservations
    FOR SELECT USING (
        auth.uid() = user_id OR
        public.current_user_role() = 'admin'
    );

CREATE POLICY "Users can create own reservations" ON reservations
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own unpaid reservations" ON reservations
    FOR UPDATE USING (
        auth.uid() = user_id OR
        public.current_user_role() = 'admin'
    );

CREATE POLICY "Audit logs viewable by admin only" ON audit_logs
    FOR SELECT USING (public.current_user_role() = 'admin');

CREATE POLICY "Users can view own profile" ON profiles
    FOR SELECT USING (id = auth.uid());

-- ============================================
-- STEP 8: Enable realtime
-- ============================================
ALTER PUBLICATION supabase_realtime ADD TABLE reservations;
