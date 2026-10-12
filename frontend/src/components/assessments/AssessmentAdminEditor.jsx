import { useState, useEffect } from 'react';
import { getAdminAssessment, saveAssessment, deleteAssessment } from '../../api/assessments';
import { useNotification } from '../../context/NotificationContext';

export default function AssessmentAdminEditor({ contentId, contentTitle, onClose }) {
  const { toast } = useNotification();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Sub-tab: 'questions' | 'settings'
  const [editorTab, setEditorTab] = useState('questions');

  // Assessment Settings
  const [enabled, setEnabled] = useState(true);
  const [required, setRequired] = useState(true);
  const [passPercentage, setPassPercentage] = useState(60);
  const [completionMode, setCompletionMode] = useState('PASS_ASSESSMENT');
  const [timerEnabled, setTimerEnabled] = useState(false);
  const [timerDurationMinutes, setTimerDurationMinutes] = useState(10);
  const [randomizeQuestions, setRandomizeQuestions] = useState(false);
  const [randomizeOptions, setRandomizeOptions] = useState(false);

  // Questions List
  const [questions, setQuestions] = useState([]);

  // Question Form State (inline editor for fast question addition)
  const [editingIndex, setEditingIndex] = useState(null);
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [qForm, setQForm] = useState({
    id: null,
    questionText: '',
    optionA: '',
    optionB: '',
    optionC: '',
    optionD: '',
    correctAnswer: 'A'
  });

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    getAdminAssessment(contentId)
      .then(data => {
        if (!isMounted) return;
        if (data) {
          setEnabled(data.enabled ?? true);
          setRequired(data.required ?? true);
          setPassPercentage(data.passPercentage ?? 60);
          setCompletionMode(data.completionMode || 'PASS_ASSESSMENT');
          setTimerEnabled(data.timerEnabled ?? false);
          setTimerDurationMinutes(data.timerDurationMinutes ?? 10);
          setRandomizeQuestions(false);
          setRandomizeOptions(false);
          const sortedQuestions = (data.questions || []).slice().sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0));
          setQuestions(sortedQuestions);
        }
      })
      .catch(err => {
        console.error('Failed to load assessment:', err);
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => { isMounted = false; };
  }, [contentId]);

  const resetQForm = () => {
    setQForm({
      id: null,
      questionText: '',
      optionA: '',
      optionB: '',
      optionC: '',
      optionD: '',
      correctAnswer: 'A'
    });
    setEditingIndex(null);
    setIsAddingNew(false);
  };

  const handleStartAddNew = () => {
    resetQForm();
    setIsAddingNew(true);
  };

  const handleStartEditQuestion = (index) => {
    const q = questions[index];
    setQForm({ ...q });
    setEditingIndex(index);
    setIsAddingNew(false);
  };

  const handleSaveQuestion = (addAnother = false) => {
    if (!qForm.questionText.trim()) {
      toast.error('Question text is required');
      return;
    }
    if (!qForm.optionA.trim() || !qForm.optionB.trim() || !qForm.optionC.trim() || !qForm.optionD.trim()) {
      toast.error('All 4 options (A, B, C, D) are required');
      return;
    }

    const updated = [...questions];
    const newQ = {
      id: qForm.id,
      questionText: qForm.questionText.trim(),
      optionA: qForm.optionA.trim(),
      optionB: qForm.optionB.trim(),
      optionC: qForm.optionC.trim(),
      optionD: qForm.optionD.trim(),
      correctAnswer: qForm.correctAnswer.toUpperCase(),
      displayOrder: editingIndex !== null ? updated[editingIndex].displayOrder : updated.length
    };

    if (editingIndex !== null) {
      updated[editingIndex] = newQ;
      toast.success(`Updated Question ${editingIndex + 1}`);
    } else {
      updated.push(newQ);
      toast.success(`Added Question ${updated.length}`);
    }

    setQuestions(updated);
    setEnabled(true); // Auto enable assessment when questions are added

    if (addAnother) {
      setQForm({
        id: null,
        questionText: '',
        optionA: '',
        optionB: '',
        optionC: '',
        optionD: '',
        correctAnswer: 'A'
      });
      setEditingIndex(null);
      setIsAddingNew(true);
    } else {
      resetQForm();
    }
  };

  const handleDeleteQuestion = (index) => {
    const updated = questions.filter((_, i) => i !== index);
    setQuestions(updated);
    if (editingIndex === index) {
      resetQForm();
    }
    toast.success('Question deleted');
  };

  const handleMoveQuestion = (index, direction) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= questions.length) return;
    const updated = [...questions];
    const temp = updated[index];
    updated[index] = updated[targetIndex];
    updated[targetIndex] = temp;
    setQuestions(updated);
  };

  const handleSaveAssessment = async () => {
    if (enabled && questions.length === 0) {
      toast.error('Please add at least one question when assessment is enabled');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        enabled,
        required,
        passPercentage: Number(passPercentage),
        completionMode,
        timerEnabled,
        timerDurationMinutes: Number(timerDurationMinutes),
        randomizeQuestions: false,
        randomizeOptions: false,
        questions: questions.map((q, idx) => ({
          id: q.id,
          questionText: q.questionText,
          optionA: q.optionA,
          optionB: q.optionB,
          optionC: q.optionC,
          optionD: q.optionD,
          correctAnswer: q.correctAnswer,
          displayOrder: idx
        }))
      };

      await saveAssessment(contentId, payload);
      toast.success('Assessment saved successfully!');
      if (onClose) onClose();
    } catch (err) {
      console.error('Failed to save assessment:', err);
      toast.error(err?.response?.data?.message || 'Failed to save assessment');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAssessmentConfig = async () => {
    if (!window.confirm('Are you sure you want to delete this assessment? All questions will be permanently removed.')) return;
    setSaving(true);
    try {
      await deleteAssessment(contentId);
      toast.success('Assessment deleted successfully');
      setEnabled(false);
      setQuestions([]);
      if (onClose) onClose();
    } catch (err) {
      toast.error('Failed to delete assessment');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div style={{ background: 'var(--bg-card, #ffffff)', border: '1px solid var(--border-default, #e2e8f0)', borderRadius: '16px', padding: '60px 24px', textAlign: 'center' }}>
        <i className="fa-solid fa-circle-notch fa-spin" style={{ fontSize: '2rem', color: 'var(--accent-primary, #5A70D3)', marginBottom: '16px' }}></i>
        <p style={{ color: 'var(--text-secondary, #64748b)', margin: 0, fontWeight: 600 }}>Loading assessment settings...</p>
      </div>
    );
  }

  return (
    <div style={{ background: 'var(--bg-card, #ffffff)', border: '1px solid var(--border-default, #e2e8f0)', borderRadius: '16px', boxShadow: '0 4px 20px rgba(0,0,0,0.04)', overflow: 'hidden' }}>
      {/* Top Header Navigation Bar */}
      <div style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)', color: '#ffffff', padding: '20px 24px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              style={{
                background: 'rgba(255, 255, 255, 0.12)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                color: '#ffffff',
                fontSize: '0.85rem',
                fontWeight: 700,
                padding: '8px 14px',
                borderRadius: '8px',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <i className="fa-solid fa-arrow-left"></i> Back to Curriculum
            </button>
          )}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
              <span style={{ background: 'rgba(16, 185, 129, 0.2)', color: '#34d399', fontSize: '0.72rem', fontWeight: 800, padding: '2px 8px', borderRadius: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                One-Mark Assessment
              </span>
              <span style={{ fontSize: '0.75rem', opacity: 0.75 }}>Lesson ID #{contentId}</span>
            </div>
            <h2 style={{ margin: 0, fontSize: '1.35rem', fontWeight: 800, color: '#ffffff' }}>
              {contentTitle || 'Lesson Assessment'}
            </h2>
          </div>
        </div>

        {/* Global Action Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {enabled && (
            <button
              type="button"
              onClick={handleDeleteAssessmentConfig}
              disabled={saving}
              style={{ background: 'transparent', border: '1px solid rgba(239, 68, 68, 0.4)', color: '#f87171', fontSize: '0.82rem', fontWeight: 700, padding: '8px 14px', borderRadius: '8px', cursor: 'pointer' }}
            >
              <i className="fa-solid fa-trash" style={{ marginRight: '4px' }}></i> Delete
            </button>
          )}
          <button
            type="button"
            onClick={handleSaveAssessment}
            disabled={saving}
            style={{
              background: '#5A70D3',
              color: '#FFFFFF',
              border: 'none',
              fontSize: '0.9rem',
              fontWeight: 800,
              padding: '9px 22px',
              borderRadius: '8px',
              cursor: 'pointer',
              boxShadow: '0 8px 20px rgba(90, 112, 211, 0.20)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            {saving ? (
              <>
                <i className="fa-solid fa-spinner fa-spin"></i> Saving…
              </>
            ) : (
              <>
                <i className="fa-solid fa-check"></i> Save Assessment
              </>
            )}
          </button>
        </div>
      </div>

      {/* Main Assessment Header Controls & Toggle */}
      <div style={{ background: 'var(--bg-surface, #f8fafc)', borderBottom: '1px solid var(--border-default, #e2e8f0)', padding: '16px 24px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'var(--bg-card, #ffffff)', border: '1px solid var(--border-default, #cbd5e1)', padding: '8px 16px', borderRadius: '10px' }}>
            <span style={{ fontWeight: 800, fontSize: '0.92rem', color: 'var(--text-primary)' }}>Assessment Status:</span>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
                style={{ width: '18px', height: '18px', accentColor: '#10b981', cursor: 'pointer' }}
              />
              <span style={{ fontWeight: 800, fontSize: '0.88rem', color: enabled ? '#10b981' : '#64748b' }}>
                {enabled ? 'ENABLED' : 'DISABLED'}
              </span>
            </label>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '0.84rem', color: 'var(--text-secondary, #475569)' }}>
            <span>Questions: <strong style={{ color: 'var(--text-primary)' }}>{questions.length}</strong></span>
            <span>•</span>
            <span>Total Marks: <strong style={{ color: 'var(--text-primary)' }}>{questions.length} Marks</strong></span>
            <span>•</span>
            <span>Pass Requirement: <strong style={{ color: '#10b981' }}>{passPercentage}%</strong></span>
          </div>
        </div>

        {/* Sub Navigation Tabs: Questions vs Rules */}
        <div style={{ display: 'flex', gap: '6px', background: 'var(--bg-card, #ffffff)', padding: '4px', borderRadius: '10px', border: '1px solid var(--border-default, #cbd5e1)' }}>
          <button
            type="button"
            onClick={() => setEditorTab('questions')}
            style={{
              padding: '8px 18px',
              borderRadius: '8px',
              border: 'none',
              background: editorTab === 'questions' ? 'var(--accent-primary, #5A70D3)' : 'transparent',
              color: editorTab === 'questions' ? '#ffffff' : 'var(--text-secondary, #64748b)',
              fontWeight: 800,
              fontSize: '0.85rem',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <i className="fa-solid fa-list-check"></i>
            <span>Questions ({questions.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setEditorTab('settings')}
            style={{
              padding: '8px 18px',
              borderRadius: '8px',
              border: 'none',
              background: editorTab === 'settings' ? 'var(--accent-primary, #5A70D3)' : 'transparent',
              color: editorTab === 'settings' ? '#ffffff' : 'var(--text-secondary, #64748b)',
              fontWeight: 800,
              fontSize: '0.85rem',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <i className="fa-solid fa-gears"></i>
            <span>Rules & Settings</span>
          </button>
        </div>
      </div>

      {/* Main Tab Content */}
      <div style={{ padding: '24px' }}>
        {/* TAB 1: QUESTIONS MANAGEMENT */}
        {editorTab === 'questions' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Top Toolbar */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                  Questions Manager
                </h3>
                <p style={{ margin: '2px 0 0', fontSize: '0.82rem', color: 'var(--text-secondary, #64748b)' }}>
                  Add 1-mark multiple choice questions with 4 options and 1 correct answer.
                </p>
              </div>

              {!isAddingNew && editingIndex === null && (
                <button
                  type="button"
                  onClick={handleStartAddNew}
                  style={{
                    background: '#10b981',
                    color: '#ffffff',
                    border: 'none',
                    fontSize: '0.88rem',
                    fontWeight: 800,
                    padding: '10px 20px',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    boxShadow: '0 4px 12px rgba(16, 185, 129, 0.25)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <i className="fa-solid fa-plus"></i> Add Question
                </button>
              )}
            </div>

            {/* Inline Question Add / Edit Form Card */}
            {(isAddingNew || editingIndex !== null) && (
              <div style={{ background: 'var(--bg-surface, #f8fafc)', border: '2px solid #10b981', borderRadius: '12px', padding: '20px', boxShadow: '0 4px 14px rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-default)', paddingBottom: '10px' }}>
                  <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: '#059669', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <i className="fa-solid fa-pen-to-square"></i>
                    {editingIndex !== null ? `Edit Question #${editingIndex + 1}` : `New Question #${questions.length + 1} (1 Mark)`}
                  </h4>
                  <button type="button" onClick={resetQForm} style={{ background: 'none', border: 'none', fontSize: '1.1rem', cursor: 'pointer', color: 'var(--text-secondary)' }}>✕ Cancel</button>
                </div>

                <div>
                  <label className="form-label" style={{ fontWeight: 700, fontSize: '0.85rem' }}>Question Text *</label>
                  <textarea
                    rows={3}
                    className="form-control"
                    placeholder="Enter question text (e.g. What does HTML stand for?)"
                    value={qForm.questionText}
                    onChange={(e) => setQForm({ ...qForm, questionText: e.target.value })}
                    style={{ fontSize: '0.9rem' }}
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <label className="form-label" style={{ fontWeight: 700, fontSize: '0.85rem', margin: 0 }}>
                    Options A, B, C, D & Correct Choice *
                  </label>

                  {['A', 'B', 'C', 'D'].map((letter) => (
                    <div
                      key={letter}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        background: qForm.correctAnswer === letter ? 'rgba(16, 185, 129, 0.08)' : 'var(--bg-card, #ffffff)',
                        border: qForm.correctAnswer === letter ? '1.5px solid #10b981' : '1px solid var(--border-default)',
                        padding: '8px 14px',
                        borderRadius: '8px'
                      }}
                    >
                      <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', cursor: 'pointer', width: '110px', flexShrink: 0 }}>
                        <input
                          type="radio"
                          name="correctAnswerOption"
                          checked={qForm.correctAnswer === letter}
                          onChange={() => setQForm({ ...qForm, correctAnswer: letter })}
                          style={{ width: '18px', height: '18px', accentColor: '#10b981', cursor: 'pointer' }}
                        />
                        <strong style={{ fontSize: '0.9rem', color: qForm.correctAnswer === letter ? '#10b981' : 'var(--text-primary)' }}>
                          Option {letter} {qForm.correctAnswer === letter && '✓'}
                        </strong>
                      </label>

                      <input
                        type="text"
                        className="form-control"
                        placeholder={`Enter Option ${letter} answer choice`}
                        value={qForm[`option${letter}`]}
                        onChange={(e) => setQForm({ ...qForm, [`option${letter}`]: e.target.value })}
                        style={{ fontSize: '0.88rem' }}
                      />
                    </div>
                  ))}
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', paddingTop: '10px', borderTop: '1px solid var(--border-default)' }}>
                  <button type="button" className="btn btn-secondary" onClick={resetQForm}>Cancel</button>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => handleSaveQuestion(true)}
                    style={{ background: '#ecfdf5', color: '#047857', border: '1px solid #a7f3d0', fontWeight: 700 }}
                  >
                    <i className="fa-solid fa-plus"></i> Save & Add Another
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => handleSaveQuestion(false)}
                    style={{ background: '#10b981', borderColor: '#10b981', color: '#ffffff', fontWeight: 800 }}
                  >
                    <i className="fa-solid fa-check"></i> Save Question
                  </button>
                </div>
              </div>
            )}

            {/* Questions List */}
            {questions.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '48px 24px', border: '2px dashed var(--border-default, #e2e8f0)', borderRadius: '14px', background: 'var(--bg-surface, #f8fafc)' }}>
                <i className="fa-solid fa-clipboard-question" style={{ fontSize: '2.5rem', color: 'var(--text-muted, #94a3b8)', marginBottom: '12px' }}></i>
                <h4 style={{ margin: '0 0 6px', fontSize: '1.05rem', color: 'var(--text-primary)' }}>No Questions Added Yet</h4>
                <p style={{ margin: '0 0 16px', fontSize: '0.85rem', color: 'var(--text-secondary, #64748b)' }}>
                  Click <strong>+ Add Question</strong> above to start adding 1-mark questions for this lesson.
                </p>
                <button
                  type="button"
                  onClick={handleStartAddNew}
                  className="btn btn-primary"
                  style={{ background: '#10b981', borderColor: '#10b981', color: '#ffffff', fontWeight: 800, padding: '10px 22px' }}
                >
                  + Add First Question
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {questions.map((q, idx) => (
                  <div
                    key={idx}
                    style={{
                      background: 'var(--bg-card, #ffffff)',
                      border: '1px solid var(--border-default, #e2e8f0)',
                      borderRadius: '12px',
                      padding: '16px 20px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      gap: '16px',
                      boxShadow: '0 2px 6px rgba(0,0,0,0.02)'
                    }}
                  >
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ background: 'var(--accent-subtle, rgba(90, 112, 211, 0.08))', color: 'var(--accent-primary, #5A70D3)', fontWeight: 800, fontSize: '0.8rem', padding: '3px 10px', borderRadius: '6px' }}>
                          Question #{idx + 1}
                        </span>
                        <span style={{ fontSize: '0.78rem', color: 'var(--text-muted, #64748b)', fontWeight: 600 }}>1 Mark</span>
                      </div>

                      <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                        {q.questionText}
                      </h4>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '8px', fontSize: '0.85rem' }}>
                        {['A', 'B', 'C', 'D'].map(letter => {
                          const text = q[`option${letter}`];
                          const isCorrect = q.correctAnswer === letter;
                          return (
                            <div
                              key={letter}
                              style={{
                                padding: '8px 12px',
                                borderRadius: '6px',
                                border: isCorrect ? '1.5px solid #10b981' : '1px solid var(--border-default, #e2e8f0)',
                                background: isCorrect ? 'rgba(16, 185, 129, 0.08)' : 'var(--bg-surface, #f8fafc)',
                                color: isCorrect ? '#047857' : 'var(--text-primary)',
                                fontWeight: isCorrect ? 700 : 'normal'
                              }}
                            >
                              <strong>{letter}.</strong> {text} {isCorrect && ' ✓ (Correct)'}
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Actions */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <button type="button" disabled={idx === 0} onClick={() => handleMoveQuestion(idx, -1)} className="btn btn-secondary btn-sm" title="Move Up" style={{ padding: '6px 10px' }}>▲</button>
                      <button type="button" disabled={idx === questions.length - 1} onClick={() => handleMoveQuestion(idx, 1)} className="btn btn-secondary btn-sm" title="Move Down" style={{ padding: '6px 10px' }}>▼</button>
                      <button type="button" onClick={() => handleStartEditQuestion(idx)} className="btn btn-secondary btn-sm" title="Edit Question" style={{ color: '#0284c7', padding: '6px 10px' }}>
                        <i className="fa-solid fa-pencil"></i> Edit
                      </button>
                      <button type="button" onClick={() => handleDeleteQuestion(idx)} className="btn btn-secondary btn-sm" title="Delete Question" style={{ color: '#ef4444', padding: '6px 10px' }}>
                        <i className="fa-solid fa-trash"></i>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: RULES & SETTINGS */}
        {editorTab === 'settings' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                Assessment Rules & Options
              </h3>
              <p style={{ margin: '2px 0 0', fontSize: '0.82rem', color: 'var(--text-secondary, #64748b)' }}>
                Configure passing marks, timer limits, completion conditions, and anti-cheating randomization rules.
              </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
              {/* Assessment Required */}
              <div style={{ background: 'var(--bg-surface, #f8fafc)', border: '1px solid var(--border-default, #e2e8f0)', padding: '16px', borderRadius: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <strong style={{ display: 'block', fontSize: '0.92rem', color: 'var(--text-primary)' }}>Assessment Required</strong>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary, #64748b)' }}>Mandatory requirement before unlocking next lesson</span>
                </div>
                <input
                  type="checkbox"
                  checked={required}
                  onChange={(e) => setRequired(e.target.checked)}
                  style={{ width: '20px', height: '20px', accentColor: '#10b981', cursor: 'pointer' }}
                />
              </div>

              {/* Pass Percentage */}
              <div style={{ background: 'var(--bg-surface, #f8fafc)', border: '1px solid var(--border-default, #e2e8f0)', padding: '16px', borderRadius: '12px' }}>
                <label className="form-label" style={{ fontWeight: 700, fontSize: '0.88rem' }}>Pass Percentage (%)</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  className="form-control"
                  value={passPercentage}
                  onChange={(e) => setPassPercentage(e.target.value)}
                  style={{ fontSize: '0.9rem' }}
                />
              </div>

              {/* Completion Mode */}
              <div style={{ background: 'var(--bg-surface, #f8fafc)', border: '1px solid var(--border-default, #e2e8f0)', padding: '16px', borderRadius: '12px' }}>
                <label className="form-label" style={{ fontWeight: 700, fontSize: '0.88rem' }}>Completion Condition</label>
                <select
                  className="form-control"
                  value={completionMode}
                  onChange={(e) => setCompletionMode(e.target.value)}
                  style={{ fontSize: '0.9rem' }}
                >
                  <option value="PASS_ASSESSMENT">Pass Assessment (Achieve Pass Percentage)</option>
                  <option value="SUBMIT_ASSESSMENT">Submit Assessment (Any Submitted Attempt)</option>
                </select>
              </div>

              {/* Timer Config */}
              <div style={{ background: 'var(--bg-surface, #f8fafc)', border: '1px solid var(--border-default, #e2e8f0)', padding: '16px', borderRadius: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <strong style={{ display: 'block', fontSize: '0.92rem', color: 'var(--text-primary)' }}>Enable Attempt Timer</strong>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary, #64748b)' }}>Limit duration per student attempt</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {timerEnabled && (
                    <input
                      type="number"
                      min="1"
                      className="form-control"
                      value={timerDurationMinutes}
                      onChange={(e) => setTimerDurationMinutes(e.target.value)}
                      placeholder="Mins"
                      style={{ width: '70px', fontSize: '0.85rem', textAlign: 'center' }}
                    />
                  )}
                  <input
                    type="checkbox"
                    checked={timerEnabled}
                    onChange={(e) => setTimerEnabled(e.target.checked)}
                    style={{ width: '20px', height: '20px', accentColor: '#10b981', cursor: 'pointer' }}
                  />
                </div>
              </div>

              {/* Fixed Order Guarantee */}
              <div style={{ background: 'var(--bg-surface, #f8fafc)', border: '1px solid var(--border-default, #e2e8f0)', padding: '16px', borderRadius: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <strong style={{ display: 'block', fontSize: '0.92rem', color: 'var(--text-primary)' }}>Sequential Order (Preserved)</strong>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary, #64748b)' }}>Questions and options (A, B, C, D) are presented in the exact order you added them (no randomization).</span>
                </div>
                <span style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#16a34a', border: '1px solid rgba(16, 185, 129, 0.3)', padding: '5px 14px', borderRadius: '20px', fontSize: '0.78rem', fontWeight: '700' }}>
                  ✓ Fixed Order
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
