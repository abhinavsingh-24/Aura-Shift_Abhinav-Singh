import { useRef, useState } from 'react';
import { REGIONS, regionForCategory } from '../../lib/mapLayout';
import { categoryGlyph, formatLongDateTime } from '../../lib/format';

export default function SelectedQuestPreview({ event, saved, onToggleSave, onClose, counts }) {
  const closeRef = useRef(null);
  const [failedEventId, setFailedEventId] = useState(null);
  const imageFailed = failedEventId === event?.id;

  if (!event) {
    return (
      <aside className="quest-preview is-idle" aria-label="Map guide">
        <h3>Reading the map</h3>
        <p className="preview-hint">Select a quest paper to preview it here. Region names are decorative; every quest shows its real city, locality and venue.</p>
        <ul className="region-legend">
          {REGIONS.map((r) => <li key={r.id}><span>{r.name}</span><small>{r.theme} · {counts[r.id] || 0}</small></li>)}
        </ul>
      </aside>
    );
  }

  const region = regionForCategory(event.category);
  return (
    <aside className="quest-preview" aria-label={`Selected quest: ${event.title}`} aria-live="polite">
      <button ref={closeRef} type="button" className="preview-close" onClick={onClose} aria-label="Close preview">×</button>
      <div className="preview-art">
        {event.imageUrl && !imageFailed
          ? <img src={event.imageUrl} alt="" onError={() => setFailedEventId(event?.id)} />
          : <span aria-hidden="true">{categoryGlyph(event.category)}</span>}
      </div>
      <span className="preview-cat">{event.category} · {region.name}</span>
      <h3>{event.title}</h3>
      <dl className="preview-facts">
        <div><dt>When</dt><dd>{formatLongDateTime(event)}</dd></div>
        <div><dt>Where</dt><dd>{event.venue}, {event.locality}, {event.city}</dd></div>
        {event.organizerName && <div><dt>Hosted by</dt><dd>{event.organizerName}</dd></div>}
        {event.capacity ? <div><dt>Capacity</dt><dd>{event.capacity}</dd></div> : null}
      </dl>
      <p className="preview-desc">{event.description}</p>
      <div className="preview-actions">
        <a className="primary-btn" href={`/quests/${encodeURIComponent(event.id)}`}>View quest</a>
        <button type="button" className={saved ? 'save-btn active' : 'save-btn'} aria-pressed={saved} onClick={() => onToggleSave(event)}>{saved ? 'Saved' : 'Save quest'}</button>
      </div>
    </aside>
  );
}
