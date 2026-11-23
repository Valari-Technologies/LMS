import { checkInAttendance } from '../api/live';

const ATTENDANCE_STORAGE_KEY = 'onetutor_live_attendance_records';

/**
 * Retrieves all stored attendance records from localStorage.
 * @returns {Array<Object>} List of attendance records
 */
export function getStoredAttendanceRecords() {
  try {
    const raw = localStorage.getItem(ATTENDANCE_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.warn('[attendanceStorage] Error reading stored attendance:', err);
    return [];
  }
}

/**
 * Returns a map of attendance records keyed by `sessionId_studentId` and `sessionId_studentEmail`.
 */
export function getStoredAttendanceMap() {
  const records = getStoredAttendanceRecords();
  const map = {};
  for (const r of records) {
    if (r.sessionId != null) {
      if (r.studentId != null) {
        map[`${r.sessionId}_${r.studentId}`] = r;
      }
      if (r.studentEmail) {
        map[`${r.sessionId}_${String(r.studentEmail).toLowerCase().trim()}`] = r;
      }
    }
  }
  return map;
}

/**
 * Saves attendance records list back to localStorage.
 */
function saveStoredAttendanceRecords(records) {
  try {
    localStorage.setItem(ATTENDANCE_STORAGE_KEY, JSON.stringify(records));
  } catch (err) {
    console.warn('[attendanceStorage] Error saving attendance records:', err);
  }
}

/**
 * Emits an event to notify all components that attendance data has changed.
 */
function emitAttendanceUpdated(detail = null) {
  try {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('onetutor_attendance_updated', { detail }));
    }
  } catch (e) {
    // ignore in non-browser environments
  }
}

/**
 * Automatically records that a student joined / entered a live classroom.
 * Persists to localStorage immediately and triggers backend check-in API.
 * 
 * @param {number|string|Object} sessionOrId The session ID or session object
 * @param {Object} [user] The student user object (optional, falls back to auth user in localStorage)
 * @param {Object} [extra] Additional metadata like courseId, batchId, sessionTitle
 */
export async function recordStudentAttendance(sessionOrId, user = null, extra = {}) {
  try {
    const sessionId = typeof sessionOrId === 'object' && sessionOrId !== null
      ? (sessionOrId.id || sessionOrId.sessionId)
      : sessionOrId;

    if (!sessionId) return null;

    let currentUser = user;
    if (!currentUser && typeof localStorage !== 'undefined') {
      try {
        const storedAuth = localStorage.getItem('onetutor_auth_user');
        if (storedAuth) currentUser = JSON.parse(storedAuth);
      } catch (e) {}
    }

    const studentId = currentUser?.id || currentUser?.studentId || currentUser?.userId || null;
    const studentEmail = currentUser?.email || currentUser?.studentEmail || '';
    const studentName = currentUser?.name || currentUser?.fullName || currentUser?.studentName || studentEmail || 'Student';

    const sessionTitle = extra.sessionTitle ||
      (typeof sessionOrId === 'object' && sessionOrId !== null ? sessionOrId.title || sessionOrId.sessionTitle : null) ||
      `Live Class Session #${sessionId}`;
    const courseId = extra.courseId || (typeof sessionOrId === 'object' && sessionOrId !== null ? sessionOrId.courseId || sessionOrId.course?.id : null) || null;
    const batchId = extra.batchId || (typeof sessionOrId === 'object' && sessionOrId !== null ? sessionOrId.batchId || sessionOrId.batch?.id : null) || null;

    const existingRecords = getStoredAttendanceRecords();
    const nowIso = new Date().toISOString();

    const recordKey = `${sessionId}_${studentId || studentEmail}`;
    const existingIndex = existingRecords.findIndex(r => {
      const matchSession = String(r.sessionId) === String(sessionId);
      const matchId = studentId && r.studentId && String(r.studentId) === String(studentId);
      const matchEmail = studentEmail && r.studentEmail && String(r.studentEmail).toLowerCase().trim() === String(studentEmail).toLowerCase().trim();
      return matchSession && (matchId || matchEmail);
    });

    const newRecord = {
      id: `att_${sessionId}_${studentId || studentEmail || Date.now()}`,
      sessionId: Number(sessionId),
      sessionTitle,
      studentId: studentId ? Number(studentId) : null,
      studentName,
      studentEmail,
      courseId: courseId ? Number(courseId) : null,
      batchId: batchId ? Number(batchId) : null,
      status: 'PRESENT',
      attendedAt: existingIndex >= 0 && existingRecords[existingIndex].attendedAt ? existingRecords[existingIndex].attendedAt : nowIso,
      joinTime: nowIso,
      updatedAt: nowIso
    };

    if (existingIndex >= 0) {
      existingRecords[existingIndex] = {
        ...existingRecords[existingIndex],
        ...newRecord,
        status: 'PRESENT',
        joinTime: nowIso,
        updatedAt: nowIso
      };
    } else {
      existingRecords.push(newRecord);
    }

    saveStoredAttendanceRecords(existingRecords);
    emitAttendanceUpdated(newRecord);

    // Call backend API asynchronously
    try {
      checkInAttendance(sessionId).catch(err => {
        // Backend might be offline or still spinning up; local copy is safe
        console.debug('[attendanceStorage] Backend checkInAttendance completed with status:', err?.response?.status || err?.message);
      });
    } catch (e) {
      // safe fallback
    }

    return newRecord;
  } catch (err) {
    console.error('[attendanceStorage] Failed to record attendance:', err);
    return null;
  }
}

