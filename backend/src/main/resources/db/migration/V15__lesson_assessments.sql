-- V15: Lesson-Level One-Mark Assessment System Schema

-- 1. Assessments Configuration Table
CREATE TABLE IF NOT EXISTS assessments (
    id BIGSERIAL PRIMARY KEY,
    content_id BIGINT NOT NULL UNIQUE REFERENCES contents(id) ON DELETE CASCADE,
    enabled BOOLEAN NOT NULL DEFAULT FALSE,
    required BOOLEAN NOT NULL DEFAULT FALSE,
    pass_percentage INT NOT NULL DEFAULT 60,
    completion_mode VARCHAR(30) NOT NULL DEFAULT 'PASS_ASSESSMENT',
    timer_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    timer_duration_minutes INT NOT NULL DEFAULT 10,
    randomize_questions BOOLEAN NOT NULL DEFAULT FALSE,
    randomize_options BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_assessments_content_id ON assessments(content_id);

-- 2. Assessment Questions Table (1 Mark questions)
CREATE TABLE IF NOT EXISTS assessment_questions (
    id BIGSERIAL PRIMARY KEY,
    assessment_id BIGINT NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
    question_text TEXT NOT NULL,
    option_a TEXT NOT NULL,
    option_b TEXT NOT NULL,
    option_c TEXT NOT NULL,
    option_d TEXT NOT NULL,
    correct_answer VARCHAR(10) NOT NULL, -- 'A', 'B', 'C', 'D'
    display_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_assessment_questions_assessment_id ON assessment_questions(assessment_id);

-- 3. Assessment Attempts Table
CREATE TABLE IF NOT EXISTS assessment_attempts (
    id BIGSERIAL PRIMARY KEY,
    student_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content_id BIGINT NOT NULL REFERENCES contents(id) ON DELETE CASCADE,
    assessment_id BIGINT NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
    started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    submitted_at TIMESTAMP WITH TIME ZONE,
    status VARCHAR(30) NOT NULL DEFAULT 'IN_PROGRESS', -- 'IN_PROGRESS', 'COMPLETED', 'FAILED', 'TERMINATED'
    total_questions INT NOT NULL DEFAULT 0,
    correct_answers INT NOT NULL DEFAULT 0,
    obtained_marks INT NOT NULL DEFAULT 0,
    percentage DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    attempt_number INT NOT NULL DEFAULT 1,
    terminated_reason VARCHAR(50), -- 'TAB_SWITCH', 'TIME_EXPIRED', 'MULTIPLE_TABS', 'WINDOW_BLUR'
    last_activity_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    session_token VARCHAR(100)
);

CREATE INDEX IF NOT EXISTS idx_assessment_attempts_student ON assessment_attempts(student_id);
CREATE INDEX IF NOT EXISTS idx_assessment_attempts_content ON assessment_attempts(content_id);
CREATE INDEX IF NOT EXISTS idx_assessment_attempts_assessment ON assessment_attempts(assessment_id);
CREATE INDEX IF NOT EXISTS idx_assessment_attempts_status ON assessment_attempts(student_id, content_id, status);

-- 4. Assessment Attempt Answers Table
CREATE TABLE IF NOT EXISTS assessment_attempt_answers (
    id BIGSERIAL PRIMARY KEY,
    attempt_id BIGINT NOT NULL REFERENCES assessment_attempts(id) ON DELETE CASCADE,
    question_id BIGINT NOT NULL REFERENCES assessment_questions(id) ON DELETE CASCADE,
    selected_option VARCHAR(10), -- 'A', 'B', 'C', 'D'
    is_correct BOOLEAN,
    answered_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    CONSTRAINT uq_attempt_question UNIQUE (attempt_id, question_id)
);

CREATE INDEX IF NOT EXISTS idx_assessment_answers_attempt ON assessment_attempt_answers(attempt_id);

-- 5. Assessment Audit Logs Table
CREATE TABLE IF NOT EXISTS assessment_audit_logs (
    id BIGSERIAL PRIMARY KEY,
    student_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    assessment_id BIGINT NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
    attempt_id BIGINT REFERENCES assessment_attempts(id) ON DELETE SET NULL,
    event_type VARCHAR(50) NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    metadata TEXT
);

CREATE INDEX IF NOT EXISTS idx_assessment_audit_logs_student ON assessment_audit_logs(student_id);
CREATE INDEX IF NOT EXISTS idx_assessment_audit_logs_attempt ON assessment_audit_logs(attempt_id);
