import { api } from './client';

export async function getAuditLogs({ entityType = '', page = 0, size = 20 } = {}) {
  const params = { page, size };
  if (entityType && entityType !== 'ALL') params.entityType = entityType;
  const res = await api.get('/admin/audit-logs', { params });
  return res.data.data;
}
