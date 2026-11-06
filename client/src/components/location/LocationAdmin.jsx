import { useCallback, useEffect, useState } from 'react';
import { locationApi } from '../../services/locationApi';
import './location.css';

const TYPES = ['', 'state', 'district', 'city', 'locality', 'postal_code'];

function ReportList({ title, data }) {
  const entries = Object.entries(data || {});
  if (!entries.length) return null;
  return (
    <div style={{ marginBottom: 12 }}>
      <strong>{title}</strong>
      <ul style={{ margin: '6px 0 0 18px' }}>
        {entries.map(([key, val]) => (
          <li key={key}>{key}: {Array.isArray(val) ? `${val.length} item(s)${val.length ? ` — e.g. ${JSON.stringify(val[0]).slice(0, 120)}` : ''}` : JSON.stringify(val)}</li>
        ))}
      </ul>
    </div>
  );
}

export default function LocationAdmin() {
  const [view, setView] = useState('records');
  const [summary, setSummary] = useState(null);
  const [records, setRecords] = useState({ data: [], pagination: null });
  const [filters, setFilters] = useState({ q: '', type: 'state', active: '', page: 1 });
  const [imports, setImports] = useState([]);
  const [importDetail, setImportDetail] = useState(null);
  const [duplicates, setDuplicates] = useState([]);
  const [audit, setAudit] = useState([]);
  const [csv, setCsv] = useState('');
  const [result, setResult] = useState(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const run = useCallback(async (fn) => {
    setBusy(true);
    setMessage('');
    try { return await fn(); } catch (err) { setMessage(err.message); return null; } finally { setBusy(false); }
  }, []);

  const loadSummary = useCallback(() => run(async () => setSummary(await locationApi.admin.summary())), [run]);
  const loadRecords = useCallback(() => run(async () => setRecords(await locationApi.admin.records({ ...filters, limit: 25 }))), [run, filters]);

  useEffect(() => { loadSummary(); }, [loadSummary]);
  useEffect(() => { if (view === 'records') loadRecords(); }, [view, loadRecords]);
  useEffect(() => {
    if (view === 'history') run(async () => setImports((await locationApi.admin.imports()).data));
    if (view === 'duplicates') run(async () => setDuplicates((await locationApi.admin.duplicates()).data));
    if (view === 'audit') run(async () => setAudit((await locationApi.admin.audit()).data));
  }, [view, run]);

  const toggle = (rec) => run(async () => {
    const res = await locationApi.admin.update(rec.id, { active: !rec.active });
    setMessage(`${rec.name} ${rec.active ? 'deactivated' : 'activated'}${res.cascaded ? ` (+${res.cascaded} child records)` : ''}.`);
    await loadRecords();
  });

  const rename = (rec) => {
    const name = window.prompt('Official name', rec.name);
    if (!name || name === rec.name) return;
    run(async () => { await locationApi.admin.update(rec.id, { name }); await loadRecords(); });
  };

  const doImport = (dryRun, body = {}) => run(async () => {
    const res = await locationApi.admin.runImport({ ...body, dryRun });
    setResult(res);
    setMessage(dryRun ? 'Dry run complete — nothing was written.' : 'Import complete.');
    loadSummary();
  });

  const openImport = (id) => run(async () => setImportDetail(await locationApi.admin.importDetail(id)));

  return (
    <div className="portal-tab-content loc-selector">
      <h3>Location Master Data</h3>
      {summary && (
        <p style={{ color: '#8b93b8' }}>
          Storage: <b>{summary.storage}</b> · {Object.entries(summary.counts || {}).map(([k, v]) => `${k}: ${v}`).join(' · ') || 'empty'}
          {summary.lastImport ? ` · last import ${new Date(summary.lastImport.startedAt || summary.lastImport.createdAt).toLocaleString('en-IN')}` : ' · no import yet'}
        </p>
      )}
      <div className="loc-toolbar">
        {['records', 'import', 'history', 'duplicates', 'audit'].map((v) => (
          <button key={v} type="button" className={`loc-btn ${view === v ? 'loc-btn-accent' : ''}`} onClick={() => setView(v)}>{v[0].toUpperCase() + v.slice(1)}</button>
        ))}
      </div>
      {message && <p className="loc-notice" role="status">{message}</p>}
      {busy && <p><span className="loc-spinner" /> Working…</p>}

      {view === 'records' && (
        <>
          <div className="loc-toolbar">
            <input className="loc-search" style={{ maxWidth: 260 }} placeholder="Search name or PIN" value={filters.q} onChange={(e) => setFilters({ ...filters, q: e.target.value, page: 1 })} />
            <select className="loc-search" style={{ maxWidth: 160 }} value={filters.type} onChange={(e) => setFilters({ ...filters, type: e.target.value, page: 1 })}>
              {TYPES.map((t) => <option key={t} value={t}>{t || 'all types'}</option>)}
            </select>
            <select className="loc-search" style={{ maxWidth: 140 }} value={filters.active} onChange={(e) => setFilters({ ...filters, active: e.target.value, page: 1 })}>
              <option value="">any status</option><option value="true">active</option><option value="false">inactive</option>
            </select>
          </div>
          <div className="table-wrapper">
            <table className="data-table">
              <thead><tr><th>Name</th><th>Type</th><th>ID</th><th>PIN</th><th>Status</th><th>Actions</th></tr></thead>
              <tbody>
                {records.data.length === 0 ? <tr><td colSpan="6" style={{ textAlign: 'center' }}>No records. Import the dataset from the Import tab.</td></tr> : records.data.map((rec) => (
                  <tr key={rec.id}>
                    <td>{rec.name}{rec.editedByAdmin ? ' ✎' : ''}</td><td>{rec.type}</td><td><code>{rec.id}</code></td><td>{rec.pincode || '—'}</td>
                    <td>{rec.active ? 'Active' : 'Inactive'}</td>
                    <td>
                      <button type="button" className="loc-btn" onClick={() => toggle(rec)}>{rec.active ? 'Deactivate' : 'Activate'}</button>{' '}
                      <button type="button" className="loc-btn" onClick={() => rename(rec)}>Rename</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {records.pagination && (
            <div className="loc-toolbar" style={{ marginTop: 10 }}>
              <button type="button" className="loc-btn" disabled={filters.page <= 1} onClick={() => setFilters({ ...filters, page: filters.page - 1 })}>← Prev</button>
              <span style={{ alignSelf: 'center' }}>Page {records.pagination.page} / {records.pagination.totalPages || 1} · {records.pagination.total} records</span>
              <button type="button" className="loc-btn" disabled={filters.page >= records.pagination.totalPages} onClick={() => setFilters({ ...filters, page: filters.page + 1 })}>Next →</button>
            </div>
          )}
        </>
      )}

      {view === 'import' && (
        <>
          <p>Imports are idempotent: unchanged records are skipped and admin-edited records are preserved.</p>
          <div className="loc-toolbar">
            <button type="button" className="loc-btn" disabled={busy} onClick={() => doImport(true)}>Dry run bundled dataset</button>
            <button type="button" className="loc-btn loc-btn-accent" disabled={busy} onClick={() => doImport(false)}>Import bundled India dataset</button>
          </div>
          <label className="loc-label" htmlFor="loc-csv">Or paste an India Post style CSV (header row required)</label>
          <textarea id="loc-csv" className="loc-search" rows={5} value={csv} onChange={(e) => setCsv(e.target.value)} placeholder="officename,pincode,officetype,delivery,district,statename,latitude,longitude" />
          <div className="loc-toolbar">
            <button type="button" className="loc-btn" disabled={busy || !csv.trim()} onClick={() => doImport(true, { csv })}>Dry run CSV</button>
            <button type="button" className="loc-btn" disabled={busy || !csv.trim()} onClick={() => doImport(false, { csv })}>Import CSV</button>
          </div>
          {result && (
            <div className="loc-notice">
              <strong>Result ({result.status})</strong>
              <pre style={{ whiteSpace: 'pre-wrap', margin: '6px 0' }}>{JSON.stringify(result.summary, null, 2)}</pre>
              <ReportList title="Validation" data={result.validation} />
              <ReportList title="Duplicates" data={result.duplicates} />
              <ReportList title="Missing relationships" data={result.missingRelationships} />
              {result.coverageNote && <p>{result.coverageNote}</p>}
            </div>
          )}
        </>
      )}

      {view === 'history' && (
        <div className="table-wrapper">
          <table className="data-table">
            <thead><tr><th>Date</th><th>Dataset</th><th>Status</th><th>Summary</th><th /></tr></thead>
            <tbody>
              {imports.length === 0 ? <tr><td colSpan="5" style={{ textAlign: 'center' }}>No imports yet.</td></tr> : imports.map((imp) => (
                <tr key={imp.id}>
                  <td>{new Date(imp.startedAt || imp.createdAt).toLocaleString('en-IN')}</td><td>{imp.dataset}{imp.dryRun ? ' (dry run)' : ''}</td><td>{imp.status}</td>
                  <td><code>{imp.summary ? JSON.stringify(imp.summary) : imp.error || ''}</code></td>
                  <td><button type="button" className="loc-btn" onClick={() => openImport(imp.id)}>Report</button></td>
                </tr>
              ))}
            </tbody>
          </table>
          {importDetail && (
            <div className="loc-notice">
              <strong>Import {importDetail.id}</strong> — {importDetail.source}
              <ReportList title="Validation" data={importDetail.report?.validation} />
              <ReportList title="Duplicates" data={importDetail.report?.duplicates} />
              <ReportList title="Missing relationships" data={importDetail.report?.missingRelationships} />
              {importDetail.report?.error && <p>Error: {importDetail.report.error}</p>}
            </div>
          )}
        </div>
      )}

      {view === 'duplicates' && (
        <div className="table-wrapper">
          <table className="data-table">
            <thead><tr><th>Type</th><th>Name</th><th>Parent</th><th>Count</th></tr></thead>
            <tbody>
              {duplicates.length === 0 ? <tr><td colSpan="4" style={{ textAlign: 'center' }}>No duplicate records found.</td></tr> : duplicates.map((d, i) => (
                <tr key={i}><td>{d.type}</td><td>{d.name}</td><td>{d.parentId}</td><td>{d.ids ? d.ids.length : d.count}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {view === 'audit' && (
        <div className="table-wrapper">
          <table className="data-table">
            <thead><tr><th>Time</th><th>Action</th><th>Actor</th><th>Target</th></tr></thead>
            <tbody>
              {audit.length === 0 ? <tr><td colSpan="4" style={{ textAlign: 'center' }}>No location audit events yet.</td></tr> : audit.map((l) => (
                <tr key={l.id}><td>{new Date(l.createdAt).toLocaleString('en-IN')}</td><td><code>{l.action}</code></td><td>{l.actorEmail || l.actorId}</td><td><code>{l.targetId}</code></td></tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
