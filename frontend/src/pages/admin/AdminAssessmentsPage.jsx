import { useState, useEffect, useMemo } from 'react';
import { listAdminCourses, getCourse } from '../../api/courses';
import { getAdminAssessment, deleteAssessment } from '../../api/assessments';
import AssessmentAdminEditor from '../../components/assessments/AssessmentAdminEditor';
import { useNotification, confirmDialog } from '../../context/NotificationContext';
import { usePermission } from '../../hooks/usePermission';

export default function AdminAssessmentsPage() {
  const { toast } = useNotification();
  const { isReadOnly } = usePermission();

  const [loading, setLoading] = useState(true);
  const [courses, setCourses] = useState([]);
  const [lessonsData, setLessonsData] = useState([]); // [{ courseId, courseName, sectionId, sectionTitle, contentId, title, assessment }]

  // Filters
  const [selectedCourseId, setSelectedCourseId] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL' | 'CONFIGURED' | 'MISSING'
  const [searchQuery, setSearchQuery] = useState('');

  // Active Editor Modal
  const [activeEditorContent, setActiveEditorContent] = useState(null); // { id, title }

  // New Assessment Picker Modal
  const [showPickerModal, setShowPickerModal] = useState(false);
  const [pickerCourseId, setPickerCourseId] = useState('');
  const [pickerSectionId, setPickerSectionId] = useState('');
  const [pickerContentId, setPickerContentId] = useState('');

  const loadAllData = async () => {
    setLoading(true);
    try {
      const coursesRes = await listAdminCourses();
      const courseList = Array.isArray(coursesRes) ? coursesRes : (coursesRes?.content || []);
      setCourses(courseList);

      // Load full syllabus for all courses to gather all lessons and their assessments
      const allLessons = [];
      for (const c of courseList) {
        try {
          const detail = await getCourse(c.id);
          if (detail?.sections && Array.isArray(detail.sections)) {
            for (const sec of detail.sections) {
              if (sec.contents && Array.isArray(sec.contents)) {
                for (const lesson of sec.contents) {
                  allLessons.push({
                    courseId: c.id,
                    courseName: c.title || c.name || 'Untitled Course',
                    sectionId: sec.id,
                    sectionTitle: sec.title || 'Untitled Section',
                    contentId: lesson.id,
                    title: lesson.title,
                    assessment: null // will be populated
                  });
                }
              }
            }
          }
        } catch (e) {
          console.warn(`Failed to load course details for ${c.id}`, e);
        }
      }

      // Query assessments in parallel
      const enrichedLessons = await Promise.all(
        allLessons.map(async (item) => {
          try {
            const ass = await getAdminAssessment(item.contentId);
            return { ...item, assessment: ass || null };
          } catch (e) {
            return { ...item, assessment: null };
          }
        })
      );

      setLessonsData(enrichedLessons);
    } catch (err) {
      console.error('Failed to load assessments overview:', err);
      toast.error('Failed to load courses syllabus data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllData();
  }, []);

  // Compute Metrics
  const metrics = useMemo(() => {
    const totalLessons = lessonsData.length;
    const configuredAssessments = lessonsData.filter(l => l.assessment != null);
    const totalConfigured = configuredAssessments.length;
    const activeCount = configuredAssessments.filter(l => l.assessment?.enabled).length;
    const totalQuestions = configuredAssessments.reduce((sum, l) => sum + (l.assessment?.questions?.length || 0), 0);
    const avgPassPct = totalConfigured > 0
      ? Math.round(configuredAssessments.reduce((sum, l) => sum + (l.assessment?.passPercentage || 60), 0) / totalConfigured)
      : 60;

    return {
      totalLessons,
      totalConfigured,
      activeCount,
      totalQuestions,
      avgPassPct
    };
  }, [lessonsData]);

  // Filtered Lessons
  const filteredLessons = useMemo(() => {
    return lessonsData.filter(item => {
      // Course filter
      if (selectedCourseId !== 'ALL' && String(item.courseId) !== String(selectedCourseId)) {
        return false;
      }
      // Status filter
      if (statusFilter === 'CONFIGURED' && !item.assessment) return false;
      if (statusFilter === 'MISSING' && item.assessment) return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = item.title?.toLowerCase().includes(q);
        const matchCourse = item.courseName?.toLowerCase().includes(q);
        const matchSection = item.sectionTitle?.toLowerCase().includes(q);
        if (!matchTitle && !matchCourse && !matchSection) return false;
      }

      return true;
    });
  }, [lessonsData, selectedCourseId, statusFilter, searchQuery]);

  // Handle Delete
  const handleDeleteAssessment = async (contentId, lessonTitle) => {
    if (isReadOnly) {
      toast.error('You do not have permission to delete assessments');
      return;
    }
    const confirmed = await confirmDialog({
      title: 'Delete Assessment?',
      message: `Are you sure you want to permanently delete the assessment for "${lessonTitle}"? This will remove all associated student attempt records.`,
      confirmText: 'Delete Assessment',
      danger: true
    });
    if (!confirmed) return;

    try {
      await deleteAssessment(contentId);
      toast.success('Assessment deleted successfully');
      loadAllData();
    } catch (err) {
      console.error('Failed to delete assessment:', err);
      toast.error('Failed to delete assessment');
    }
  };

  // Helper for picker modal: available sections for chosen course
  const pickerCourseObj = useMemo(() => {
    return courses.find(c => String(c.id) === String(pickerCourseId));
  }, [courses, pickerCourseId]);

  const pickerSections = useMemo(() => {
    if (!pickerCourseId) return [];
    const secMap = new Map();
    lessonsData
      .filter(l => String(l.courseId) === String(pickerCourseId))
      .forEach(l => {
        if (!secMap.has(l.sectionId)) {
          secMap.set(l.sectionId, l.sectionTitle);
        }
      });
    return Array.from(secMap.entries()).map(([id, title]) => ({ id, title }));
  }, [lessonsData, pickerCourseId]);

  const pickerLessons = useMemo(() => {
    if (!pickerSectionId) return [];
    return lessonsData.filter(l => String(l.sectionId) === String(pickerSectionId));
  }, [lessonsData, pickerSectionId]);

  const handleLaunchFromPicker = () => {
    if (!pickerContentId) {
      toast.error('Please select a syllabus lesson');
      return;
    }
    const target = lessonsData.find(l => String(l.contentId) === String(pickerContentId));
    if (!target) return;
    setShowPickerModal(false);
    setActiveEditorContent({ id: target.contentId, title: target.title });
  };

  return (
    <div className="admin-page-container" style={{ padding: '24px 32px' }}>
      {/* Top Header */}
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '16px', marginBottom: '22px' }}>
        <div>
          <h1 style={{ margin: '0 0 6px', fontSize: '1.75rem', fontWeight: '800', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '42px',
              height: '42px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, rgba(90, 112, 211, 0.15), rgba(79, 70, 229, 0.15))',
              color: '#5A70D3'
            }}>
              <i className="fa-solid fa-list-check" style={{ fontSize: '1.25rem' }}></i>
            </span>
            Assessments &amp; Knowledge Tests
          </h1>
          <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
            Configure 1-mark evaluations, chapter quizzes, time limits, and passing targets for course syllabus lessons.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <button
            type="button"
            onClick={loadAllData}
            className="btn btn-secondary btn-sm"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            disabled={loading}
          >
            <i className={`fa-solid fa-arrows-rotate ${loading ? 'fa-spin' : ''}`}></i>
            Refresh
          </button>
          {!isReadOnly && (
            <button
              type="button"
              onClick={() => {
                setPickerCourseId(courses[0]?.id || '');
                setPickerSectionId('');
                setPickerContentId('');
                setShowPickerModal(true);
              }}
              className="btn btn-primary btn-sm"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: '#5A70D3', borderColor: '#5A70D3' }}
            >
              <i className="fa-solid fa-plus"></i>
              Create Assessment
            </button>
          )}
        </div>
      </div>

      {/* Metric Cards Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <div style={{ background: '#ffffff', borderRadius: '14px', padding: '18px 20px', border: '1px solid #e2e8f0', boxShadow: '0 2px 6px rgba(15, 23, 42, 0.03)' }}>
          <div style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', marginBottom: '6px' }}>Total Assessments</div>
          <div style={{ fontSize: '1.9rem', fontWeight: 900, color: '#0f172a' }}>{metrics.totalConfigured}</div>
          <div style={{ fontSize: '0.76rem', color: '#64748b', marginTop: '4px' }}>Across {courses.length} courses</div>
        </div>

        <div style={{ background: '#ffffff', borderRadius: '14px', padding: '18px 20px', border: '1px solid #e2e8f0', boxShadow: '0 2px 6px rgba(15, 23, 42, 0.03)' }}>
          <div style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', marginBottom: '6px' }}>Active Tests</div>
          <div style={{ fontSize: '1.9rem', fontWeight: 900, color: '#10b981' }}>{metrics.activeCount}</div>
          <div style={{ fontSize: '0.76rem', color: '#10b981', marginTop: '4px' }}>Available to enrolled students</div>
        </div>

        <div style={{ background: '#ffffff', borderRadius: '14px', padding: '18px 20px', border: '1px solid #e2e8f0', boxShadow: '0 2px 6px rgba(15, 23, 42, 0.03)' }}>
          <div style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', marginBottom: '6px' }}>Question Bank</div>
          <div style={{ fontSize: '1.9rem', fontWeight: 900, color: '#5A70D3' }}>{metrics.totalQuestions}</div>
          <div style={{ fontSize: '0.76rem', color: '#64748b', marginTop: '4px' }}>Total 1-mark MCQ items</div>
        </div>

        <div style={{ background: '#ffffff', borderRadius: '14px', padding: '18px 20px', border: '1px solid #e2e8f0', boxShadow: '0 2px 6px rgba(15, 23, 42, 0.03)' }}>
          <div style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', marginBottom: '6px' }}>Avg Passing Target</div>
          <div style={{ fontSize: '1.9rem', fontWeight: 900, color: '#8b5cf6' }}>{metrics.avgPassPct}%</div>
          <div style={{ fontSize: '0.76rem', color: '#64748b', marginTop: '4px' }}>Required score to pass</div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div style={{
        background: '#ffffff',
        borderRadius: '12px',
        padding: '16px 20px',
        border: '1px solid #e2e8f0',
        marginBottom: '20px',
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '14px'
      }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '12px', flex: 1, minWidth: '260px' }}>
          {/* Search Box */}
          <div style={{ position: 'relative', minWidth: '240px', flex: 1 }}>
            <i className="fa-solid fa-magnifying-glass" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }}></i>
            <input
              type="text"
              placeholder="Search by lesson or course..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px 8px 36px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                fontSize: '0.88rem'
              }}
            />
          </div>

          {/* Course Filter Dropdown */}
          <select
            value={selectedCourseId}
            onChange={e => setSelectedCourseId(e.target.value)}
            style={{
              padding: '8px 14px',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              fontSize: '0.88rem',
              background: '#ffffff',
              color: '#0f172a'
            }}
          >
            <option value="ALL">All Courses ({courses.length})</option>
            {courses.map(c => (
              <option key={c.id} value={c.id}>{c.title || c.name}</option>
            ))}
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            style={{
              padding: '8px 14px',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              fontSize: '0.88rem',
              background: '#ffffff',
              color: '#0f172a'
            }}
          >
            <option value="ALL">All Statuses</option>
            <option value="CONFIGURED">With Assessment ({metrics.totalConfigured})</option>
            <option value="MISSING">No Assessment Yet</option>
          </select>
        </div>

        <div style={{ fontSize: '0.82rem', color: '#64748b' }}>
          Showing <strong>{filteredLessons.length}</strong> lessons
        </div>
      </div>

      {/* Main Table / List */}
      <div style={{ background: '#ffffff', borderRadius: '14px', border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 4px 16px rgba(15, 23, 42, 0.02)' }}>
        {loading ? (
          <div style={{ padding: '60px 20px', textAlign: 'center', color: '#5A70D3' }}>
            <i className="fa-solid fa-circle-notch fa-spin" style={{ fontSize: '2rem', marginBottom: '12px', display: 'block' }}></i>
            <span>Scanning courses and assessments...</span>
          </div>
        ) : filteredLessons.length === 0 ? (
          <div style={{ padding: '60px 20px', textAlign: 'center', color: '#64748b' }}>
            <i className="fa-regular fa-folder-open" style={{ fontSize: '2.5rem', color: '#cbd5e1', marginBottom: '12px', display: 'block' }}></i>
            <h4 style={{ margin: '0 0 6px', fontSize: '1.05rem', color: '#0f172a', fontWeight: 800 }}>No lessons found</h4>
            <p style={{ margin: 0, fontSize: '0.86rem' }}>Try adjusting your search criteria or course filter.</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.88rem' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0', color: '#475569', fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  <th style={{ padding: '14px 18px' }}>Course &amp; Section</th>
                  <th style={{ padding: '14px 18px' }}>Lesson Topic</th>
                  <th style={{ padding: '14px 18px' }}>Questions</th>
                  <th style={{ padding: '14px 18px' }}>Passing Criteria</th>
                  <th style={{ padding: '14px 18px' }}>Time Limit</th>
                  <th style={{ padding: '14px 18px' }}>Status</th>
                  <th style={{ padding: '14px 18px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredLessons.map((item, idx) => {
                  const hasAss = item.assessment != null;
                  const isEnabled = hasAss && item.assessment.enabled;
                  const qCount = hasAss ? (item.assessment.questions?.length || 0) : 0;
                  const passPct = hasAss ? item.assessment.passPercentage : 60;
                  const timerStr = hasAss
                    ? (item.assessment.timerEnabled ? `${item.assessment.timerDurationMinutes} mins` : 'Untimed')
                    : '—';

                  return (
                    <tr
                      key={`${item.contentId}-${idx}`}
                      style={{
                        borderBottom: '1px solid #f1f5f9',
                        transition: 'background 0.15s ease'
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background = '#fafafa'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                    >
                      <td style={{ padding: '14px 18px' }}>
                        <div style={{ fontWeight: 800, color: '#0f172a', fontSize: '0.9rem' }}>{item.courseName}</div>
                        <div style={{ fontSize: '0.76rem', color: '#64748b', marginTop: '2px' }}>
                          <i className="fa-regular fa-folder" style={{ marginRight: '4px' }}></i>
                          {item.sectionTitle}
                        </div>
                      </td>
                      <td style={{ padding: '14px 18px' }}>
                        <div style={{ fontWeight: 700, color: '#1e293b' }}>{item.title}</div>
                        <div style={{ fontSize: '0.74rem', color: '#94a3b8' }}>ID: #{item.contentId}</div>
                      </td>
                      <td style={{ padding: '14px 18px' }}>
                        {hasAss ? (
                          <span style={{ fontWeight: 800, color: '#0f172a' }}>
                            {qCount} {qCount === 1 ? 'question' : 'questions'}
                          </span>
                        ) : (
                          <span style={{ color: '#94a3b8' }}>None</span>
                        )}
                      </td>
                      <td style={{ padding: '14px 18px' }}>
                        {hasAss ? (
                          <span style={{
                            padding: '3px 8px',
                            borderRadius: '6px',
                            background: '#f1f5f9',
                            fontWeight: 700,
                            color: '#475569',
                            fontSize: '0.78rem'
                          }}>
                            {passPct}% Pass Target
                          </span>
                        ) : (
                          <span style={{ color: '#94a3b8' }}>—</span>
                        )}
                      </td>
                      <td style={{ padding: '14px 18px' }}>
                        {hasAss ? (
                          <span style={{ color: '#475569', fontWeight: 600 }}>
                            <i className="fa-regular fa-clock" style={{ marginRight: '5px', color: '#64748b' }}></i>
                            {timerStr}
                          </span>
                        ) : (
                          <span style={{ color: '#94a3b8' }}>—</span>
                        )}
                      </td>
                      <td style={{ padding: '14px 18px' }}>
                        {hasAss ? (
                          isEnabled ? (
                            <span style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '5px',
                              padding: '3px 8px',
                              borderRadius: '9999px',
                              background: 'rgba(16, 185, 129, 0.12)',
                              color: '#10b981',
                              fontWeight: 800,
                              fontSize: '0.74rem'
                            }}>
                              <i className="fa-solid fa-circle-check"></i> Enabled
                            </span>
                          ) : (
                            <span style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '5px',
                              padding: '3px 8px',
                              borderRadius: '9999px',
                              background: '#fef3c7',
                              color: '#d97706',
                              fontWeight: 700,
                              fontSize: '0.74rem'
                            }}>
                              <i className="fa-solid fa-pause"></i> Disabled
                            </span>
                          )
                        ) : (
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px',
                            padding: '3px 8px',
                            borderRadius: '9999px',
                            background: '#f1f5f9',
                            color: '#94a3b8',
                            fontWeight: 600,
                            fontSize: '0.74rem'
                          }}>
                            Not Added
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '14px 18px', textAlign: 'right' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px' }}>
                          {hasAss ? (
                            <>
                              <button
                                type="button"
                                onClick={() => setActiveEditorContent({ id: item.contentId, title: item.title })}
                                className="btn btn-secondary btn-sm"
                                style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '0.8rem' }}
                                title="Edit assessment questions and configuration"
                              >
                                <i className="fa-solid fa-pen-to-square" style={{ color: '#5A70D3' }}></i>
                                Edit
                              </button>
                              {!isReadOnly && (
                                <button
                                  type="button"
                                  onClick={() => handleDeleteAssessment(item.contentId, item.title)}
                                  className="btn btn-outline-danger btn-sm"
                                  style={{ padding: '4px 8px', fontSize: '0.8rem' }}
                                  title="Delete this assessment"
                                >
                                  <i className="fa-regular fa-trash-can"></i>
                                </button>
                              )}
                            </>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setActiveEditorContent({ id: item.contentId, title: item.title })}
                              className="btn btn-primary btn-sm"
                              style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', background: '#5A70D3', borderColor: '#5A70D3', fontSize: '0.8rem' }}
                              title="Add new 1-mark assessment for this lesson"
                            >
                              <i className="fa-solid fa-plus"></i>
                              Add Assessment
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Picker Modal for "+ Create Assessment" */}
      {showPickerModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(15, 23, 42, 0.65)',
          backdropFilter: 'blur(3px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 99999,
          padding: '20px'
        }}>
          <div style={{
            background: '#ffffff',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '520px',
            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.2)',
            overflow: 'hidden'
          }}>
            <div style={{
              padding: '18px 24px',
              borderBottom: '1px solid #e2e8f0',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <i className="fa-solid fa-list-check" style={{ color: '#5A70D3' }}></i>
                Select Lesson for Assessment
              </h3>
              <button
                type="button"
                onClick={() => setShowPickerModal(false)}
                style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '1.2rem', cursor: 'pointer' }}
              >
                &times;
              </button>
            </div>

            <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                  Step 1: Choose Course
                </label>
                <select
                  value={pickerCourseId}
                  onChange={e => {
                    setPickerCourseId(e.target.value);
                    setPickerSectionId('');
                    setPickerContentId('');
                  }}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.9rem'
                  }}
                >
                  <option value="">-- Choose a Course --</option>
                  {courses.map(c => (
                    <option key={c.id} value={c.id}>{c.title || c.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                  Step 2: Choose Section
                </label>
                <select
                  value={pickerSectionId}
                  onChange={e => {
                    setPickerSectionId(e.target.value);
                    setPickerContentId('');
                  }}
                  disabled={!pickerCourseId || pickerSections.length === 0}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.9rem'
                  }}
                >
                  <option value="">-- Choose a Section --</option>
                  {pickerSections.map(s => (
                    <option key={s.id} value={s.id}>{s.title}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                  Step 3: Choose Lesson Topic
                </label>
                <select
                  value={pickerContentId}
                  onChange={e => setPickerContentId(e.target.value)}
                  disabled={!pickerSectionId || pickerLessons.length === 0}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.9rem'
                  }}
                >
                  <option value="">-- Choose a Lesson --</option>
                  {pickerLessons.map(l => (
                    <option key={l.contentId} value={l.contentId}>
                      {l.title} {l.assessment ? '(Has Assessment)' : '(No Assessment)'}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div style={{
              padding: '16px 24px',
              background: '#f8fafc',
              borderTop: '1px solid #e2e8f0',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '10px'
            }}>
              <button
                type="button"
                onClick={() => setShowPickerModal(false)}
                className="btn btn-secondary btn-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleLaunchFromPicker}
                disabled={!pickerContentId}
                className="btn btn-primary btn-sm"
                style={{ background: '#5A70D3', borderColor: '#5A70D3' }}
              >
                Proceed to Editor &rarr;
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Assessment Admin Editor Modal */}
      {activeEditorContent && (
        <AssessmentAdminEditor
          contentId={activeEditorContent.id}
          contentTitle={activeEditorContent.title}
          onClose={() => {
            setActiveEditorContent(null);
            loadAllData();
          }}
        />
      )}
    </div>
  );
}
