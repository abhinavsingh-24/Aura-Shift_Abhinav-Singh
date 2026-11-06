import { useState } from 'react';
import { getMysteryQuest } from '../lib/mysteryQuest';
import { categoryGlyph, formatLongDateTime } from '../lib/format';

export default function MysteryQuestPage({
  allEvents = [],
  selectedInterests = [],
  cityOptions = [],
  categoryOptions = [],
  savedQuestIds = [],
  onToggleSave,
  onViewDetails,
  onBook,
  mysteryRevealCount = 0,
  setMysteryRevealCount,
}) {
  const [mysteryFilters, setMysteryFilters] = useState({ city: 'all', category: 'all', time: 'any' });
  const [mysteryPick, setMysteryPick] = useState(null);

  const drawQuest = () => {
    const result = getMysteryQuest(allEvents, {
      interests: selectedInterests,
      city: mysteryFilters.city,
      category: mysteryFilters.category,
      timeframe: mysteryFilters.time,
      now: new Date(),
    });
    setMysteryPick(result);
    if (setMysteryRevealCount) {
      setMysteryRevealCount((count) => count + 1);
    }
  };

  return (
    <section id="mystery-quest" className="panel mystery-panel" aria-labelledby="mystery-heading">
      <div className="section-heading">
        <div>
          <span className="eyebrow">Mystery Quest</span>
          <h2 id="mystery-heading">Leave the next move to fate.</h2>
          <p className="small-copy">
            Set a few boundaries, then reveal an upcoming quest picked from real verified events across India.
            Your interests gently influence the pick—surprise is part of the fun.
          </p>
        </div>
        <span className="mystery-emblem" aria-hidden="true">?</span>
      </div>

      <div className="mystery-rules">
        <label>
          <span>City</span>
          <select
            value={mysteryFilters.city}
            onChange={(event) => {
              setMysteryFilters((current) => ({ ...current, city: event.target.value }));
              setMysteryPick(null);
            }}
          >
            <option value="all">Any city</option>
            {cityOptions.map((city) => (
              <option key={city} value={city}>{city}</option>
            ))}
          </select>
        </label>

        <label>
          <span>Quest type</span>
          <select
            value={mysteryFilters.category}
            onChange={(event) => {
              setMysteryFilters((current) => ({ ...current, category: event.target.value }));
              setMysteryPick(null);
            }}
          >
            <option value="all">Anything goes</option>
            {categoryOptions.map((category) => (
              <option key={category} value={category}>{category}</option>
            ))}
          </select>
        </label>

        <label>
          <span>Time window</span>
          <select
            value={mysteryFilters.time}
            onChange={(event) => {
              setMysteryFilters((current) => ({ ...current, time: event.target.value }));
              setMysteryPick(null);
            }}
          >
            <option value="any">Any upcoming date</option>
            <option value="today">Today</option>
            <option value="weekend">This weekend</option>
            <option value="next7days">Next 7 days</option>
          </select>
        </label>
      </div>

      <div className="mystery-interest-note">
        <strong>Your interests:</strong> {selectedInterests.length ? selectedInterests.join(' · ') : 'All categories'}
      </div>

      <div className="mystery-reveal-stage">
        {!mysteryPick ? (
          <>
            <span className="mystery-sigil" aria-hidden="true">✦</span>
            <p className="eyebrow">The next quest is hidden</p>
            <h3>Ready for an unexpected adventure?</h3>
            <p className="small-copy">We’ll choose from future events that match your filters and show you why the pick made the list.</p>
            <button
              type="button"
              className="primary-btn mystery-draw-btn"
              onClick={drawQuest}
            >
              {mysteryRevealCount ? 'Draw another quest' : 'Reveal my quest'}
            </button>
          </>
        ) : (
          <>
            <span className="eyebrow">Your mystery quest is revealed</span>
            <article className="mystery-result">
              <div className="radar-result-symbol" aria-hidden="true">
                {categoryGlyph(mysteryPick.event.category)}
              </div>
              <div className="mystery-result-copy">
                <span className="pill accent">{mysteryPick.event.category}</span>
                <h3>{mysteryPick.event.title}</h3>
                <p className="small-copy">
                  {formatLongDateTime(mysteryPick.event)} · {[mysteryPick.event.venue, mysteryPick.event.locality, mysteryPick.event.city].filter(Boolean).join(', ')}
                </p>
                <p className="description">{mysteryPick.event.description}</p>
                <div className="mystery-reasons">
                  <strong>Why this quest?</strong>
                  {mysteryPick.reasons?.map((reason) => (
                    <span key={reason}>✦ {reason}</span>
                  ))}
                  <span>Chosen from {mysteryPick.candidatesCount} eligible upcoming quests.</span>
                </div>
                <div className="mystery-actions">
                  <button type="button" className="primary-btn" onClick={() => onViewDetails?.(mysteryPick.event)}>
                    View quest
                  </button>
                  <button
                    type="button"
                    className={savedQuestIds.includes(mysteryPick.event.id) ? 'save-btn active' : 'save-btn'}
                    onClick={() => onToggleSave?.(mysteryPick.event)}
                  >
                    {savedQuestIds.includes(mysteryPick.event.id) ? '✓ Saved' : '＋ Save quest'}
                  </button>
                  {onBook ? (
                    <button
                      type="button"
                      className="primary-btn"
                      style={{ background: '#16a34a' }}
                      onClick={() => onBook(mysteryPick.event)}
                    >
                      {mysteryPick.event.isFree ? 'RSVP Free' : 'Book Tickets'}
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="secondary-btn"
                    onClick={drawQuest}
                  >
                    Try another ↻
                  </button>
                </div>
              </div>
            </article>
          </>
        )}
      </div>

      <div className="mystery-stats-footer" style={{ marginTop: '1.5rem', display: 'flex', gap: '2rem', justifyContent: 'center' }}>
        <div><strong>{mysteryRevealCount}</strong> <span>Mystery reveals</span></div>
        <div><strong>{allEvents.length}</strong> <span>Total pool events</span></div>
      </div>
    </section>
  );
}
