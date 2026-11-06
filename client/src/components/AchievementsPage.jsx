export default function AchievementsPage({
  achievements = [],
  savedQuestIds = [],
  questChains = [],
  mysteryRevealCount = 0,
}) {
  const earnedCount = achievements.filter((badge) => badge.earned).length;
  const totalStops = questChains.reduce((total, chain) => total + (chain.stops?.length || 0), 0);

  return (
    <section id="achievements" className="panel achievements-panel" aria-labelledby="achievements-heading">
      <div className="section-heading">
        <div>
          <span className="eyebrow">Explorer Achievements</span>
          <h2 id="achievements-heading">Every little adventure counts.</h2>
          <p className="small-copy">
            Milestones calculated from your saved quests, Quest Chains, and Mystery Quest reveals on this browser.
          </p>
        </div>
        <span className="achievement-emblem" aria-hidden="true">✺</span>
      </div>

      <nav className="sq-subnav" aria-label="Journal pages" style={{ display: 'flex', gap: '8px', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        <a href="/profile">Explorer Card</a>
        <a href="/achievements" aria-current="page">Milestone Badges ({earnedCount})</a>
        <a href="/levels">Explorer XP</a>
        <a href="/bookings">My Tickets & Bookings</a>
        <a href="/chat">Party Chat</a>
      </nav>

      <div className="achievement-summary">
        <div><strong>{earnedCount}/{achievements.length}</strong><span>Badges earned</span></div>
        <div><strong>{savedQuestIds.length}</strong><span>Saved quests</span></div>
        <div><strong>{totalStops}</strong><span>Planned stops</span></div>
        <div><strong>{mysteryRevealCount}</strong><span>Mystery reveals</span></div>
      </div>

      <div className="achievement-grid">
        {achievements.map((badge) => (
          <article
            key={badge.id}
            className={badge.earned ? 'achievement-card earned' : 'achievement-card'}
          >
            <div className="achievement-icon" aria-hidden="true">
              {badge.earned ? badge.icon : '◇'}
            </div>
            <div className="achievement-copy">
              <div className="achievement-status">
                {badge.earned ? '✦ UNLOCKED' : 'STILL IN PROGRESS'}
              </div>
              <h3>{badge.title}</h3>
              <p>{badge.description}</p>
              <div
                className="achievement-progress"
                role="progressbar"
                aria-label={`${badge.title} progress`}
                aria-valuemin="0"
                aria-valuemax={badge.target}
                aria-valuenow={badge.progress}
              >
                <span style={{ width: `${badge.percent}%` }} />
              </div>
              <small>{badge.progress}/{badge.target} progress ({badge.percent}%)</small>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
