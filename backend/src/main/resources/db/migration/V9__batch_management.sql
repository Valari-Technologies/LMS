-- ============================================================
-- Flyway Migration V9: Batch Management & Capacity-Based Enrollment
-- ============================================================

-- 1. Create batches table
CREATE TABLE IF NOT EXISTS batches (
    id          BIGSERIAL PRIMARY KEY,
    course_id   BIGINT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    name        VARCHAR(150) NOT NULL,
    code        VARCHAR(50) NOT NULL,
    capacity    INTEGER NOT NULL CHECK (capacity > 0),
    status      VARCHAR(20) NOT NULL DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'active', 'full', 'completed', 'cancelled')),
    start_date  DATE,
    end_date    DATE,
    created_at  TIMESTAMP NOT NULL DEFAULT now(),
    updated_at  TIMESTAMP NOT NULL DEFAULT now(),
    CONSTRAINT uq_batch_course_code UNIQUE (course_id, code),
    CONSTRAINT chk_batch_dates CHECK (end_date IS NULL OR start_date IS NULL OR end_date >= start_date)
);

CREATE INDEX IF NOT EXISTS idx_batches_course ON batches(course_id);
CREATE INDEX IF NOT EXISTS idx_batches_status ON batches(status);

-- 2. Add batch_id to enrollments table
ALTER TABLE enrollments 
    ADD COLUMN IF NOT EXISTS batch_id BIGINT REFERENCES batches(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_enrollments_batch ON enrollments(batch_id);

-- 3. Add batch_id to live_sessions table
ALTER TABLE live_sessions 
    ADD COLUMN IF NOT EXISTS batch_id BIGINT REFERENCES batches(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_live_sessions_batch ON live_sessions(batch_id);

-- 4. Backfill default batch for existing courses that already have active enrollments
DO $$
DECLARE
    r RECORD;
    b_id BIGINT;
BEGIN
    FOR r IN SELECT DISTINCT c.id, c.name FROM courses c 
             JOIN enrollments e ON e.course_id = c.id 
             WHERE e.batch_id IS NULL LOOP
        
        -- Check if a batch already exists for this course, else create Batch A
        SELECT id INTO b_id FROM batches WHERE course_id = r.id LIMIT 1;
        
        IF b_id IS NULL THEN
            INSERT INTO batches (course_id, name, code, capacity, status, created_at, updated_at)
            VALUES (r.id, 'Batch A', 'BATCH-A', 50, 'active', now(), now())
            RETURNING id INTO b_id;
        END IF;

        -- Link legacy enrollments to this batch
        UPDATE enrollments SET batch_id = b_id 
        WHERE course_id = r.id AND batch_id IS NULL;
        
    END LOOP;
END $$;
