import { useState, useEffect, useMemo } from 'react';
import { listAdminCourses, getCourse } from '../../api/courses';
import { getCourseBatches } from '../../api/batches';
import { listSections, createSection } from '../../api/sections';
import { listContents, createContent } from '../../api/contents';
import { getAdminAssessment, getAdminAssessments, deleteAssessment } from '../../api/assessments';
import AssessmentAdminEditor from '../../components/assessments/AssessmentAdminEditor';
import { useNotification, confirmDialog } from '../../context/NotificationContext';
import { usePermission } from '../../hooks/usePermission';

export default function AdminAssessmentsPage() {
  const { toast } = useNotification();
  const { isReadOnly } = usePermission();

  const [loading, setLoading] = useState(true);
  const [courses, setCourses] = useState([]);
  const [assessmentsData, setAssessmentsData] = useState([]); // [{ courseId, courseName, batchName, contentId, title, assessment }]

  // Filters
  const [selectedCourseId, setSelectedCourseId] = useState('ALL');
  const [selectedBatchId, setSelectedBatchId] = useState('ALL');
  const [filterBatches, setFilterBatches] = useState([]);
  const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL' | 'CONFIGURED' | 'MISSING'
  const [searchQuery, setSearchQuery] = useState('');

  // Active Editor Modal
  const [activeEditorContent, setActiveEditorContent] = useState(null); // { id, title }

  // New Assessment Picker Modal: Course & Batch only
  const [showPickerModal, setShowPickerModal] = useState(false);
  const [pickerCourseId, setPickerCourseId] = useState('');
  const [pickerBatchId, setPickerBatchId] = useState('');
  const [pickerBatches, setPickerBatches] = useState([]);
  const [pickerLoadingBatches, setPickerLoadingBatches] = useState(false);
  const [pickerSubmitting, setPickerSubmitting] = useState(false);

  const loadAllData = async () => {
    setLoading(true);
    try {
      const coursesRes = await listAdminCourses();
      const courseList = Array.isArray(coursesRes) ? coursesRes : (coursesRes?.content || []);
      setCourses(courseList);

      // Pre-load batches for all courses
      const courseBatchesMap = {};
      await Promise.all(
        courseList.map(async (c) => {
          try {
            const b = await getCourseBatches(c.id);
            courseBatchesMap[c.id] = Array.isArray(b) ? b : [];
          } catch (e) {
            courseBatchesMap[c.id] = [];
          }
        })
      );

      const allItemsMap = new Map(); // key: contentId -> item

      // 1. Direct fetch from backend /admin/assessments endpoint
      try {
        const directAssessments = await getAdminAssessments();
        if (Array.isArray(directAssessments)) {
          directAssessments.forEach(ass => {
            if (!ass.contentId) return;
            const cBatches = courseBatchesMap[ass.courseId] || [];
            let matchedBatch = 'All Batches';
            for (const b of cBatches) {
              if (ass.contentTitle?.toLowerCase().includes(b.name.toLowerCase())) {
                matchedBatch = b.name;
                break;
              }
            }

            allItemsMap.set(ass.contentId, {
              courseId: ass.courseId,
              courseName: ass.courseName || 'Course',
              batchName: matchedBatch,
              sectionId: ass.sectionId,
              sectionTitle: ass.sectionTitle || 'Course Assessments',
              contentId: ass.contentId,
              title: ass.contentTitle || 'Assessment',
              assessment: ass
            });
          });
        }
      } catch (err) {
        console.warn('Failed to load from /admin/assessments:', err);
      }

      // 2. Also inspect sections & contents from curriculum across courses
      // (This discovers newly prepared assessment contents even before questions are saved)
      await Promise.all(
        courseList.map(async (c) => {
          try {
            const sections = await listSections(c.id, true);
            const batchList = courseBatchesMap[c.id] || [];

            if (Array.isArray(sections)) {
              await Promise.all(
                sections.map(async (sec) => {
                  try {
                    const contents = await listContents(sec.id, true);
                    if (Array.isArray(contents)) {
                      for (const lesson of contents) {
                        const isAssessmentType =
                          lesson.completionRule === 'ASSESSMENT' ||
                          sec.title?.toLowerCase().includes('assessment') ||
                          lesson.title?.toLowerCase().includes('assessment');

                        if (isAssessmentType) {
                          let matchedBatch = 'All Batches';
                          for (const b of batchList) {
                            if (lesson.title?.toLowerCase().includes(b.name.toLowerCase())) {
                              matchedBatch = b.name;
                              break;
                            }
                          }

                          // If already present from /admin/assessments, preserve it
                          if (allItemsMap.has(lesson.id)) {
                            const existing = allItemsMap.get(lesson.id);
                            existing.title = lesson.title || existing.title;
                            existing.courseName = c.title || c.name || existing.courseName;
                            existing.sectionTitle = sec.title || existing.sectionTitle;
                            existing.courseId = c.id;
                            existing.batchName = matchedBatch;
                          } else {
                            // Fetch assessment config for this content
                            let ass = null;
                            try {
                              ass = await getAdminAssessment(lesson.id);
                            } catch (e) {
                              ass = null;
                            }

                            allItemsMap.set(lesson.id, {
                              courseId: c.id,
                              courseName: c.title || c.name || 'Course',
                              batchName: matchedBatch,
                              sectionId: sec.id,
                              sectionTitle: sec.title || 'Course Section',
                              contentId: lesson.id,
                              title: lesson.title,
                              assessment: ass
                            });
                          }
                        }
                      }
                    }
                  } catch (e) {
                    console.warn(`Failed to list contents for section ${sec.id}:`, e);
                  }
                })
              );
            }
          } catch (e) {
            console.warn(`Failed to list sections for course ${c.id}:`, e);
          }
        })
      );

      setAssessmentsData(Array.from(allItemsMap.values()));
    } catch (err) {
      console.error('Failed to load assessments overview:', err);
      toast.error('Failed to load assessments data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllData();
  }, []);

  // When top course filter changes, load its batches for the batch filter
  useEffect(() => {
    if (selectedCourseId === 'ALL') {
      setFilterBatches([]);
      setSelectedBatchId('ALL');
      return;
    }
    getCourseBatches(selectedCourseId)
      .then(res => {
        const list = Array.isArray(res) ? res : [];
        setFilterBatches(list);
        setSelectedBatchId('ALL');
      })
      .catch(() => {
        setFilterBatches([]);
        setSelectedBatchId('ALL');
      });
  }, [selectedCourseId]);

  // When pickerCourseId changes, fetch batches for the selected course
  useEffect(() => {
    if (!pickerCourseId) {
      setPickerBatches([]);
      setPickerBatchId('');
      return;
    }
    setPickerLoadingBatches(true);
    getCourseBatches(pickerCourseId)
      .then(res => {
        const list = Array.isArray(res) ? res : [];
        setPickerBatches(list);
        if (list.length > 0) {
          setPickerBatchId(list[0].id);
        } else {
          setPickerBatchId('ALL');
        }
      })
      .catch(() => {
        setPickerBatches([]);
        setPickerBatchId('ALL');
      })
      .finally(() => {
        setPickerLoadingBatches(false);
      });
  }, [pickerCourseId]);

  // Compute Metrics
  const metrics = useMemo(() => {
    const totalItems = assessmentsData.length;
    const configuredAssessments = assessmentsData.filter(l => l.assessment != null);
    const totalConfigured = configuredAssessments.length;
    const activeCount = configuredAssessments.filter(l => l.assessment?.enabled).length;
    const totalQuestions = configuredAssessments.reduce((sum, l) => sum + (l.assessment?.questions?.length || 0), 0);
    const avgPassPct = totalConfigured > 0
      ? Math.round(configuredAssessments.reduce((sum, l) => sum + (l.assessment?.passPercentage || 60), 0) / totalConfigured)
      : 60;

    return {
      totalItems,
      totalConfigured,
      activeCount,
      totalQuestions,
      avgPassPct
    };
  }, [assessmentsData]);

  // Filtered Assessments
  const filteredList = useMemo(() => {
    return assessmentsData.filter(item => {
      // Course filter
      if (selectedCourseId !== 'ALL' && String(item.courseId) !== String(selectedCourseId)) {
        return false;
      }
      // Batch filter
      if (selectedBatchId !== 'ALL') {
        const targetBatchObj = filterBatches.find(b => String(b.id) === String(selectedBatchId));
        if (targetBatchObj && item.batchName !== targetBatchObj.name && item.batchName !== 'All Batches') {
          return false;
        }
      }
      // Status filter
      if (statusFilter === 'CONFIGURED' && !item.assessment) return false;
      if (statusFilter === 'MISSING' && item.assessment) return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = item.title?.toLowerCase().includes(q);
        const matchCourse = item.courseName?.toLowerCase().includes(q);
        const matchBatch = item.batchName?.toLowerCase().includes(q);
        if (!matchTitle && !matchCourse && !matchBatch) return false;
      }

      return true;
    });
  }, [assessmentsData, selectedCourseId, selectedBatchId, filterBatches, statusFilter, searchQuery]);

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

  // Launch Editor from Course & Batch selection
  const handleLaunchFromPicker = async () => {
    if (!pickerCourseId) {
      toast.error('Please choose a course');
      return;
    }

    setPickerSubmitting(true);
    try {
      const selectedCourse = courses.find(c => String(c.id) === String(pickerCourseId));
      const courseTitle = selectedCourse?.title || selectedCourse?.name || 'Course';
      const selectedBatch = pickerBatches.find(b => String(b.id) === String(pickerBatchId));
      const batchName = selectedBatch ? selectedBatch.name : 'All Batches';

      const assessmentTitle = `${batchName} Assessment`;

      // 1. Get sections for course; find or create an "Assessments" section
      const sections = await listSections(pickerCourseId);
      let targetSection = (sections || []).find(s => s.title && s.title.toLowerCase().includes('assessment'));
      if (!targetSection) {
        try {
          targetSection = await createSection(pickerCourseId, {
            title: 'Course Assessments & Tests',
            description: 'Evaluations and knowledge quizzes'
          });
        } catch (secErr) {
          // If section creation fails or already exists, fallback to first available section
          if (sections && sections.length > 0) {
            targetSection = sections[0];
          } else {
            throw secErr;
          }
        }
      }

      // 2. Find or create content for this batch assessment
      const contents = await listContents(targetSection.id);
      let targetContent = (contents || []).find(c =>
        c.title === assessmentTitle ||
        (selectedBatch && c.title?.toLowerCase().includes(selectedBatch.name.toLowerCase()))
      );

      if (!targetContent) {
        targetContent = await createContent(targetSection.id, {
          title: assessmentTitle,
          description: `Knowledge assessment for ${courseTitle} (${batchName})`,
          contentType: 'PDF',
          mediaReference: 'https://placeholder.onetutor.com/assessment.pdf',
          completionRule: 'ASSESSMENT'
        });
      }

      setShowPickerModal(false);
      setActiveEditorContent({
        id: targetContent.id,
        title: `${courseTitle} • ${assessmentTitle}`
      });
    } catch (err) {
      console.error('Failed to prepare assessment for selected batch:', err);
      toast.error('Failed to prepare assessment. Please try again.');
    } finally {
      setPickerSubmitting(false);
    }
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
            Configure 1-mark evaluations, batch quizzes, time limits, and passing targets for enrolled students.
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
                setPickerBatchId('');
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
          <div style={{ position: 'relative', minWidth: '220px', flex: 1 }}>
            <i className="fa-solid fa-magnifying-glass" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }}></i>
            <input
              type="text"
              placeholder="Search by assessment, course, batch..."
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

          {/* Batch Filter Dropdown (populated for selected course) */}
          <select
            value={selectedBatchId}
            onChange={e => setSelectedBatchId(e.target.value)}
            disabled={selectedCourseId === 'ALL'}
            style={{
              padding: '8px 14px',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              fontSize: '0.88rem',
              background: '#ffffff',
              color: '#0f172a'
            }}
          >
            <option value="ALL">All Batches</option>
            {filterBatches.map(b => (
              <option key={b.id} value={b.id}>{b.name}</option>
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
          Showing <strong>{filteredList.length}</strong> modules
        </div>
      </div>

      {/* Main Table / List */}
      <div style={{ background: '#ffffff', borderRadius: '14px', border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 4px 16px rgba(15, 23, 42, 0.02)' }}>
        {loading ? (
          <div style={{ padding: '60px 20px', textAlign: 'center', color: '#5A70D3' }}>
            <i className="fa-solid fa-circle-notch fa-spin" style={{ fontSize: '2rem', marginBottom: '12px', display: 'block' }}></i>
            <span>Scanning courses and batch assessments...</span>
          </div>
        ) : filteredList.length === 0 ? (
          <div style={{ padding: '60px 20px', textAlign: 'center', color: '#64748b' }}>
            <i className="fa-regular fa-folder-open" style={{ fontSize: '2.5rem', color: '#cbd5e1', marginBottom: '12px', display: 'block' }}></i>
            <h4 style={{ margin: '0 0 6px', fontSize: '1.05rem', color: '#0f172a', fontWeight: 800 }}>No assessments found</h4>
            <p style={{ margin: 0, fontSize: '0.86rem' }}>Click "+ Create Assessment" above to add an assessment for a course batch.</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.88rem' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0', color: '#475569', fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  <th style={{ padding: '14px 18px' }}>Course</th>
                  <th style={{ padding: '14px 18px' }}>Batch</th>
                  <th style={{ padding: '14px 18px' }}>Assessment Title</th>
                  <th style={{ padding: '14px 18px' }}>Questions</th>
                  <th style={{ padding: '14px 18px' }}>Passing Criteria</th>
                  <th style={{ padding: '14px 18px' }}>Time Limit</th>
                  <th style={{ padding: '14px 18px' }}>Status</th>
                  <th style={{ padding: '14px 18px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredList.map((item, idx) => {
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
                      </td>
                      <td style={{ padding: '14px 18px' }}>
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          padding: '3px 8px',
                          borderRadius: '6px',
                          background: '#ede9fe',
                          color: '#6d28d9',
                          fontWeight: 700,
                          fontSize: '0.76rem'
                        }}>
                          <i className="fa-solid fa-users-rectangle"></i>
                          {item.batchName}
                        </span>
                      </td>
                      <td style={{ padding: '14px 18px' }}>
                        <div style={{ fontWeight: 700, color: '#1e293b' }}>{item.title}</div>
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
                              title="Add new 1-mark assessment for this batch"
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

      {/* Picker Modal for "+ Create Assessment": ONLY Choose Course & Choose Batch */}
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
            maxWidth: '500px',
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
                Select Course &amp; Batch for Assessment
              </h3>
              <button
                type="button"
                onClick={() => setShowPickerModal(false)}
                style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '1.2rem', cursor: 'pointer' }}
              >
                &times;
              </button>
            </div>

            <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
              {/* Option 1: Choose Course */}
              <div>
                <label style={{ display: 'block', fontSize: '0.86rem', fontWeight: 700, color: '#334155', marginBottom: '8px' }}>
                  Choose Course
                </label>
                <select
                  value={pickerCourseId}
                  onChange={e => setPickerCourseId(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '11px 14px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.92rem',
                    background: '#ffffff',
                    color: '#0f172a'
                  }}
                >
                  <option value="">-- Choose a Course --</option>
                  {courses.map(c => (
                    <option key={c.id} value={c.id}>{c.title || c.name}</option>
                  ))}
                </select>
              </div>

              {/* Option 2: Choose Batch (only batches for selected course) */}
              <div>
                <label style={{ display: 'block', fontSize: '0.86rem', fontWeight: 700, color: '#334155', marginBottom: '8px' }}>
                  Choose Batch {pickerLoadingBatches && <span style={{ fontSize: '0.76rem', color: '#5A70D3' }}>(Loading batches...)</span>}
                </label>
                <select
                  value={pickerBatchId}
                  onChange={e => setPickerBatchId(e.target.value)}
                  disabled={!pickerCourseId || pickerLoadingBatches}
                  style={{
                    width: '100%',
                    padding: '11px 14px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.92rem',
                    background: !pickerCourseId ? '#f8fafc' : '#ffffff',
                    color: '#0f172a'
                  }}
                >
                  {!pickerCourseId ? (
                    <option value="">-- First select a course above --</option>
                  ) : pickerBatches.length === 0 ? (
                    <option value="ALL">All Batches (General Batch)</option>
                  ) : (
                    <>
                      <option value="ALL">All Batches (General Batch)</option>
                      {pickerBatches.map(b => (
                        <option key={b.id} value={b.id}>
                          {b.name} ({b.code})
                        </option>
                      ))}
                    </>
                  )}
                </select>
                <span style={{ fontSize: '0.74rem', color: '#64748b', marginTop: '6px', display: 'block' }}>
                  Showing batches assigned exclusively to the chosen course.
                </span>
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
                disabled={pickerSubmitting}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleLaunchFromPicker}
                disabled={!pickerCourseId || pickerSubmitting}
                className="btn btn-primary btn-sm"
                style={{ background: '#5A70D3', borderColor: '#5A70D3', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                {pickerSubmitting ? (
                  <>
                    <i className="fa-solid fa-circle-notch fa-spin"></i>
                    Preparing...
                  </>
                ) : (
                  <>Proceed to Editor &rarr;</>
                )}
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
          backLabel="Back to Assessments"
          onClose={() => {
            setActiveEditorContent(null);
            loadAllData();
          }}
        />
      )}
    </div>
  );
}
