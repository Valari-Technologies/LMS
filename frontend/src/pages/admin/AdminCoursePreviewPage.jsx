import { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { previewCourse, publishCourse, approveCourseEdits } from '../../api/courses';
import { listSections } from '../../api/sections';
import { listContents } from '../../api/contents';
import CourseCard from '../../components/CourseCard';
import { usePermission } from '../../hooks/usePermission';
import { useAuth } from '../../auth/AuthContext';
import { useNotification } from '../../context/NotificationContext';

export default function AdminCoursePreviewPage() {
  const { isReadOnly } = usePermission();
  const { user } = useAuth();
  const { toast } = useNotification();
  const { id } = useParams();
  const [course, setCourse] = useState(null);
  const [rawCourse, setRawCourse] = useState(null);
  const [proposedEdits, setProposedEdits] = useState(null);
  const [diffMode, setDiffMode] = useState('diff'); // 'diff' | 'proposed' | 'live'
  const [sections, setSections] = useState([]);
  const [sectionContents, setSectionContents] = useState({});
  const [expandedSections, setExpandedSections] = useState({});
  const [loading, setLoading] = useState(true);

  const canPublish = user?.role === 'super_admin' || user?.role === 'superadmin' || user?.role === 'admin';

  async function handleApprovePublish() {
    try {
      await approveCourseEdits(id);
      toast.success('Course edits approved and published live to student pages!');
      loadPreview();
    } catch (err) {
      toast.error('Failed to approve course edits.');
    }
  }

  // Active view: 'page' (Course Details Landing Page) or 'player' (Curriculum Lesson Player)
  const [activeTab, setActiveTab] = useState('page');

  // Player state
  const [activeSectionId, setActiveSectionId] = useState(null);
  const [activeContent, setActiveContent] = useState(null);

  const landingRef = useRef(null);

  useEffect(() => {
    loadPreview();
  }, [id]);

  async function loadPreview() {
    setLoading(true);
    try {
      const courseData = await previewCourse(id);
      setRawCourse(courseData);
      let proposed = null;
      if ((courseData.pendingApproval || courseData.pending_approval) && (courseData.pendingEdits || courseData.pending_edits)) {
        try {
          proposed = JSON.parse(courseData.pendingEdits || courseData.pending_edits);
          setProposedEdits(proposed);
        } catch (e) {
          console.error('Failed to parse pendingEdits in preview page:', e);
        }
      }
      const effectiveCourse = proposed ? { ...courseData, ...proposed } : courseData;
      setCourse(effectiveCourse);

      const secData = await listSections(id);
      const safeSections = secData || [];
      setSections(safeSections);

      // Load contents for all sections
      const map = {};
      const exp = {};
      for (let i = 0; i < safeSections.length; i++) {
        const s = safeSections[i];
        exp[s.id] = i === 0; // Expand first section by default
        try {
          const contents = await listContents(s.id);
          map[s.id] = contents || [];
        } catch {
          map[s.id] = [];
        }
      }
      setSectionContents(map);
      setExpandedSections(exp);

      if (safeSections.length > 0) {
        setActiveSectionId(safeSections[0].id);
        const firstSecContents = map[safeSections[0].id] || [];
        if (firstSecContents.length > 0) {
          setActiveContent(firstSecContents[0]);
        }
      }
    } catch (e) {
      console.error('Failed to load course preview:', e);
    } finally {
      setLoading(false);
    }
  }

  const toggleSectionAccordion = (secId) => {
    setExpandedSections((prev) => ({ ...prev, [secId]: !prev[secId] }));
  };

  const toggleAllSections = () => {
    const allExpanded = sections.every((s) => expandedSections[s.id]);
    const nextState = {};
    sections.forEach((s) => {
      nextState[s.id] = !allExpanded;
    });
    setExpandedSections(nextState);
  };

  const handleSelectSectionPlayer = (secId) => {
    setActiveSectionId(secId);
    const contents = sectionContents[secId] || [];
    setActiveContent(contents.length > 0 ? contents[0] : null);
  };

  const openLessonInPlayer = (secId, lecture) => {
    setActiveSectionId(secId);
    setActiveContent(lecture);
    setActiveTab('player');
  };

  if (loading) {
    return (
      <div className="page" style={{ textAlign: 'center', padding: '100px 0', color: 'var(--text-muted)' }}>
        <i className="fa-solid fa-spinner fa-spin" style={{ fontSize: '1.8rem', marginBottom: '14px', color: 'var(--accent-primary)' }}></i>
        <p>Loading course preview environment…</p>
      </div>
    );
  }

  if (!course) {
    return (
      <div className="page">
        <div className="form-error">Course not found or unavailable for preview.</div>
      </div>
    );
  }

  const totalLectures = Object.values(sectionContents).reduce(
    (acc, curr) => acc + (curr?.length || 0),
    0
  );

  // Learning outcomes - ONLY what was added in course form
  const rawOutcomesList = rawCourse?.learningOutcomes
    ? rawCourse.learningOutcomes.split('\n').map((s) => s.trim()).filter(Boolean)
    : [];

  const outcomesList = course.learningOutcomes
    ? course.learningOutcomes.split('\n').map((s) => s.trim()).filter(Boolean)
    : [];

  // Prerequisites - ONLY what was added in course form
  const rawPrereqsList = rawCourse?.prerequisites
    ? rawCourse.prerequisites.split('\n').map((s) => s.trim()).filter(Boolean)
    : [];

  const prereqsList = course.prerequisites
    ? course.prerequisites.split('\n').map((s) => s.trim()).filter(Boolean)
    : [];

  return (
    <div className="page">
      {/* Top Admin Preview Banner & Controls */}
      <div
        style={{
          background: 'var(--accent-subtle)',
          border: '1px solid var(--accent-ring)',
          borderRadius: 'var(--radius-lg)',
          padding: '14px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '14px',
          marginBottom: '24px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '8px',
              background: 'var(--accent-primary)',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1rem'
            }}
          >
            <i className="fa-solid fa-eye"></i>
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <strong style={{ color: 'var(--text-primary)', fontSize: '1.05rem' }}>
                {(rawCourse?.pendingApproval || rawCourse?.pending_approval || proposedEdits)
                  ? 'Edit Verification Preview'
                  : 'Common Student Preview'}
              </strong>
              {(rawCourse?.pendingApproval || rawCourse?.pending_approval || proposedEdits) ? (
                <span style={{
                  background: 'rgba(90, 112, 211, 0.18)',
                  color: '#111111',
                  border: '1px solid rgba(90, 112, 211, 0.35)',
                  padding: '2px 8px',
                  borderRadius: '9999px',
                  fontSize: '0.72rem',
                  fontWeight: 800,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px'
                }}>
                  <i className="fa-solid fa-clock"></i> Pending Approval
                </span>
              ) : (
                <span className={`status-badge ${course.status}`}>{course.status}</span>
              )}
            </div>
            <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '2px' }}>
              {(rawCourse?.pendingApproval || rawCourse?.pending_approval || proposedEdits)
                ? 'Verifying proposed content creator edits against live course details'
                : 'Previewing live published course as seen by enrolled students'}
            </div>
          </div>
        </div>

        {/* View Switcher Tabs & Quick Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <div style={{ display: 'inline-flex', background: 'var(--bg-surface)', padding: '4px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-default)' }}>
            <button
              onClick={() => setActiveTab('page')}
              className={`btn btn-sm ${activeTab === 'page' ? 'btn-primary' : 'btn-ghost'}`}
              style={{ padding: '6px 14px', fontSize: '0.86rem', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <i className="fa-solid fa-desktop"></i>
              <span>Course Page</span>
            </button>
            <button
              onClick={() => setActiveTab('player')}
              className={`btn btn-sm ${activeTab === 'player' ? 'btn-primary' : 'btn-ghost'}`}
              style={{ padding: '6px 14px', fontSize: '0.86rem', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <i className="fa-solid fa-circle-play"></i>
              <span>Curriculum Player</span>
            </button>
          </div>

          {!isReadOnly && (
            <Link to={`/admin/courses/${course.id}/edit`} className="btn btn-secondary btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              <i className="fa-solid fa-pen-to-square"></i>
              <span>Edit Course</span>
            </Link>
          )}
          <Link to="/admin/courses" className="btn btn-outline btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <i className="fa-solid fa-arrow-left"></i>
            <span>All Courses</span>
          </Link>
        </div>
      </div>

      {(canPublish && (rawCourse?.pendingApproval || rawCourse?.pending_approval || course?.status === 'draft')) && (
        <div style={{
          background: 'linear-gradient(135deg, #E8EBFA 0%, #FFFFFF 100%)',
          border: '1px solid #E8EBFA',
          borderRadius: '16px',
          padding: '18px 24px',
          marginBottom: '28px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '16px',
          boxShadow: '0 4px 18px rgba(90, 112, 211, 0.12)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: '#5A70D3', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.3rem', flexShrink: 0 }}>
              <i className="fa-solid fa-code-compare"></i>
            </div>
            <div>
              <div style={{ fontWeight: 800, color: '#18131F', fontSize: '1.05rem', marginBottom: '2px' }}>Pending Content Creator Edits</div>
              <div style={{ color: '#5F5868', fontSize: '0.86rem' }}>
                Content Creator submitted edits pending Super Admin approval. Proposed changes highlighted below.
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            {/* View Switcher */}
            {proposedEdits && (
              <div style={{ display: 'inline-flex', background: '#ffffff', padding: '3px', borderRadius: '10px', border: '1px solid #E8E8E8' }}>
                <button
                  type="button"
                  onClick={() => setDiffMode('proposed')}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '8px',
                    border: 'none',
                    background: diffMode !== 'live' ? '#5A70D3' : 'transparent',
                    color: diffMode !== 'live' ? '#ffffff' : '#5F5868',
                    fontWeight: 700,
                    fontSize: '0.82rem',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px'
                  }}
                >
                  <i className="fa-solid fa-sparkles"></i> Proposed View (Highlighted)
                </button>

                <button
                  type="button"
                  onClick={() => setDiffMode('live')}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '8px',
                    border: 'none',
                    background: diffMode === 'live' ? '#5A70D3' : 'transparent',
                    color: diffMode === 'live' ? '#ffffff' : '#5F5868',
                    fontWeight: 700,
                    fontSize: '0.82rem',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px'
                  }}
                >
                  <i className="fa-solid fa-clock-rotate-left"></i> Current Live View
                </button>
              </div>
            )}

            <button
              onClick={handleApprovePublish}
              className="btn btn-primary"
              style={{ background: '#5A70D3', color: '#FFFFFF', fontWeight: 800, padding: '10px 22px', borderRadius: '10px', display: 'inline-flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 14px rgba(90, 112, 211, 0.3)' }}
            >
              <i className="fa-solid fa-circle-check"></i>
              <span>Approve & Publish Live</span>
            </button>
          </div>
        </div>
      )}

      {/* Catalog Card Preview */}
      <div style={{ marginBottom: '32px' }}>
        <div
          style={{
            fontSize: '0.8rem',
            fontWeight: '700',
            letterSpacing: '0.08em',
            color: 'var(--text-muted)',
            textTransform: 'uppercase',
            marginBottom: '14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            maxWidth: '380px'
          }}
        >
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
            <i className="fa-solid fa-id-card" style={{ color: 'var(--accent-primary)' }}></i>
            Student Catalog Card Preview
          </span>
          <span style={{ fontSize: '0.72rem', textTransform: 'none', color: 'var(--accent-primary)', fontWeight: 600 }}>
            Click card to view page
          </span>
        </div>

        {/* The Card Component with onClick staying 100% inside Admin */}
        <div style={{ maxWidth: '280px' }}>
          <CourseCard
            course={diffMode === 'live' ? rawCourse : course}
            isEnrolled={false}
            disableLink={true}
            onClick={() => {
              setActiveTab('page');
              if (landingRef.current) {
                landingRef.current.scrollIntoView({ behavior: 'smooth' });
              }
            }}
          />
        </div>
      </div>

      <div ref={landingRef} style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '28px' }}>
        {/* ====================================================================
            VIEW 1: COURSE LANDING PAGE PREVIEW (ONLY ENTERED FORM DATA)
            ==================================================================== */}
        {activeTab === 'page' && (
          <div>
            <div
              style={{
                fontSize: '0.8rem',
                fontWeight: '700',
                letterSpacing: '0.08em',
                color: 'var(--text-muted)',
                textTransform: 'uppercase',
                marginBottom: '16px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <i className="fa-solid fa-chalkboard" style={{ color: 'var(--accent-primary)' }}></i>
              {(rawCourse?.pendingApproval || rawCourse?.pending_approval || proposedEdits)
                ? 'Proposed Edits Verification Preview'
                : 'Common Student Landing Page Preview'}
            </div>

            {/* Course Landing Hero Banner */}
            <div
              style={{
                background: '#1c1d1f',
                color: '#ffffff',
                borderRadius: 'var(--radius-lg)',
                padding: '36px 32px',
                marginBottom: '28px',
                boxShadow: '0 8px 24px rgba(0,0,0,0.15)'
              }}
            >
              {/* Category Breadcrumb */}
              <div style={{ fontSize: '0.86rem', color: '#c084fc', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600 }}>
                <span>Courses</span>
                <span style={{ opacity: 0.5 }}>›</span>
                <span>{course.categoryName || 'General'}</span>
                <span style={{ opacity: 0.5 }}>›</span>
                <span style={{ color: '#ffffff' }}>{course.name}</span>
              </div>

              {/* Course Title & Description Rendering */}
              <h1 style={{
                fontSize: '2.1rem',
                fontWeight: 800,
                lineHeight: 1.25,
                marginBottom: '12px',
                color: (diffMode !== 'live' && proposedEdits?.name && proposedEdits.name !== rawCourse?.name) ? '#6ee7b7' : '#ffffff',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                flexWrap: 'wrap'
              }}>
                <span>{diffMode === 'live' ? rawCourse?.name : course.name}</span>
                {(diffMode !== 'live' && proposedEdits?.name && proposedEdits.name !== rawCourse?.name) && (
                  <span style={{ fontSize: '0.75rem', background: 'rgba(16, 185, 129, 0.25)', color: '#6ee7b7', border: '1px solid #10b981', padding: '2px 8px', borderRadius: '6px', fontWeight: 800 }}>PROPOSED EDITS</span>
                )}
              </h1>
              {(diffMode === 'live' ? rawCourse?.shortDesc : course.shortDesc) && (
                <p style={{
                  fontSize: '1.05rem',
                  lineHeight: 1.6,
                  color: (diffMode !== 'live' && proposedEdits?.shortDesc && proposedEdits.shortDesc !== rawCourse?.shortDesc) ? '#6ee7b7' : '#d1d5db',
                  maxWidth: '820px',
                  marginBottom: '18px',
                  fontWeight: (diffMode !== 'live' && proposedEdits?.shortDesc && proposedEdits.shortDesc !== rawCourse?.shortDesc) ? 600 : 400
                }}>
                  {diffMode === 'live' ? rawCourse?.shortDesc : course.shortDesc}
                </p>
              )}

              {/* Attributes from course form */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap', fontSize: '0.9rem', color: '#e5e7eb', marginTop: '14px' }}>
                {course.categoryName && (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'rgba(255,255,255,0.12)', padding: '4px 10px', borderRadius: '4px' }}>
                    <i className="fa-solid fa-tag" style={{ color: '#c084fc' }}></i>
                    <strong>{course.categoryName}</strong>
                  </span>
                )}
                {course.level && (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                    <i className="fa-solid fa-signal" style={{ color: '#c084fc' }}></i>
                    <span>{course.level} Level</span>
                  </span>
                )}
                {course.duration && (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                    <i className="fa-regular fa-clock" style={{ color: '#c084fc' }}></i>
                    <span>{course.duration}</span>
                  </span>
                )}
                {course.language && (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                    <i className="fa-solid fa-globe" style={{ color: '#c084fc' }}></i>
                    <span>{course.language}</span>
                  </span>
                )}
              </div>
            </div>

            {/* Two-Column Details Layout */}
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 340px', gap: '32px', alignItems: 'start' }}>
              {/* Left Main Content Column */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
                {/* What You'll Learn Box - ONLY if entered in form */}
                {outcomesList.length > 0 && (
                  <div
                    style={{
                      border: '1px solid var(--border-default)',
                      background: 'var(--bg-card)',
                      borderRadius: 'var(--radius-md)',
                      padding: '24px'
                    }}
                  >
                    <h2 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '16px', color: 'var(--text-primary)' }}>
                      What you'll learn
                    </h2>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '12px' }}>
                      {outcomesList.map((item, idx) => {
                        const hasPending = proposedEdits || rawCourse?.pendingApproval || rawCourse?.pending_approval || course?.pendingApproval || course?.pending_approval;
                        const isNewItem = (diffMode !== 'live' && hasPending) && (
                          idx >= rawOutcomesList.length ||
                          rawOutcomesList[idx] !== item
                        );
                        return (
                          <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', fontSize: '0.92rem', color: isNewItem ? '#10b981' : 'var(--text-secondary)', fontWeight: isNewItem ? 700 : 400, lineHeight: 1.5 }}>
                            <span style={{ color: isNewItem ? '#10b981' : 'var(--accent-primary)', marginTop: '3px', fontSize: '0.85rem' }}>
                              <i className="fa-solid fa-check"></i>
                            </span>
                            <span>{item}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Course Content / Curriculum Accordion */}
                <div
                  style={{
                    border: '1px solid var(--border-default)',
                    background: 'var(--bg-card)',
                    borderRadius: 'var(--radius-md)',
                    padding: '24px'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
                    <div>
                      <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                        Course content
                      </h2>
                      <div style={{ fontSize: '0.88rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                        {sections.length} sections • {totalLectures > 0 ? `${totalLectures} lectures & resources` : 'Overview'} {course.duration ? `• ${course.duration}` : ''}
                      </div>
                    </div>
                    {sections.length > 0 && (
                      <button
                        onClick={toggleAllSections}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: 'var(--accent-primary)',
                          fontWeight: 700,
                          fontSize: '0.86rem',
                          cursor: 'pointer'
                        }}
                      >
                        {sections.every((s) => expandedSections[s.id]) ? 'Collapse all sections' : 'Expand all sections'}
                      </button>
                    )}
                  </div>

                  {sections.length === 0 ? (
                    <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.9rem', background: 'var(--bg-surface)', borderRadius: 'var(--radius-sm)' }}>
                      No sections added to this course yet.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {sections.map((sec, idx) => {
                        const isExpanded = expandedSections[sec.id];
                        const lectures = sectionContents[sec.id] || [];

                        // Determine if section is newly added proposal during pending approval
                        const secStatusLower = (sec.status || '').toLowerCase();
                        const isNewSec = Boolean(
                          diffMode !== 'live' && (
                            secStatusLower === 'pending_approval' ||
                            secStatusLower === 'pending' ||
                            secStatusLower === 'draft' ||
                            sec.isNew ||
                            sec.isDraft ||
                            (proposedEdits?.addedSectionIds && proposedEdits.addedSectionIds.includes(sec.id))
                          )
                        );

                        return (
                          <div
                            key={sec.id}
                            style={{
                              border: isNewSec ? '1.5px solid #86efac' : '1px solid var(--border-subtle)',
                              borderRadius: 'var(--radius-sm)',
                              overflow: 'hidden',
                              background: isNewSec ? 'rgba(16, 185, 129, 0.05)' : 'var(--bg-surface)'
                            }}
                          >
                            <button
                              onClick={() => toggleSectionAccordion(sec.id)}
                              style={{
                                width: '100%',
                                padding: '12px 16px',
                                background: 'transparent',
                                border: 'none',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                cursor: 'pointer',
                                textAlign: 'left',
                                color: isNewSec ? '#10b981' : 'var(--text-primary)',
                                fontWeight: 700,
                                fontSize: '0.92rem'
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                                <i
                                  className="fa-solid fa-chevron-down"
                                  style={{
                                    fontSize: '0.75rem',
                                    transform: isExpanded ? 'rotate(180deg)' : 'none',
                                    transition: 'transform 0.15s ease',
                                    color: isNewSec ? '#10b981' : 'var(--text-muted)'
                                  }}
                                ></i>
                                <span>Section {idx + 1}: {sec.title}</span>
                              </div>
                              <span style={{ fontSize: '0.82rem', color: isNewSec ? '#10b981' : 'var(--text-muted)', fontWeight: 600 }}>
                                {lectures.length > 0 ? `${lectures.length} lessons` : 'Empty'}
                              </span>
                            </button>

                            {isExpanded && (
                              <div style={{ borderTop: isNewSec ? '1px solid #86efac' : '1px solid var(--border-subtle)', background: 'var(--bg-card)' }}>
                                {sec.description && (
                                  <div style={{ padding: '10px 16px', fontSize: '0.84rem', color: isNewSec ? '#10b981' : 'var(--text-secondary)', fontStyle: 'italic' }}>
                                    {sec.description}
                                  </div>
                                )}
                                {lectures.length === 0 ? (
                                  <div style={{ padding: '12px 16px', fontSize: '0.84rem', color: 'var(--text-muted)' }}>
                                    No lesson items configured for this section.
                                  </div>
                                ) : (
                                  lectures.map((lec) => (
                                    <div
                                      key={lec.id}
                                      onClick={() => openLessonInPlayer(sec.id, lec)}
                                      style={{
                                        padding: '10px 16px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        borderTop: '1px solid var(--border-subtle)',
                                        cursor: 'pointer',
                                        fontSize: '0.88rem'
                                      }}
                                    >
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                        <span style={{ color: isNewSec ? '#10b981' : 'var(--accent-primary)', width: '16px', textAlign: 'center' }}>
                                          {lec.contentType === 'VIDEO' ? (
                                            <i className="fa-solid fa-circle-play"></i>
                                          ) : lec.contentType === 'PDF' ? (
                                            <i className="fa-solid fa-file-pdf" style={{ color: isNewSec ? '#10b981' : '#ef4444' }}></i>
                                          ) : (
                                            <i className="fa-solid fa-paperclip"></i>
                                          )}
                                        </span>
                                        <span style={{ color: isNewSec ? '#10b981' : 'var(--text-primary)', fontWeight: isNewSec ? 700 : 500 }}>
                                          {lec.title}
                                        </span>
                                      </div>
                                      <span style={{ fontSize: '0.78rem', color: isNewSec ? '#10b981' : 'var(--accent-primary)', fontWeight: 600 }}>
                                        Preview lesson ↗
                                      </span>
                                    </div>
                                  ))
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Requirements - ONLY if entered in form */}
                {prereqsList.length > 0 && (
                  <div
                    style={{
                      border: '1px solid var(--border-default)',
                      background: 'var(--bg-card)',
                      borderRadius: 'var(--radius-md)',
                      padding: '24px'
                    }}
                  >
                    <h2 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '14px', color: 'var(--text-primary)' }}>
                      Requirements
                    </h2>
                    <ul style={{ paddingLeft: '20px', margin: 0, display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.92rem' }}>
                      {prereqsList.map((p, idx) => {
                        const hasPending = proposedEdits || rawCourse?.pendingApproval || rawCourse?.pending_approval || course?.pendingApproval || course?.pending_approval;
                        const isNewPrereq = (diffMode !== 'live' && hasPending) && (
                          idx >= rawPrereqsList.length ||
                          rawPrereqsList[idx] !== p
                        );
                        return (
                          <li key={idx} style={{ lineHeight: 1.55, color: isNewPrereq ? '#10b981' : 'var(--text-secondary)', fontWeight: isNewPrereq ? 700 : 400 }}>
                            <span>{p}</span>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}

                {/* Full Description - ONLY if entered in form */}
                {course.description && (() => {
                  const hasPending = proposedEdits || rawCourse?.pendingApproval || rawCourse?.pending_approval || course?.pendingApproval || course?.pending_approval;
                  const rawDescLines = (rawCourse?.description || '').split('\n');
                  const descLines = (course.description || '').split('\n');

                  return (
                    <div
                      style={{
                        border: '1px solid var(--border-default)',
                        background: 'var(--bg-card)',
                        borderRadius: 'var(--radius-md)',
                        padding: '24px'
                      }}
                    >
                      <h2 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '14px', color: 'var(--text-primary)' }}>
                        Description
                      </h2>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {descLines.map((line, idx) => {
                          const isLineNew = (diffMode !== 'live' && hasPending) && (
                            idx >= rawDescLines.length ||
                            rawDescLines[idx]?.trim() !== line.trim()
                          );
                          return (
                            <div key={idx} style={{
                              color: isLineNew ? '#10b981' : 'var(--text-secondary)',
                              fontWeight: isLineNew ? 700 : 400,
                              lineHeight: 1.65,
                              fontSize: '0.94rem'
                            }}>
                              <span>{line}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Right Column: Sticky Admin Preview Summary Card */}
              <div style={{ position: 'sticky', top: '24px' }}>
                <div
                  style={{
                    border: '1px solid var(--border-default)',
                    background: 'var(--bg-card)',
                    borderRadius: 'var(--radius-lg)',
                    overflow: 'hidden',
                    boxShadow: '0 6px 20px rgba(0,0,0,0.06)'
                  }}
                >
                  {/* Thumbnail (Contain, uncropped full size) */}
                  <div style={{ width: '100%', height: '190px', background: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                    {course.thumbnail ? (
                      <img
                        src={course.thumbnail}
                        alt={course.name}
                        style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                      />
                    ) : (
                      <i className="fa-solid fa-graduation-cap" style={{ fontSize: '3rem', color: '#64748b' }}></i>
                    )}
                  </div>

                  <div style={{ padding: '20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                      <span className={`status-badge ${course.status}`}>{course.status}</span>
                      <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                        Version {course.version || 1}
                      </span>
                    </div>

                    {/* Action buttons staying inside Admin */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>
                      <Link
                        to={`/admin/courses/${course.id}/edit`}
                        className="btn btn-primary"
                        style={{ width: '100%', justifyContent: 'center', display: 'inline-flex', alignItems: 'center', gap: '8px' }}
                      >
                        <i className="fa-solid fa-pen-to-square"></i>
                        <span>Edit Course Content</span>
                      </Link>

                      <button
                        onClick={() => setActiveTab('player')}
                        className="btn btn-outline"
                        style={{ width: '100%', justifyContent: 'center', display: 'inline-flex', alignItems: 'center', gap: '8px' }}
                      >
                        <i className="fa-solid fa-circle-play"></i>
                        <span>Test Curriculum Player</span>
                      </button>
                    </div>

                    {/* Course Form Attributes Summary */}
                    <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '16px' }}>
                      <div style={{ fontSize: '0.82rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '10px' }}>
                        Configured Parameters:
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.86rem', color: 'var(--text-secondary)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span>Curriculum Sections:</span>
                          <strong style={{ color: 'var(--text-primary)' }}>{sections.length}</strong>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span>Total Lessons:</span>
                          <strong style={{ color: 'var(--text-primary)' }}>{totalLectures}</strong>
                        </div>
                        {course.duration && (
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span>Duration:</span>
                            <strong style={{ color: 'var(--text-primary)' }}>{course.duration}</strong>
                          </div>
                        )}
                        {course.level && (
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span>Difficulty Level:</span>
                            <strong style={{ color: 'var(--text-primary)' }}>{course.level}</strong>
                          </div>
                        )}
                        {course.language && (
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span>Language:</span>
                            <strong style={{ color: 'var(--text-primary)' }}>{course.language}</strong>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ====================================================================
            VIEW 2: CURRICULUM LESSON PLAYER (INTERACTIVE MEDIA TESTING)
            ==================================================================== */}
        {activeTab === 'player' && (
          <div>
            <div
              style={{
                fontSize: '0.8rem',
                fontWeight: '700',
                letterSpacing: '0.08em',
                color: 'var(--text-muted)',
                textTransform: 'uppercase',
                marginBottom: '16px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <i className="fa-solid fa-circle-play" style={{ color: 'var(--accent-primary)' }}></i>
              Curriculum Lesson Player
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(280px, 340px) 1fr', gap: '24px', alignItems: 'start' }}>
              {/* Left Syllabus Sidebar */}
              <div className="card" style={{ padding: '18px' }}>
                <div style={{ marginBottom: '14px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '10px' }}>
                  <span className="course-category-tag">{course.categoryName || 'Curriculum'}</span>
                  <h2 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: '4px' }}>
                    {course.name}
                  </h2>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {sections.length === 0 ? (
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No sections added yet.</div>
                  ) : (
                    sections.map((sec) => (
                      <div key={sec.id} style={{ borderRadius: 'var(--radius-md)', border: '1px solid var(--border-default)', overflow: 'hidden' }}>
                        <div
                          onClick={() => handleSelectSectionPlayer(sec.id)}
                          style={{
                            padding: '10px 12px',
                            background: activeSectionId === sec.id ? 'var(--accent-subtle)' : 'var(--bg-card)',
                            cursor: 'pointer',
                            fontWeight: '700',
                            fontSize: '0.88rem',
                            color: 'var(--text-primary)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between'
                          }}
                        >
                          <span>
                            <i className="fa-solid fa-folder" style={{ marginRight: '6px', color: 'var(--accent-primary)' }}></i>
                            {sec.title}
                          </span>
                          <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                            {(sectionContents[sec.id] || []).length} items
                          </span>
                        </div>

                        {activeSectionId === sec.id && (
                          <div style={{ padding: '6px', background: 'var(--bg-surface)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            {(sectionContents[sec.id] || []).map((cnt) => (
                              <div
                                key={cnt.id}
                                onClick={() => setActiveContent(cnt)}
                                style={{
                                  padding: '8px 10px',
                                  borderRadius: 'var(--radius-sm)',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '8px',
                                  fontSize: '0.84rem',
                                  fontWeight: activeContent?.id === cnt.id ? '700' : '500',
                                  background: activeContent?.id === cnt.id ? 'var(--accent-primary)' : 'transparent',
                                  color: activeContent?.id === cnt.id ? '#ffffff' : 'var(--text-secondary)'
                                }}
                              >
                                <span>
                                  {cnt.contentType === 'VIDEO' ? (
                                    <i className="fa-solid fa-film"></i>
                                  ) : cnt.contentType === 'PDF' ? (
                                    <i className="fa-solid fa-file-pdf"></i>
                                  ) : (
                                    <i className="fa-solid fa-paperclip"></i>
                                  )}
                                </span>
                                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {cnt.title}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Right Content Viewer */}
              <div>
                {activeContent ? (
                  <div className="card" style={{ padding: '24px' }}>
                    <div style={{ marginBottom: '18px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '14px' }}>
                      <span className="role-tag">{activeContent.contentType}</span>
                      <h2 style={{ fontSize: '1.35rem', fontWeight: '800', color: 'var(--text-primary)', marginTop: '8px' }}>
                        {activeContent.title}
                      </h2>
                      {activeContent.description && (
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '6px' }}>
                          {activeContent.description}
                        </p>
                      )}
                    </div>

                    <div
                      style={{
                        background: '#000000',
                        borderRadius: 'var(--radius-md)',
                        overflow: 'hidden',
                        minHeight: '360px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                    >
                      {activeContent.contentType === 'VIDEO' ? (
                        activeContent.mediaReference ? (
                          <video src={activeContent.mediaReference} controls style={{ width: '100%', maxHeight: '480px' }} />
                        ) : (
                          <div style={{ color: '#ffffff', padding: '40px' }}>No video reference configured.</div>
                        )
                      ) : activeContent.contentType === 'PDF' ? (
                        activeContent.mediaReference ? (
                          <iframe src={activeContent.mediaReference} title={activeContent.title} style={{ width: '100%', height: '520px', border: 'none' }} />
                        ) : (
                          <div style={{ color: '#ffffff', padding: '40px' }}>No PDF document reference configured.</div>
                        )
                      ) : (
                        <div style={{ color: '#ffffff', padding: '40px', textAlign: 'center' }}>
                          <p>Asset Reference: {activeContent.contentType}</p>
                          {activeContent.mediaReference && (
                            <a href={activeContent.mediaReference} target="_blank" rel="noopener noreferrer" className="btn btn-primary" style={{ marginTop: '12px' }}>
                              Open Resource ↗
                            </a>
                          )}
                        </div>
                      )}
                    </div>

                    {activeContent.resources && activeContent.resources.length > 0 && (
                      <div style={{ marginTop: '24px', borderTop: '1px solid var(--border-subtle)', paddingTop: '16px' }}>
                        <h3 style={{ fontSize: '1rem', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '10px' }}>
                          Attached Lecture Resources
                        </h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {activeContent.resources.map((r) => (
                            <a
                              key={r.id}
                              href={r.url}
                              target="_blank"
                              rel="noreferrer"
                              className="card"
                              style={{ padding: '10px 14px', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.88rem' }}
                            >
                              <span><i className="fa-solid fa-paperclip"></i></span>
                              <span style={{ fontWeight: '600' }}>{r.name}</span>
                              <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>({r.type})</span>
                            </a>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="card" style={{ textAlign: 'center', padding: '80px 20px', color: 'var(--text-muted)' }}>
                    <i className="fa-solid fa-play" style={{ fontSize: '2rem', marginBottom: '12px', opacity: 0.4 }}></i>
                    <h3>Select a lesson from the curriculum sidebar to preview.</h3>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
