export default function CommunityInsightsPage({ insights = {} }) {
  const safeInsights = insights || { totalRegistrations: 0, popularCategories: [], topEvents: [] };

  return (
    <section className="panel" aria-labelledby="insights-heading">
      <div className="section-heading">
        <div>
          <span className="eyebrow">Community Insights</span>
          <h2 id="insights-heading">Participation snapshot across India</h2>
          <p className="small-copy">
            Aggregated metrics of events, registrations, and trending categories.
            Individual attendee identities are never exposed publicly.
          </p>
        </div>
      </div>

      <div
        className="insight-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '1.25rem',
          margin: '1.5rem 0',
        }}
      >
        <div className="stat-box" style={{ background: '#f5eedc', padding: '1.25rem', borderRadius: '12px' }}>
          <strong style={{ fontSize: '2rem', display: 'block', color: 'var(--deep-green)' }}>
            {(safeInsights.totalRegistrations || 0).toLocaleString('en-IN')}
          </strong>
          <span>Total passes & RSVPs issued</span>
        </div>

        <div className="stat-box" style={{ background: '#f5eedc', padding: '1.25rem', borderRadius: '12px' }}>
          <strong style={{ fontSize: '2rem', display: 'block', color: 'var(--deep-green)' }}>
            {safeInsights.popularCategories?.[0]?.name || safeInsights.popularCategories?.[0]?.category || 'Technology'}
          </strong>
          <span>Top active category</span>
        </div>
      </div>

      <div className="insight-list" style={{ marginTop: '2rem' }}>
        <h3>Top Registered Experiences</h3>
        {safeInsights.topEvents && safeInsights.topEvents.length > 0 ? (
          safeInsights.topEvents.map((entry) => (
            <div
              key={entry.title || entry.id}
              className="insight-item"
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: '12px 0',
                borderBottom: '1px solid var(--line)',
                alignItems: 'center',
              }}
            >
              <span>{entry.title}</span>
              <strong style={{ color: 'var(--deep-green)' }}>
                {entry.count || entry.registeredCount || 0} explorers joined
              </strong>
            </div>
          ))
        ) : (
          <div className="empty-state compact">
            No registration records yet. Be the first to join a quest!
          </div>
        )}
      </div>
    </section>
  );
}