/**
 * Manually marks or overrides attendance status for a student (Admin capability).
 */
export function markStudentAttendanceOverride(sessionId, student, status = 'PRESENT', sessionInfo = {}) {
  try {
    const existingRecords = getStoredAttendanceRecords();
    const studentId = student?.studentId || student?.id || null;
    const studentEmail = student?.studentEmail || student?.email || '';
    const studentName = student?.studentName || student?.name || studentEmail || 'Student';
    const nowIso = new Date().toISOString();

    const existingIndex = existingRecords.findIndex(r => {
      const matchSession = String(r.sessionId) === String(sessionId);
      const matchId = studentId && r.studentId && String(r.studentId) === String(studentId);
      const matchEmail = studentEmail && r.studentEmail && String(r.studentEmail).toLowerCase().trim() === String(studentEmail).toLowerCase().trim();
      return matchSession && (matchId || matchEmail);
    });

    const record = {
      id: `att_${sessionId}_${studentId || studentEmail || Date.now()}`,
      sessionId: Number(sessionId),
      sessionTitle: sessionInfo.title || sessionInfo.sessionTitle || `Live Class #${sessionId}`,
      studentId: studentId ? Number(studentId) : null,
      studentName,
      studentEmail,
      courseId: sessionInfo.courseId || null,
      batchId: sessionInfo.batchId || null,
      status: status.toUpperCase(),
      attendedAt: status.toUpperCase() === 'PRESENT' ? nowIso : null,
      joinTime: status.toUpperCase() === 'PRESENT' ? nowIso : null,
      updatedAt: nowIso,
      adminOverride: true
    };

    if (existingIndex >= 0) {
      existingRecords[existingIndex] = {
        ...existingRecords[existingIndex],
        ...record
      };
    } else {
      existingRecords.push(record);
    }

    saveStoredAttendanceRecords(existingRecords);
    emitAttendanceUpdated(record);
    return record;
  } catch (err) {
    console.error('[attendanceStorage] Failed to override student attendance:', err);
    return null;
  }
}

/**
 * Computes individual attendance statistics for a given student across a batch or course.
 */
