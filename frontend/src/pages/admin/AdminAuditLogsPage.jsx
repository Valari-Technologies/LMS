import { useState, useEffect } from 'react';
import { getAuditLogs } from '../../api/audit';

export default function AdminAuditLogsPage() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [entityType, setEntityType] = useState('ALL');
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    loadLogs();
  }, [entityType, page]);

  async function loadLogs() {
    setLoading(true);
    try {
      const res = await getAuditLogs({ entityType, page, size: 15 });
      setLogs(res?.content || []);
      setTotalPages(res?.totalPages || 1);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  const entityTypes = [
    'ALL',
    'Course',
    'User',
    'Category',
    'Section',
    'Content',
    'MediaAsset',
    'LiveSession',
    'enrollment',
  ];

  return (
    <div className="page">
      <div className="page-header">
        <div className="page-title-wrap">
          <h1 className="page-title">System Audit Logs</h1>
          <p className="page-subtitle">
            Immutable, chronological audit trail of all administrative actions and mutations.
          </p>
        </div>
      </div>

      <div className="table-card">
        <div className="table-toolbar">
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {entityTypes.map((et) => (
              <button
                key={et}
                onClick={() => { setEntityType(et); setPage(0); }}
                className={`btn btn-sm ${entityType === et ? 'btn-primary' : 'btn-secondary'}`}
              >
                {et === 'ALL' ? 'All Events' : et}
              </button>
            ))}
          </div>
        </div>

        <div className="table-responsive">
          <table className="modern-table">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Action</th>
                <th>Entity Target</th>
                <th>Operator</th>
                <th>Details & Notes</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="5" className="table-empty">Loading audit events…</td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan="5" className="table-empty">No audit events found.</td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id}>
                    <td>
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-primary)', fontWeight: '600' }}>
                        {new Date(log.createdAt).toLocaleDateString()}
                      </div>
                      <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                        {new Date(log.createdAt).toLocaleTimeString()}
                      </div>
                    </td>
                    <td>
                      <span style={{
                        fontSize: '0.74rem',
                        fontWeight: '800',
                        textTransform: 'uppercase',
                        padding: '3px 9px',
                        borderRadius: 'var(--radius-full)',
                        background: 'var(--accent-subtle)',
                        color: 'var(--accent-primary)',
                        border: '1px solid var(--accent-ring)'
                      }}>
                        {log.action}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontWeight: '600', color: 'var(--text-primary)', fontSize: '0.88rem' }}>
                        {log.entityType} #{log.entityId}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
                        {log.userName || 'System'}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontSize: '0.84rem', color: 'var(--text-secondary)' }}>
                        {log.details || '—'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '14px 20px',
            borderTop: '1px solid var(--border-subtle)',
            background: 'var(--bg-card)'
          }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Page {page + 1} of {totalPages}
            </span>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                className="btn btn-secondary btn-sm"
                disabled={page <= 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
              >
                Previous
              </button>
              <button
                className="btn btn-secondary btn-sm"
                disabled={page >= totalPages - 1}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
