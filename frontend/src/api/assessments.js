import { api } from './client';

// Admin API
export async function getAdminAssessment(contentId) {
  const res = await api.get(`/contents/${contentId}/assessment`);
  return res.data.data;
}

export async function saveAssessment(contentId, payload) {
  const res = await api.post(`/contents/${contentId}/assessment`, payload);
  return res.data.data;
}

export async function deleteAssessment(contentId) {
  const res = await api.delete(`/contents/${contentId}/assessment`);
  return res.data;
}

// Student API
export async function getAssessmentInfo(contentId) {
  try {
    const res = await api.get(`/contents/${contentId}/assessment-info`);
    return res.data.data;
  } catch (err) {
    if (err.response?.status === 404) return null;
    throw err;
  }
}

export async function startAssessmentAttempt(assessmentId) {
  const res = await api.post(`/assessments/${assessmentId}/attempts`);
  return res.data.data;
}

export async function getAssessmentAttempt(attemptId) {
  const res = await api.get(`/assessment-attempts/${attemptId}`);
  return res.data.data;
}

export async function saveAttemptAnswer(attemptId, questionId, selectedOption) {
  const res = await api.post(`/assessment-attempts/${attemptId}/answer`, { questionId, selectedOption });
  return res.data.data;
}

export async function submitAssessmentAttempt(attemptId) {
  const res = await api.post(`/assessment-attempts/${attemptId}/submit`);
  return res.data.data;
}

export async function terminateAssessmentAttempt(attemptId, reason = 'TAB_SWITCH') {
  const res = await api.post(`/assessment-attempts/${attemptId}/terminate`, { reason });
  return res.data.data;
}