export function computeStudentAttendance(student, liveSessions = [], attendanceRecords = null) {
  if (!student) {
    return {
      attendedCount: 0,
      totalHeld: 0,
      absentCount: 0,
      percentage: null,
      sessions: []
    };
  }

  const records = attendanceRecords || getStoredAttendanceRecords();
  const studentId = student.studentId != null ? String(student.studentId) : (student.id != null ? String(student.id) : null);
  const studentEmail = student.studentEmail ? String(student.studentEmail).toLowerCase().trim() : (student.email ? String(student.email).toLowerCase().trim() : '');

  const now = new Date();

  // Match live sessions for this student/batch
  const sessionAttendanceList = (liveSessions || []).map(s => {
    const sId = s.id || s.sessionId;
    const isCompleted = s.status === 'completed';
    const isScheduledPast = s.scheduledAt && new Date(s.scheduledAt) <= now;
    const isHeld = isCompleted || isScheduledPast;

    // Find if student has a PRESENT record
    const match = records.find(r => {
      const matchSession = String(r.sessionId) === String(sId);
      const matchId = studentId && r.studentId && String(r.studentId) === studentId;
      const matchEmail = studentEmail && r.studentEmail && String(r.studentEmail).toLowerCase().trim() === studentEmail;
      return matchSession && (matchId || matchEmail);
    });

    const isPresent = match && String(match.status).toUpperCase() === 'PRESENT';
    const isExplicitAbsent = match && String(match.status).toUpperCase() === 'ABSENT';

    let finalStatus = 'UPCOMING';
    if (isPresent) {
      finalStatus = 'PRESENT';
    } else if (isExplicitAbsent || isHeld) {
      finalStatus = 'ABSENT';
    } else {
      finalStatus = 'UPCOMING';
    }

    return {
      sessionId: sId,
      sessionTitle: s.title || s.sessionTitle || `Live Class #${sId}`,
      scheduledAt: s.scheduledAt,
      endTime: s.endTime,
      sessionStatus: s.status,
      attendanceStatus: finalStatus,
      attendedAt: isPresent ? (match.attendedAt || match.joinTime || s.scheduledAt) : null,
      isHeld
    };
  });

  const heldSessions = sessionAttendanceList.filter(s => s.isHeld || s.attendanceStatus === 'PRESENT');
  const attendedCount = heldSessions.filter(s => s.attendanceStatus === 'PRESENT').length;
  const totalHeld = heldSessions.length;
  const absentCount = Math.max(0, totalHeld - attendedCount);
  const percentage = totalHeld > 0 ? Math.round((attendedCount / totalHeld) * 100) : null;

  return {
    studentId,
    studentName: student.studentName || student.name || 'Student',
    studentEmail,
    attendedCount,
    totalHeld,
    absentCount,
    percentage,
    sessions: sessionAttendanceList
  };
}

/**
 * Computes the full session attendance sheet (who is PRESENT vs ABSENT) for a live session.
 */
export function getSessionAttendanceSheet(session, batchStudents = [], attendanceRecords = null) {
  if (!session) return { session: null, students: [], summary: { total: 0, present: 0, absent: 0, rate: 100 } };

  const sId = session.id || session.sessionId;
  const records = attendanceRecords || getStoredAttendanceRecords();
  const now = new Date();
  const isHeld = session.status === 'completed' || (session.scheduledAt && new Date(session.scheduledAt) <= now);

  const studentRows = (batchStudents || []).map(st => {
    const stId = st.studentId != null ? String(st.studentId) : (st.id != null ? String(st.id) : null);
    const stEmail = st.studentEmail ? String(st.studentEmail).toLowerCase().trim() : (st.email ? String(st.email).toLowerCase().trim() : '');

    const match = records.find(r => {
      const matchSession = String(r.sessionId) === String(sId);
      const matchId = stId && r.studentId && String(r.studentId) === stId;
      const matchEmail = stEmail && r.studentEmail && String(r.studentEmail).toLowerCase().trim() === stEmail;
      return matchSession && (matchId || matchEmail);
    });

    const isPresent = match && String(match.status).toUpperCase() === 'PRESENT';
    const isExplicitAbsent = match && String(match.status).toUpperCase() === 'ABSENT';

    let status = 'UPCOMING';
    if (isPresent) {
      status = 'PRESENT';
    } else if (isExplicitAbsent || isHeld) {
      status = 'ABSENT';
    }

    return {
      studentId: st.studentId || st.id,
      studentName: st.studentName || st.name || 'Student',
      studentEmail: st.studentEmail || st.email || '',
      profileImage: st.profileImage || null,
      status,
      attendedAt: isPresent ? (match.attendedAt || match.joinTime) : null,
      adminOverride: match?.adminOverride || false
    };
  });

  const presentCount = studentRows.filter(s => s.status === 'PRESENT').length;
  const absentCount = studentRows.filter(s => s.status === 'ABSENT').length;
  const totalStudents = studentRows.length;
  const rate = totalStudents > 0 ? Math.round((presentCount / totalStudents) * 100) : 100;

  return {
    session,
    isHeld,
    students: studentRows,
    summary: {
      total: totalStudents,
      present: presentCount,
      absent: absentCount,
      rate
    }
  };
}
