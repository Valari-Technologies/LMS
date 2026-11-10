-- ============================================================
-- V41: Session Recording Ratings and Live Session Attendance
-- ============================================================

CREATE TABLE IF NOT EXISTS session_recording_ratings (
    id              BIGSERIAL PRIMARY KEY,
    recording_id    BIGINT NOT NULL REFERENCES session_recordings(id) ON DELETE CASCADE,
    student_id      BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    rating          INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment         TEXT,
    created_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    CONSTRAINT uq_session_recording_student_rating UNIQUE (recording_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_rec_ratings_recording_id ON session_recording_ratings(recording_id);
CREATE INDEX IF NOT EXISTS idx_rec_ratings_student_id ON session_recording_ratings(student_id);
CREATE INDEX IF NOT EXISTS idx_rec_ratings_rating ON session_recording_ratings(rating);

CREATE TABLE IF NOT EXISTS live_session_attendance (
    id              BIGSERIAL PRIMARY KEY,
    session_id      BIGINT NOT NULL REFERENCES live_sessions(id) ON DELETE CASCADE,
    student_id      BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    course_id       BIGINT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    batch_id        BIGINT REFERENCES batches(id) ON DELETE SET NULL,
    status          VARCHAR(30) NOT NULL DEFAULT 'PRESENT',
    attended_at     TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    join_time       TIMESTAMP WITH TIME ZONE DEFAULT now(),
    leave_time      TIMESTAMP WITH TIME ZONE,
    duration_seconds INT DEFAULT 0,
    created_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    CONSTRAINT uq_session_attendance_student UNIQUE (session_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_session_att_session_id ON live_session_attendance(session_id);
CREATE INDEX IF NOT EXISTS idx_session_att_student_id ON live_session_attendance(student_id);
CREATE INDEX IF NOT EXISTS idx_session_att_course_id ON live_session_attendance(course_id);

