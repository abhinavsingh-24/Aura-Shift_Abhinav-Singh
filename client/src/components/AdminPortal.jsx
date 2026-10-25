import { useState, useEffect } from 'react';
import {
  getAdminOverview,
  getAdminEvents,
  moderateAdminEvent,
  getAdminReports,
  updateAdminReport,
  importAdminEvents,
  getAdminAuditLogs,
} from '../services/api';

export default function AdminPortal({ currentUser }) {
  const [activeTab, setActiveTab] = useState('overview'); // 'overview', 'events', 'reports', 'import', 'audit'
  const [overview, setOverview] = useState(null);
  const [events, setEvents] = useState([]);
  const [reports, setReports] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [error, setError] = useState('');
  const [statusMsg, setStatusMsg] = useState('');

  // Bulk Import state
  const [importJson, setImportJson] = useState('');
  const [importResult, setImportResult] = useState(null);

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const [overviewData, eventsData, reportsData, auditData] = await Promise.all([
        getAdminOverview(),
        getAdminEvents(),
        getAdminReports(),
        getAdminAuditLogs(),
      ]);
      setOverview(overviewData);
      setEvents(Array.isArray(eventsData.events) ? eventsData.events : []);
      setReports(Array.isArray(reportsData.reports) ? reportsData.reports : []);
      setAuditLogs(Array.isArray(auditData.logs) ? auditData.logs : []);
    } catch (err) {
      setError(err.message || 'Unable to load admin portal.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (currentUser && currentUser.role === 'admin') {
      loadData();
    } else {
      setLoading(false);
    }
  }, [currentUser]);

  const handleModerate = async (eventId, action) => {
    setStatusMsg('');
    setError('');
    try {
      await moderateAdminEvent(eventId, action);
      setStatusMsg(`Event successfully updated (${action}).`);
      await loadData();
    } catch (err) {
      setError(err.message || 'Moderation failed.');
    }
  };

  const handleReportStatus = async (reportId, status) => {
    setStatusMsg('');
    try {
      await updateAdminReport(reportId, status);
      setStatusMsg(`Report status updated to ${status}.`);
      await loadData();
    } catch (err) {
      setError(err.message || 'Failed to update report.');
    }
  };

  const handleImportSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setStatusMsg('');
    setImportResult(null);

    let parsed = [];
    try {
      parsed = JSON.parse(importJson);
      if (!Array.isArray(parsed)) parsed = [parsed];
    } catch {
      setError('Invalid JSON format. Please paste an array of event objects.');
      return;
    }

    try {
      const res = await importAdminEvents(parsed);
      setImportResult(res.results);
      setStatusMsg('Events imported successfully!');
      setImportJson('');
      await loadData();
    } catch (err) {
      setError(err.message || 'Import failed.');
    }
  };

  if (!currentUser || currentUser.role !== 'admin') {
    return (
      <div className="auth-gate">
        <div className="auth-gate-card">
          <h2>Administrator Access Required</h2>
          <p>This portal is restricted to authorized platform administrators.</p>
          <div className="auth-gate-actions">
            <a className="primary-btn" href="/login?next=/admin">Admin Sign In</a>
            <a className="secondary-btn" href="/">Back to Home</a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-portal-container">
      <div className="portal-header">
        <div>
          <span className="badge category-badge">PLATFORM GOVERNANCE</span>
          <h1>SIDEQUEST Admin & Moderation</h1>
          <p>Review event listings, enforce community trust & safety, inspect bookings, and audit platform activities.</p>
        </div>
      </div>

      {statusMsg && <div className="message success-message" role="status">{statusMsg}</div>}
      {error && <div className="message error-message" role="alert">{error}</div>}

      <div className="portal-nav-tabs">
        <button
          type="button"
          className={`tab-btn ${activeTab === 'overview' ? 'is-active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          📊 System Health
        </button>
        <button
          type="button"
          className={`tab-btn ${activeTab === 'events' ? 'is-active' : ''}`}
          onClick={() => setActiveTab('events')}
        >
          🔍 Event Listings ({events.length})
        </button>
        <button
          type="button"
          className={`tab-btn ${activeTab === 'reports' ? 'is-active' : ''}`}
          onClick={() => setActiveTab('reports')}
        >
          🛡️ Content Reports ({reports.length})
        </button>
        <button
          type="button"
          className={`tab-btn ${activeTab === 'import' ? 'is-active' : ''}`}
          onClick={() => setActiveTab('import')}
        >
          📥 Bulk Import Events
        </button>
        <button
          type="button"
          className={`tab-btn ${activeTab === 'audit' ? 'is-active' : ''}`}
          onClick={() => setActiveTab('audit')}
        >
          📜 Audit Trail ({auditLogs.length})
        </button>
      </div>

      {activeTab === 'overview' && (
        <div className="portal-tab-content">
          <div className="metrics-summary-grid">
            <div className="metric-card">
              <span className="metric-label">TOTAL REGISTERED USERS</span>
              <strong className="metric-value">{overview?.totalUsers || 0}</strong>
              <span className="metric-sub">Explorers, Organizers, Admins</span>
            </div>

            <div className="metric-card">
              <span className="metric-label">TOTAL LISTED EVENTS</span>
              <strong className="metric-value">{overview?.totalEvents || 0}</strong>
              <span className="metric-sub">India-wide catalogue</span>
            </div>

            <div className="metric-card">
              <span className="metric-label">CONFIRMED BOOKINGS</span>
              <strong className="metric-value">{overview?.totalBookings || 0}</strong>
              <span className="metric-sub">Issued tickets</span>
            </div>

            <div className="metric-card">
              <span className="metric-label">ACTIVE SAFETY REPORTS</span>
              <strong className="metric-value">{overview?.totalReports || 0}</strong>
              <span className="metric-sub">Needs moderator review</span>
            </div>
          </div>

          <div className="system-health-banner" style={{ marginTop: '1.5rem' }}>
            <p><strong>Database:</strong> {overview?.database || 'Connected'}</p>
            <p><strong>System Status:</strong> <span className="badge tag-green">OPERATIONAL</span></p>
          </div>
        </div>
      )}

      {activeTab === 'events' && (
        <div className="portal-tab-content">
          <h3>Manage Event Listings</h3>
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Event Title</th>
                  <th>City</th>
                  <th>Organizer</th>
                  <th>Date</th>
                  <th>Status</th>
                  <th>Moderation Actions</th>
                </tr>
              </thead>
              <tbody>
                {events.map((evt) => (
                  <tr key={evt.id}>
                    <td><strong>{evt.title}</strong></td>
                    <td>{evt.city}</td>
                    <td>{evt.organizerName}</td>
                    <td>{evt.date}</td>
                    <td><span className={`status-tag status-${evt.status}`}>{evt.status}</span></td>
                    <td>
                      <div className="table-btn-group">
                        {evt.status !== 'published' && (
                          <button
                            type="button"
                            className="btn-xs secondary-btn"
                            onClick={() => handleModerate(evt.id, 'approve')}
                          >
                            Approve
                          </button>
                        )}
                        {evt.status !== 'draft' && (
                          <button
                            type="button"
                            className="btn-xs ghost-btn"
                            onClick={() => handleModerate(evt.id, 'unpublish')}
                          >
                            Unpublish
                          </button>
                        )}
                        {evt.status !== 'cancelled' && (
                          <button
                            type="button"
                            className="btn-xs danger-btn"
                            onClick={() => handleModerate(evt.id, 'reject')}
                          >
                            Reject
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'reports' && (
        <div className="portal-tab-content">
          <h3>Trust & Safety Reports</h3>
          {reports.length === 0 ? (
            <p>No safety reports currently pending.</p>
          ) : (
            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Reporter</th>
                    <th>Target</th>
                    <th>Reason</th>
                    <th>Details</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {reports.map((r) => (
                    <tr key={r.id}>
                      <td>{r.reporterName}</td>
                      <td><strong>{r.targetLabel}</strong> ({r.targetType})</td>
                      <td><span className="badge tag-muted">{r.reason}</span></td>
                      <td>{r.details || '—'}</td>
                      <td><span className={`status-tag status-${r.status}`}>{r.status}</span></td>
                      <td>
                        <div className="table-btn-group">
                          <button
                            type="button"
                            className="btn-xs secondary-btn"
                            onClick={() => handleReportStatus(r.id, 'resolved')}
                          >
                            Resolve
                          </button>
                          <button
                            type="button"
                            className="btn-xs ghost-btn"
                            onClick={() => handleReportStatus(r.id, 'dismissed')}
                          >
                            Dismiss
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === 'import' && (
        <div className="portal-tab-content">
          <h3>Admin Bulk Event Importer</h3>
          <p>Import verified event listings with automatic duplicate detection and schema validation.</p>

          <form onSubmit={handleImportSubmit}>
            <textarea
              rows="8"
              placeholder='[ { "title": "Example Tech Fest", "description": "...", "category": "Technology", "date": "2026-11-20", "startTime": "10:00", "city": "Bengaluru", "venue": "..." } ]'
              value={importJson}
              onChange={(e) => setImportJson(e.target.value)}
              required
            />

            <div style={{ marginTop: '1rem' }}>
              <button type="submit" className="primary-btn">Validate & Import Events</button>
            </div>
          </form>

          {importResult && (
            <div className="import-result-summary" style={{ marginTop: '1.5rem' }}>
              <h4>Import Results</h4>
              <p>✅ Imported: {importResult.imported}</p>
              <p>⚠️ Duplicates Skipped: {importResult.duplicates}</p>
              {importResult.errors && importResult.errors.length > 0 && (
                <div>
                  <p>❌ Errors ({importResult.errors.length}):</p>
                  <ul>
                    {importResult.errors.map((err, i) => (
                      <li key={i}>{err.title}: {err.errors.join(', ')}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {activeTab === 'audit' && (
        <div className="portal-tab-content">
          <h3>System Audit Trail</h3>
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Action</th>
                  <th>Actor</th>
                  <th>Target Type</th>
                  <th>Target ID</th>
                </tr>
              </thead>
              <tbody>
                {auditLogs.length === 0 ? (
                  <tr><td colSpan="5" style={{ textAlign: 'center' }}>No audit events logged yet.</td></tr>
                ) : (
                  auditLogs.map((log) => (
                    <tr key={log.id}>
                      <td>{new Date(log.createdAt).toLocaleString('en-IN')}</td>
                      <td><code>{log.action}</code></td>
                      <td>{log.actorEmail || log.actorId}</td>
                      <td>{log.targetType}</td>
                      <td><code>{log.targetId}</code></td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
