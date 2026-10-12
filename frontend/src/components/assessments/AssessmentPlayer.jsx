import { useState, useEffect, useRef, useCallback } from 'react';
import {
  getAssessmentInfo,
  startAssessmentAttempt,
  getAssessmentAttempt,
  saveAttemptAnswer,
  submitAssessmentAttempt,
  terminateAssessmentAttempt
} from '../../api/assessments';

// Fisher-Yates shuffle
function shuffleArray(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Build shuffled questions with shuffled options.
// optionMap[questionId] = ['C','A','D','B'] means display slot 0→C, slot 1→A, etc.
// When student picks display index i, we submit optionMap[qId][i].
function buildShuffledQuestions(rawQuestions) {
  const ordered = rawQuestions.slice().sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0));
  const shuffledQs = shuffleArray(ordered);
  const optionMap = {};
  shuffledQs.forEach(q => {
    optionMap[q.id] = shuffleArray(['A', 'B', 'C', 'D']);
  });
  return { shuffledQs, optionMap };
}

export default function AssessmentPlayer({ contentId, onLessonUnlocked, onRetry, onClose }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Metadata & Assessment Config
  const [assessmentInfo, setAssessmentInfo] = useState(null);

  // Shuffled questions & option order for this attempt
  const [shuffledQuestions, setShuffledQuestions] = useState([]);
  // useRef so the map survives re-renders without resetting
  const optionMapRef = useRef({}); // { [questionId]: ['C','A','D','B'] }

  // Attempt State
  const [activeAttempt, setActiveAttempt] = useState(null);
  const [selectedAnswers, setSelectedAnswers] = useState({}); // { [questionId]: 'A'/'B'/'C'/'D' } — backend letter
  const [currentIndex, setCurrentIndex] = useState(0);

  // Enhanced Exam State
  const [visitedQuestions, setVisitedQuestions] = useState(new Set());
  const [markedForReview, setMarkedForReview] = useState(new Set());
  const [showMobilePalette, setShowMobilePalette] = useState(false);

  // UI Control Modals
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [terminatedModal, setTerminatedModal] = useState(null);

  // Timer State
  const [timeRemaining, setTimeRemaining] = useState(null);
  const timerRef = useRef(null);

  // Normalize attempt object so both .id and .attemptId work reliably
  const normalizeAttempt = (attempt) => {
    if (!attempt) return null;
    const realId = attempt.attemptId || attempt.id;
    return { ...attempt, id: realId, attemptId: realId };
  };

  // Load Assessment Info
  const loadInfo = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getAssessmentInfo(contentId);
      setAssessmentInfo(data);

      const activeId = Number(data?.userStatus?.activeAttemptId);
      const latestId = Number(data?.userStatus?.latestAttemptId);
      const isCompletedOrPassed = Boolean(data?.userStatus?.completed || data?.userStatus?.passed);

      const targetId = isCompletedOrPassed
        ? ((!isNaN(latestId) && latestId > 0) ? latestId : (!isNaN(activeId) && activeId > 0) ? activeId : null)
        : ((!isNaN(activeId) && activeId > 0) ? activeId : (!isNaN(latestId) && latestId > 0) ? latestId : null);

      let loadedAttempt = null;

      if (targetId) {
        try {
          const attempt = await getAssessmentAttempt(targetId);
          if (attempt) {
            loadedAttempt = normalizeAttempt(attempt);
            if (isCompletedOrPassed && loadedAttempt.status !== 'COMPLETED') {
              loadedAttempt.status = 'COMPLETED';
              loadedAttempt.passed = true;
              loadedAttempt.correctAnswers = data.userStatus.bestScore;
              loadedAttempt.totalQuestions = data.userStatus.totalQuestions;
              loadedAttempt.wrongAnswers = Math.max(0, data.userStatus.totalQuestions - data.userStatus.bestScore);
              loadedAttempt.percentage = data.userStatus.bestPercentage;
              loadedAttempt.passPercentage = data.userStatus.passPercentage;
            }
            setSelectedAnswers(attempt.selectedAnswers || {});
            if (data.timerEnabled && attempt.status === 'IN_PROGRESS' && attempt.timeRemainingSeconds >= 0) {
              setTimeRemaining(attempt.timeRemainingSeconds);
            }
            // Pre-build option shuffle map for resumed in-progress attempt
            if (attempt.status === 'IN_PROGRESS' && data.questions?.length) {
              const { shuffledQs, optionMap: oMap } = buildShuffledQuestions(data.questions);
              setShuffledQuestions(shuffledQs);
              optionMapRef.current = oMap;
            }
          }
        } catch (attErr) {
          console.warn('Failed to load existing attempt details:', attErr);
        }
      }

      if (!loadedAttempt && isCompletedOrPassed) {
        loadedAttempt = {
          id: latestId || 0,
          attemptId: latestId || 0,
          status: 'COMPLETED',
          passed: data.userStatus.passed,
          correctAnswers: data.userStatus.bestScore,
          totalQuestions: data.userStatus.totalQuestions,
          wrongAnswers: Math.max(0, data.userStatus.totalQuestions - data.userStatus.bestScore),
          percentage: data.userStatus.bestPercentage,
          passPercentage: data.userStatus.passPercentage
        };
      }

      setActiveAttempt(loadedAttempt);
    } catch (err) {
      console.error('Failed to load assessment info:', err);
      setError(err?.response?.data?.message || 'Failed to load assessment');
    } finally {
      setLoading(false);
    }
  }, [contentId]);

  useEffect(() => {
    loadInfo();
  }, [loadInfo]);

  // Track Visited Questions (use shuffledQuestions if available)
  useEffect(() => {
    const list = shuffledQuestions.length > 0
      ? shuffledQuestions
      : (assessmentInfo?.questions || []).slice().sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0));
    if (list[currentIndex]) {
      const qId = list[currentIndex].id;
      setVisitedQuestions(prev => {
        const next = new Set(prev);
        next.add(qId);
        return next;
      });
    }
  }, [currentIndex, assessmentInfo, shuffledQuestions]);

  // Tab Switch & Window Blur Detection
  const handleViolation = useCallback(async (reason) => {
    const attemptId = activeAttempt?.attemptId || activeAttempt?.id;
    if (!activeAttempt || activeAttempt.status !== 'IN_PROGRESS' || !attemptId || terminatedModal) return;

    try {
      await terminateAssessmentAttempt(attemptId, reason);
      setActiveAttempt(prev => prev ? { ...prev, status: 'TERMINATED', terminatedReason: reason } : null);
      setTerminatedModal({ reason });
      setShowSubmitConfirm(false);
    } catch (err) {
      console.error('Failed to terminate attempt on violation:', err);
    }
  }, [activeAttempt, terminatedModal]);

  useEffect(() => {
    if (!activeAttempt || activeAttempt.status !== 'IN_PROGRESS') return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        handleViolation('TAB_SWITCH');
      }
    };

    const handleBlur = () => {
      handleViolation('WINDOW_BLUR');
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleBlur);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleBlur);
    };
  }, [activeAttempt, handleViolation]);

  // Timer Countdown Effect
  useEffect(() => {
    if (timeRemaining === null || timeRemaining <= 0 || !activeAttempt || activeAttempt.status !== 'IN_PROGRESS') {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    timerRef.current = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          handleViolation('TIME_EXPIRED');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [timeRemaining, activeAttempt, handleViolation]);

  // Start New Attempt
  const handleStartAttempt = async () => {
    setLoading(true);
    setError(null);
    setTerminatedModal(null);
    try {
      const attempt = await startAssessmentAttempt(assessmentInfo.id);
      setActiveAttempt(normalizeAttempt(attempt));
      setSelectedAnswers({});
      setVisitedQuestions(new Set());
      setMarkedForReview(new Set());
      setCurrentIndex(0);
      // Shuffle questions and options fresh for this attempt
      // Clear old option map so each question gets a new random order
      optionMapRef.current = {};
      if (assessmentInfo.questions?.length) {
        const { shuffledQs, optionMap: oMap } = buildShuffledQuestions(assessmentInfo.questions);
        setShuffledQuestions(shuffledQs);
        optionMapRef.current = oMap;
      }
      if (assessmentInfo.timerEnabled && attempt.timeRemainingSeconds >= 0) {
        setTimeRemaining(attempt.timeRemainingSeconds);
      }
    } catch (err) {
      console.error('Failed to start assessment attempt:', err);
      setError(err?.response?.data?.message || 'Failed to start assessment attempt');
    } finally {
      setLoading(false);
    }
  };

  // Answer Selection
  const handleOptionSelect = async (questionId, optionLetter) => {
    const attemptId = activeAttempt?.attemptId || activeAttempt?.id;
    if (!activeAttempt || activeAttempt.status !== 'IN_PROGRESS' || !attemptId) return;

    const updated = { ...selectedAnswers, [questionId]: optionLetter };
    setSelectedAnswers(updated);

    try {
      await saveAttemptAnswer(attemptId, questionId, optionLetter);
    } catch (err) {
      console.error('Failed to save answer choice:', err);
    }
  };

  // Clear Answer Choice
  const handleClearResponse = async (questionId) => {
    const attemptId = activeAttempt?.attemptId || activeAttempt?.id;
    if (!activeAttempt || activeAttempt.status !== 'IN_PROGRESS' || !attemptId) return;

    const updated = { ...selectedAnswers };
    delete updated[questionId];
    setSelectedAnswers(updated);

    try {
      await saveAttemptAnswer(attemptId, questionId, null);
    } catch (err) {
      console.error('Failed to clear answer choice:', err);
    }
  };

  // Toggle Mark for Review
  const handleToggleMarkForReview = (questionId) => {
    setMarkedForReview(prev => {
      const next = new Set(prev);
      if (next.has(questionId)) {
        next.delete(questionId);
      } else {
        next.add(questionId);
      }
      return next;
    });
  };

  // Submit Assessment
  const handleSubmitAssessment = async () => {
    const attemptId = activeAttempt?.attemptId || activeAttempt?.id;
    if (!activeAttempt || activeAttempt.status !== 'IN_PROGRESS' || !attemptId) return;
    setSubmitting(true);
    try {
      const result = await submitAssessmentAttempt(attemptId);
      setActiveAttempt(normalizeAttempt(result));
      setShowSubmitConfirm(false);
      setShowMobilePalette(false);
    } catch (err) {
      console.error('Failed to submit assessment:', err);
      setError(err?.response?.data?.message || 'Failed to submit assessment');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div style={{ background: 'var(--bg-card, #f8fafc)', border: '1px solid var(--border-subtle, #e2e8f0)', borderRadius: '16px', padding: '48px', textAlign: 'center', color: 'var(--text-muted)' }}>
        <i className="fa-solid fa-circle-notch fa-spin" style={{ fontSize: '2rem', color: '#10b981', marginBottom: '16px' }}></i>
        <p style={{ fontWeight: '700', fontSize: '1.1rem', color: 'var(--text-primary)' }}>Loading Assessment Engine...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ background: 'var(--bg-card, #f8fafc)', border: '1px solid var(--border-subtle, #e2e8f0)', borderRadius: '16px', padding: '32px', textAlign: 'center' }}>
        <i className="fa-solid fa-triangle-exclamation" style={{ fontSize: '2.5rem', color: '#ef4444', marginBottom: '12px' }}></i>
        <h3 style={{ margin: '0 0 8px', fontSize: '1.2rem', color: 'var(--text-primary)' }}>Assessment Error</h3>
        <p style={{ margin: '0 0 16px', color: 'var(--text-muted)', fontSize: '0.9rem' }}>{error}</p>
        <button onClick={loadInfo} className="btn btn-primary" style={{ background: '#10b981', borderColor: '#10b981', color: '#ffffff' }}>
          Try Again
        </button>
      </div>
    );
  }

  if (!assessmentInfo || !assessmentInfo.enabled) {
    return (
      <div style={{ background: 'var(--bg-card, #f8fafc)', border: '1px solid var(--border-subtle)', borderRadius: '16px', padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>
        <p style={{ margin: 0 }}>No active assessment attached to this lesson.</p>
      </div>
    );
  }

  // Use shuffled questions during an active attempt; fall back to sorted order otherwise
  const questions = (shuffledQuestions.length > 0 && activeAttempt?.status === 'IN_PROGRESS')
    ? shuffledQuestions
    : (assessmentInfo?.questions || []).slice().sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0));
  const currentQuestion = questions[currentIndex];

  // Ensure optionMapRef always has entries for every question (build once per question id)
  if (currentQuestion && !optionMapRef.current[currentQuestion.id]) {
    optionMapRef.current[currentQuestion.id] = shuffleArray(['A', 'B', 'C', 'D']);
  }
  // Get the shuffled option letters for the current question
  const currentOptionOrder = (currentQuestion && optionMapRef.current[currentQuestion.id]) || ['A', 'B', 'C', 'D'];

  // Question Status Helper
  const getQuestionStatus = (q, idx) => {
    const isCurrent = idx === currentIndex;
    const isAnswered = Boolean(selectedAnswers[q.id]);
    const isMarked = markedForReview.has(q.id);
    const isVisited = visitedQuestions.has(q.id) || isCurrent;

    if (isCurrent) return 'CURRENT';
    if (isMarked) return 'MARKED';
    if (isAnswered) return 'ANSWERED';
    if (isVisited && !isAnswered) return 'NOT_ANSWERED';
    return 'NOT_VISITED';
  };

  const answeredCount = questions.filter((q) => selectedAnswers[q.id]).length;
  const markedCount = markedForReview.size;
  const notAnsweredCount = questions.filter((q) => visitedQuestions.has(q.id) && !selectedAnswers[q.id]).length;
  const notVisitedCount = questions.filter(q => !visitedQuestions.has(q.id)).length;

  const formatTimeDetailed = (secs) => {
    if (secs === null || secs === undefined || secs < 0) {
      return { h: '00', m: '00', s: '00', str: '00:00' };
    }
    const h = Math.floor(secs / 3600).toString().padStart(2, '0');
    const m = Math.floor((secs % 3600) / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return { h, m, s, str: `${m}:${s}` };
  };

  const timerObj = formatTimeDetailed(timeRemaining);

  // 1. Initial Start / Instructions Screen
  if (!activeAttempt || activeAttempt.status === 'TERMINATED') {
    return (
      <div style={{ background: 'var(--bg-card, #ffffff)', border: '1px solid var(--border-subtle, #e2e8f0)', borderRadius: '16px', padding: '32px 20px', maxWidth: '680px', margin: '20px auto', display: 'flex', flexDirection: 'column', gap: '20px', boxSizing: 'border-box' }}>
        <div style={{ textAlign: 'center' }}>
          <span style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.3)', fontSize: '0.75rem', fontWeight: '800', padding: '4px 14px', borderRadius: '20px', textTransform: 'uppercase' }}>
            {assessmentInfo.required ? 'Mandatory Assessment' : 'Optional Assessment'}
          </span>
          <h2 style={{ fontSize: '1.5rem', fontWeight: '900', margin: '12px 0 4px', color: 'var(--text-primary)' }}>{assessmentInfo.lessonTitle}</h2>
          <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-muted)' }}>Online Assessment Test</p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '12px', background: 'var(--bg-surface, #f8fafc)', border: '1px solid var(--border-subtle)', borderRadius: '12px', padding: '16px', textAlign: 'center' }}>
          <div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block' }}>Total Questions</span>
            <strong style={{ fontSize: '1.25rem', color: 'var(--text-primary)' }}>{assessmentInfo.totalQuestions}</strong>
          </div>
          <div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block' }}>Pass Requirement</span>
            <strong style={{ fontSize: '1.25rem', color: '#10b981' }}>{assessmentInfo.passPercentage}%</strong>
          </div>
          <div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block' }}>Time Limit</span>
            <strong style={{ fontSize: '1.25rem', color: '#0284c7' }}>{assessmentInfo.timerEnabled ? `${assessmentInfo.timerDurationMinutes} Mins` : 'No Limit'}</strong>
          </div>
          <div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block' }}>Per Question</span>
            <strong style={{ fontSize: '1.25rem', color: '#f59e0b' }}>1 Mark</strong>
          </div>
        </div>

        <div style={{ background: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.3)', borderRadius: '12px', padding: '14px', fontSize: '0.82rem', color: '#d97706' }}>
          <strong>🛡 Integrity & Security Policy:</strong> Do not switch browser tabs, leave the window, or minimize during the active assessment. Leaving the assessment window will automatically <strong>terminate</strong> your attempt.
        </div>

        <div style={{ textAlign: 'center', paddingTop: '8px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <button
            onClick={handleStartAttempt}
            className="btn btn-primary"
            style={{ width: '100%', background: '#16a34a', borderColor: '#16a34a', color: '#ffffff', fontWeight: '800', fontSize: '1rem', padding: '14px 24px', borderRadius: '12px', boxShadow: '0 10px 15px -3px rgba(22, 163, 74, 0.3)' }}
          >
            Start Assessment Now →
          </button>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="btn btn-secondary"
              style={{ width: '100%', fontWeight: '700', padding: '10px' }}
            >
              Return to Lesson
            </button>
          )}
        </div>
      </div>
    );
  }

  // 2. Result Screen (COMPLETED or FAILED)
  if (activeAttempt.status === 'COMPLETED' || activeAttempt.status === 'FAILED') {
    const passed = activeAttempt.passed;
    return (
      <div style={{ background: 'var(--bg-card, #ffffff)', border: '1px solid var(--border-subtle, #e2e8f0)', borderRadius: '16px', padding: '32px 20px', maxWidth: '560px', margin: '20px auto', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '20px', boxSizing: 'border-box' }}>
        <div style={{ width: '76px', height: '76px', borderRadius: '50%', background: passed ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)', color: passed ? '#10b981' : '#ef4444', border: passed ? '2px solid rgba(16, 185, 129, 0.4)' : '2px solid rgba(239, 68, 68, 0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2.2rem', margin: '0 auto', fontWeight: '900' }}>
          {passed ? '✓' : '✕'}
        </div>

        <div>
          <h2 style={{ fontSize: '1.65rem', fontWeight: '900', margin: '0 0 4px', color: 'var(--text-primary)' }}>
            {passed ? 'Assessment Completed' : 'Assessment Not Passed'}
          </h2>
          <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-muted)' }}>{assessmentInfo.lessonTitle}</p>
        </div>

        <div style={{ background: 'var(--bg-surface, #f8fafc)', border: '1px solid var(--border-subtle)', borderRadius: '12px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ fontSize: '2.4rem', fontWeight: '900', color: 'var(--text-primary)' }}>
            {activeAttempt.correctAnswers} <span style={{ fontSize: '1.3rem', color: 'var(--text-muted)', fontWeight: 'normal' }}>/ {activeAttempt.totalQuestions}</span>
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: '800', color: passed ? '#10b981' : '#ef4444' }}>
            {activeAttempt.percentage}%
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', fontSize: '0.85rem', color: 'var(--text-muted)', paddingTop: '10px', borderTop: '1px solid var(--border-subtle)' }}>
            <div>Correct: <strong style={{ color: '#10b981' }}>{activeAttempt.correctAnswers}</strong></div>
            <div>Wrong: <strong style={{ color: '#ef4444' }}>{activeAttempt.wrongAnswers}</strong></div>
            <div>Required: <strong>{activeAttempt.passPercentage}%</strong></div>
          </div>
        </div>

        {passed ? (
          <div style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', color: '#10b981', padding: '12px', borderRadius: '10px', fontWeight: '700', fontSize: '0.9rem' }}>
            ✓ Assessment Passed — Next Lesson Unlocked!
          </div>
        ) : (
          <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#ef4444', padding: '12px', borderRadius: '10px', fontWeight: '700', fontSize: '0.9rem' }}>
            You need to retry this assessment before continuing.
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: '12px', paddingTop: '8px' }}>
          <button
            type="button"
            onClick={handleStartAttempt}
            className="btn btn-secondary"
            style={{ fontWeight: '700', padding: '10px 20px', borderRadius: '10px' }}
          >
            Retake Assessment
          </button>
          {passed && onLessonUnlocked && (
            <button
              type="button"
              onClick={onLessonUnlocked}
              className="btn btn-primary"
              style={{ background: '#16a34a', borderColor: '#16a34a', color: '#ffffff', fontWeight: '800', padding: '10px 24px', borderRadius: '10px' }}
            >
              Continue to Next Lesson →
            </button>
          )}
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="btn btn-secondary"
              style={{ fontWeight: '700', padding: '10px 20px', borderRadius: '10px' }}
            >
              Return to Lesson
            </button>
          )}
        </div>
      </div>
    );
  }

  // 3. Active CAT / NTA Style Online Assessment Portal Screen
  return (
    <div className="exam-portal-wrapper">
      <style>{`
        .exam-portal-wrapper {
          width: 100%;
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          background: #f1f5f9;
          color: #0f172a;
          font-family: inherit;
          box-sizing: border-box;
          overflow-x: hidden;
        }
        .exam-header-bar {
          background: #0f172a;
          color: #ffffff;
          padding: 12px 20px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          flex-shrink: 0;
          border-bottom: 1px solid #1e293b;
        }
        .exam-header-title {
          font-size: 1rem;
          font-weight: 800;
          color: #ffffff;
          margin: 0;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .exam-grid-container {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 300px;
          flex: 1;
        }
        .exam-left-panel {
          background: #ffffff;
          display: flex;
          flex-direction: column;
          border-right: 1px solid #cbd5e1;
        }
        .exam-right-panel {
          background: #f8fafc;
          display: flex;
          flex-direction: column;
        }
        .palette-grid {
          display: grid;
          grid-template-columns: repeat(6, 1fr);
          gap: 8px;
        }

        /* Mobile & Tablet Styles */
        @media (max-width: 991px) {
          .exam-header-bar {
            padding: 10px 14px;
          }
          .exam-header-title {
            font-size: 0.88rem;
          }
          .exam-grid-container {
            grid-template-columns: 1fr;
          }
          .exam-left-panel {
            border-right: none;
          }
          .exam-right-panel {
            display: none;
          }
          .palette-grid {
            grid-template-columns: repeat(5, 1fr);
          }
        }
        @media (max-width: 640px) {
          .exam-action-toolbar {
            padding: 10px 12px !important;
            gap: 8px !important;
          }
          .exam-action-btn {
            padding: 8px 12px !important;
            font-size: 0.8rem !important;
          }
        }
      `}</style>

      {/* Unified Screen Header Bar */}
      <div className="exam-header-bar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              style={{
                background: 'rgba(255, 255, 255, 0.12)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                color: '#ffffff',
                fontSize: '0.82rem',
                fontWeight: 700,
                padding: '6px 12px',
                borderRadius: '6px',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                flexShrink: 0
              }}
            >
              <i className="fa-solid fa-arrow-left"></i> <span className="mobile-hide">Return</span>
            </button>
          )}
          <h3 className="exam-header-title">
            Online Test - {assessmentInfo.lessonTitle}
          </h3>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
          {/* Mobile Palette Button */}
          <button
            type="button"
            onClick={() => setShowMobilePalette(true)}
            style={{
              background: '#0284c7',
              color: '#ffffff',
              border: 'none',
              fontSize: '0.8rem',
              fontWeight: 800,
              padding: '6px 12px',
              borderRadius: '6px',
              cursor: 'pointer',
              display: 'none'
            }}
            className="mobile-palette-toggle"
          >
            📊 Palette ({currentIndex + 1}/{questions.length})
          </button>
          <style>{`
            @media (max-width: 991px) {
              .mobile-palette-toggle { display: inline-flex !important; }
              .mobile-hide { display: none !important; }
            }
          `}</style>

          {assessmentInfo.timerEnabled && timeRemaining !== null && (
            <span style={{ fontFamily: 'monospace', fontSize: '0.85rem', fontWeight: 800, color: timeRemaining < 120 ? '#f87171' : '#38bdf8', background: 'rgba(255,255,255,0.08)', padding: '4px 10px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.15)' }}>
              ⏱ {timerObj.str}
            </span>
          )}

          <span style={{ background: 'rgba(16, 185, 129, 0.2)', color: '#34d399', fontSize: '0.75rem', fontWeight: '800', padding: '4px 10px', borderRadius: '20px' }}>
            🛡 Exam Mode
          </span>
        </div>
      </div>

      {/* Main Split Grid */}
      <div className="exam-grid-container">

        {/* Left Column: Main Question Area */}
        <div className="exam-left-panel">
          {/* Question Title Header */}
          <div style={{ padding: '14px 20px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: '800', color: '#1e293b' }}>
              Question {currentIndex + 1} of {questions.length}
            </h4>
            <span style={{ fontSize: '0.8rem', fontWeight: '700', color: '#0284c7', background: '#e0f2fe', padding: '3px 10px', borderRadius: '6px' }}>
              1 Mark
            </span>
          </div>

          {/* Question Text Body */}
          <div style={{ padding: '20px', flex: 1, display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <p style={{ fontSize: '1rem', fontWeight: '600', color: '#1e293b', margin: 0, lineHeight: 1.6, wordBreak: 'break-word' }}>
              {/* Always show the shuffled display position (Q1, Q2...) — strip any stored Q<n>: prefix */}
              <span style={{ color: '#0284c7', marginRight: '6px' }}>Q{currentIndex + 1}:</span>
              {(currentQuestion?.questionText || '').replace(/^Q\d+[:\s.]+\s*/i, '').replace(/^\d+[.:\s]+\s*/, '')}
            </p>

            {/* Options List — shuffled display order, backend letter submitted correctly */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '6px' }}>
              {currentOptionOrder.map((backendLetter, displayIdx) => {
                const displayLabel = String.fromCharCode(65 + displayIdx); // 'A','B','C','D' visually
                const optionText = currentQuestion?.[`option${backendLetter}`];
                const isSelected = selectedAnswers[currentQuestion?.id] === backendLetter;

                return (
                  <label
                    key={backendLetter}
                    onClick={() => handleOptionSelect(currentQuestion.id, backendLetter)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '12px 16px',
                      borderRadius: '8px',
                      border: isSelected ? '2px solid #16a34a' : '1px solid #cbd5e1',
                      background: isSelected ? '#E8EBFA' : '#ffffff',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      userSelect: 'none',
                      wordBreak: 'break-word'
                    }}
                  >
                    <div style={{
                      width: '20px',
                      height: '20px',
                      borderRadius: '4px',
                      border: isSelected ? '2px solid #16a34a' : '2px solid #94a3b8',
                      background: isSelected ? '#16a34a' : '#ffffff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#ffffff',
                      fontSize: '0.75rem',
                      fontWeight: '900',
                      flexShrink: 0
                    }}>
                      {isSelected && '✓'}
                    </div>

                    <span style={{ fontSize: '0.9rem', fontWeight: isSelected ? '700' : '500', color: isSelected ? '#15803d' : '#334155' }}>
                      <strong style={{ marginRight: '6px' }}>{displayLabel}.</strong> {optionText}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Action Buttons Toolbar (Bottom of Left Panel) */}
          <div className="exam-action-toolbar" style={{ background: '#f8fafc', borderTop: '1px solid #cbd5e1', padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                className="exam-action-btn"
                disabled={currentIndex === 0}
                onClick={() => setCurrentIndex(prev => prev - 1)}
                style={{
                  background: currentIndex === 0 ? '#cbd5e1' : '#0284c7',
                  color: '#ffffff',
                  border: 'none',
                  padding: '9px 20px',
                  borderRadius: '20px',
                  fontWeight: '700',
                  fontSize: '0.85rem',
                  cursor: currentIndex === 0 ? 'not-allowed' : 'pointer'
                }}
              >
                ← Prev
              </button>

              <button
                type="button"
                className="exam-action-btn"
                disabled={currentIndex === questions.length - 1}
                onClick={() => setCurrentIndex(prev => prev + 1)}
                style={{
                  background: currentIndex === questions.length - 1 ? '#cbd5e1' : '#0284c7',
                  color: '#ffffff',
                  border: 'none',
                  padding: '9px 20px',
                  borderRadius: '20px',
                  fontWeight: '700',
                  fontSize: '0.85rem',
                  cursor: currentIndex === questions.length - 1 ? 'not-allowed' : 'pointer'
                }}
              >
                Next →
              </button>
            </div>

            <button
              type="button"
              className="exam-action-btn"
              onClick={() => setShowSubmitConfirm(true)}
              style={{
                background: '#16a34a',
                color: '#ffffff',
                border: 'none',
                padding: '9px 22px',
                borderRadius: '20px',
                fontWeight: '800',
                fontSize: '0.85rem',
                cursor: 'pointer',
                boxShadow: '0 2px 6px rgba(22, 163, 74, 0.25)'
              }}
            >
              Submit Test
            </button>
          </div>

          {/* Bottom Legend Footer Bar */}
          <div style={{ background: '#e2e8f0', borderTop: '1px solid #cbd5e1', padding: '8px 14px' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: '16px', fontSize: '0.78rem', color: '#334155', fontWeight: '700' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#0284c7' }}></span> Current
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#94a3b8' }}></span> Not Visited
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#16a34a' }}></span> Answered
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#dc2626' }}></span> Not Answered
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Desktop Sidebar Timer & Question Palette */}
        <div className="exam-right-panel">
          {/* Time Left Box Header */}
          <div style={{ background: '#e2e8f0', borderBottom: '1px solid #cbd5e1', padding: '12px', textAlign: 'center' }}>
            <span style={{ fontSize: '0.9rem', fontWeight: '800', color: '#334155', display: 'block' }}>Time Left</span>
          </div>

          {/* Detailed Timer Counter Box */}
          <div style={{ background: '#ffffff', borderBottom: '1px solid #cbd5e1', padding: '16px', textAlign: 'center' }}>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', fontFamily: 'monospace' }}>
              <div>
                <span style={{ fontSize: '1.3rem', fontWeight: '900', color: '#0f172a', display: 'block' }}>{timerObj.h}</span>
                <span style={{ fontSize: '0.7rem', color: '#64748b', textTransform: 'lowercase' }}>hours</span>
              </div>
              <span style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#94a3b8' }}>:</span>
              <div>
                <span style={{ fontSize: '1.3rem', fontWeight: '900', color: '#0f172a', display: 'block' }}>{timerObj.m}</span>
                <span style={{ fontSize: '0.7rem', color: '#64748b', textTransform: 'lowercase' }}>minutes</span>
              </div>
              <span style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#94a3b8' }}>:</span>
              <div>
                <span style={{ fontSize: '1.3rem', fontWeight: '900', color: timeRemaining < 120 ? '#dc2626' : '#0f172a', display: 'block' }}>{timerObj.s}</span>
                <span style={{ fontSize: '0.7rem', color: '#64748b', textTransform: 'lowercase' }}>seconds</span>
              </div>
            </div>
          </div>

          {/* Question Palette Section */}
          <div style={{ padding: '14px', flex: 1, display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ background: '#e2e8f0', borderRadius: '6px', padding: '8px 12px', textAlign: 'center' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: '800', color: '#334155' }}>
                Questions Palette ({questions.length})
              </span>
            </div>

            {/* Question Number Buttons Grid */}
            <div className="palette-grid">
              {questions.map((q, idx) => {
                const status = getQuestionStatus(q, idx);

                let bg = '#cbd5e1';
                let color = '#334155';
                let borderRadius = '6px';
                let border = 'none';

                if (status === 'CURRENT') {
                  bg = '#0284c7';
                  color = '#ffffff';
                  border = '2px solid #0369a1';
                } else if (status === 'ANSWERED') {
                  bg = '#16a34a';
                  color = '#ffffff';
                  borderRadius = '6px 6px 6px 0px';
                } else if (status === 'NOT_ANSWERED') {
                  bg = '#dc2626';
                  color = '#ffffff';
                  borderRadius = '6px 6px 0px 6px';
                }

                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setCurrentIndex(idx)}
                    style={{
                      aspectRatio: '1',
                      width: '100%',
                      background: bg,
                      color: color,
                      border: border,
                      borderRadius: borderRadius,
                      fontSize: '0.85rem',
                      fontWeight: '800',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: 0
                    }}
                  >
                    {idx + 1}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Question Palette Modal Drawer */}
      {showMobilePalette && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(15, 23, 42, 0.8)', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
          <div style={{ background: '#ffffff', borderTopLeftRadius: '16px', borderTopRightRadius: '16px', padding: '20px', maxHeight: '85vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #cbd5e1', paddingBottom: '10px' }}>
              <h4 style={{ margin: 0, fontSize: '1.05rem', fontWeight: '800', color: '#0f172a' }}>
                Question Palette ({questions.length})
              </h4>
              <button
                type="button"
                onClick={() => setShowMobilePalette(false)}
                style={{ background: '#f1f5f9', border: 'none', borderRadius: '50%', width: '32px', height: '32px', fontSize: '1rem', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            {/* Timer Banner in Mobile Modal */}
            <div style={{ background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '10px', padding: '12px', textAlign: 'center' }}>
              <span style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: '700', textTransform: 'uppercase' }}>Time Left</span>
              <div style={{ fontSize: '1.4rem', fontWeight: '900', color: timeRemaining < 120 ? '#dc2626' : '#0284c7', fontFamily: 'monospace' }}>
                {timerObj.h}:{timerObj.m}:{timerObj.s}
              </div>
            </div>

            {/* Question Buttons Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '10px' }}>
              {questions.map((q, idx) => {
                const status = getQuestionStatus(q, idx);

                let bg = '#cbd5e1';
                let color = '#334155';

                if (status === 'CURRENT') { bg = '#0284c7'; color = '#ffffff'; }
                else if (status === 'ANSWERED') { bg = '#16a34a'; color = '#ffffff'; }
                else if (status === 'NOT_ANSWERED') { bg = '#dc2626'; color = '#ffffff'; }

                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setCurrentIndex(idx);
                      setShowMobilePalette(false);
                    }}
                    style={{
                      height: '42px',
                      background: bg,
                      color: color,
                      border: 'none',
                      borderRadius: '8px',
                      fontSize: '0.9rem',
                      fontWeight: '800',
                      cursor: 'pointer'
                    }}
                  >
                    {idx + 1}
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setShowMobilePalette(false)}
              style={{ width: '100%', background: '#0284c7', borderColor: '#0284c7', color: '#ffffff', fontWeight: '800', marginTop: '10px' }}
            >
              Close & Resume Quiz
            </button>
          </div>
        </div>
      )}

      {/* Submit Confirmation Modal */}
      {showSubmitConfirm && (
        <div className="modal-backdrop" style={{ zIndex: 9999 }}>
          <div className="modal-card" style={{ maxWidth: '460px', textAlign: 'center', borderTop: '4px solid #16a34a' }}>
            <h3 className="modal-title" style={{ marginBottom: '12px' }}>Submit Assessment Test?</h3>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', background: '#f8fafc', padding: '14px', borderRadius: '10px', margin: '12px 0', fontSize: '0.85rem' }}>
              <div>Answered: <strong style={{ color: '#16a34a' }}>{answeredCount}</strong></div>
              <div>Not Answered: <strong style={{ color: '#dc2626' }}>{notAnsweredCount}</strong></div>
              <div>Not Visited: <strong style={{ color: '#64748b' }}>{notVisitedCount}</strong></div>
            </div>

            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: '0 0 20px' }}>Are you sure you want to finalize and submit your test?</p>

            <div style={{ display: 'flex', justifyContent: 'center', gap: '10px' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setShowSubmitConfirm(false)} disabled={submitting}>Cancel</button>
              <button type="button" className="btn btn-primary" onClick={handleSubmitAssessment} disabled={submitting} style={{ background: '#16a34a', borderColor: '#16a34a', color: '#ffffff', fontWeight: '800' }}>
                {submitting ? 'Submitting...' : 'Yes, Submit Test'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tab Switch Violation Modal */}
      {terminatedModal && (
        <div className="modal-backdrop" style={{ zIndex: 9999 }}>
          <div className="modal-card" style={{ maxWidth: '440px', textAlign: 'center', borderColor: '#ef4444' }}>
            <i className="fa-solid fa-shield-cat" style={{ fontSize: '2.5rem', color: '#ef4444', marginBottom: '12px' }}></i>
            <h3 className="modal-title" style={{ color: '#ef4444', marginBottom: '8px' }}>Assessment Terminated</h3>
            <p style={{ fontSize: '0.92rem', color: 'var(--text-primary)', margin: '0 0 12px' }}>
              You left the assessment window or switched browser tabs.
            </p>
            <div style={{ background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#ef4444', padding: '10px 14px', borderRadius: '8px', fontSize: '0.82rem', marginBottom: '20px' }}>
              For assessment security, your current attempt has been terminated. You must restart the assessment from the beginning.
            </div>
            <button type="button" className="btn btn-primary" onClick={handleStartAttempt} style={{ width: '100%', background: '#ef4444', borderColor: '#ef4444', color: '#ffffff', fontWeight: '800' }}>
              Restart Assessment
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
