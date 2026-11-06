import { useEffect, useState } from 'react';
import { getOrganizerAnalytics } from '../services/api';

export default function OrganizerAnalytics() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    getOrganizerAnalytics().then(setData).catch((err) => setError(err.message || 'Could not load analytics.'));
  }, []);

  if (error) return <div className="message error-message">{error}</div>;
  if (!data) return <div className="loading-box">Loading analytics…</div>;

  const max = Math.max(1, ...data.daily.map((d) => d.bookings));
  const barW = 100 / data.daily.length;

  return (
    <div className="analytics-card" style={{ marginTop: '2rem' }}>
      <h3>Bookings – last 14 days</h3>
      <svg viewBox="0 0 100 40" preserveAspectRatio="none" role="img" aria-label="Bookings per day" style={{ width: '100%', height: 160, background: '#f5eedc', borderRadius: 8 }}>
        {data.daily.map((d, i) => {
          const h = (d.bookings / max) * 34;
          return (
            <g key={d.date}>
              <rect x={i * barW + 0.6} y={38 - h} width={barW - 1.2} height={Math.max(h, 0.4)} rx="0.6" fill="#c2571a">
                <title>{`${d.date}: ${d.bookings} tickets, ₹${d.revenue}`}</title>
              </rect>
            </g>
          );
        })}
      </svg>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--muted)' }}>
        <span>{data.daily[0].date}</span>
        <span>Check-in rate: <strong>{data.checkInRate}%</strong></span>
        <span>{data.daily[data.daily.length - 1].date}</span>
      </div>

      <h3 style={{ marginTop: '1.5rem' }}>Capacity fill by event</h3>
      {data.perEvent.length === 0 ? (
        <p className="helper-text">Publish an event to see analytics here.</p>
      ) : (
        data.perEvent.map((e) => (
          <div key={e.id} style={{ margin: '8px 0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
              <span>{e.title}</span>
              <span>{e.booked}/{e.capacity || '∞'} · ₹{e.revenue.toLocaleString('en-IN')}</span>
            </div>
            <div style={{ background: '#e8dfc9', borderRadius: 6, height: 10 }}>
              <div style={{ width: `${e.fillRate}%`, height: '100%', background: '#2f7d5b', borderRadius: 6 }} />
            </div>
          </div>
        ))
      )}
    </div>
  );
}
