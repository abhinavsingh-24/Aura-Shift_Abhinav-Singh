export default function ExplorerLevelsPage({ explorerLevel }) {
  const safeLevel = explorerLevel || {
    xp: 0,
    level: 1,
    title: 'Rookie Explorer',
    currentLevelXp: 0,
    nextLevelXp: 100,
    progress: 0,
  };

  const ranks = [
    { rank: '01', title: 'Rookie Explorer', req: 'Level 1–3' },
    { rank: '02', title: 'Wayfinder', req: 'Level 4–6' },
    { rank: '03', title: 'Pathfinder', req: 'Level 7–9' },
    { rank: '04', title: 'Trailblazer', req: 'Level 10–12' },
    { rank: '05', title: 'Legendary Explorer', req: 'Level 13+' },
  ];

  return (
    <section className="panel feature-panel levels-panel" aria-labelledby="levels-heading">
      <div className="section-heading">
        <div>
          <span className="eyebrow">XP & Progression</span>
          <h2 id="levels-heading">Every small step moves you forward.</h2>
          <p className="small-copy">
            Earn experience through your genuine activity on SIDEQUEST. Progress is a transparent explorer score.
          </p>
        </div>
        <span className="feature-emblem" aria-hidden="true">✦</span>
      </div>

      <nav className="sq-subnav" aria-label="Journal pages" style={{ display: 'flex', gap: '8px', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        <a href="/profile">Explorer Card</a>
        <a href="/achievements">Milestone Badges</a>
        <a href="/levels" aria-current="page">Explorer XP (Lvl {safeLevel.level})</a>
        <a href="/bookings">My Tickets & Bookings</a>
        <a href="/chat">Party Chat</a>
      </nav>

      <div className="level-hero">
        <div className="level-medallion" aria-label={`Level ${safeLevel.level}`}>
          {safeLevel.level}
        </div>
        <div className="level-copy">
          <span className="eyebrow">CURRENT RANK</span>
          <h3>{safeLevel.title}</h3>
          <p>{safeLevel.xp} total XP earned · {safeLevel.currentLevelXp}/100 XP toward next level</p>
          <div
            className="achievement-progress"
            role="progressbar"
            aria-label="Progress to next level"
            aria-valuemin="0"
            aria-valuemax="100"
            aria-valuenow={safeLevel.progress}
          >
            <span style={{ width: `${safeLevel.progress}%` }} />
          </div>
        </div>
      </div>

      <div className="xp-rules-grid">
        <article><strong>+10 XP</strong><span>Save a quest</span></article>
        <article><strong>+25 XP</strong><span>Share a field note / review</span></article>
        <article><strong>+15 XP</strong><span>Add a chain stop</span></article>
        <article><strong>+5 XP</strong><span>Reveal a Mystery Quest</span></article>
        <article><strong>+2 XP</strong><span>Post a party chat message</span></article>
      </div>

      <div className="level-ladder">
        <h3>Explorer Ladder</h3>
        {ranks.map((item) => (
          <div
            className={safeLevel.title === item.title ? 'level-rank current' : 'level-rank'}
            key={item.title}
          >
            <span>{item.rank}</span>
            <strong>{item.title}</strong>
            <small>{item.req}</small>
          </div>
        ))}
      </div>
    </section>
  );
}
