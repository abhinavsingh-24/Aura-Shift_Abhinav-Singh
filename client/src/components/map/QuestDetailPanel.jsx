import { useEffect, useRef, useState } from 'react';
import { REGIONS, regionForCategory } from '../../lib/mapLayout';
import { categoryGlyph, formatLongDateTime } from '../../lib/format';
import { useQuestDetail } from '../../lib/useQuestDetail';

const MORE_LIMIT = 8;

/**
 * One persistent panel for the whole quest board (map AND list). Selecting another quest swaps the content in
 * place: the container never unmounts, keeps its size, and does not take focus away from the control you used.
 * On phones the same element becomes a bottom sheet (see map.css).
 */
export default function QuestDetailPanel({ store, event, siblings, saved, onToggleSave, onRegister, onSelect, onClose, counts }) {
  const { quest, loading, error, retry } = useQuestDetail(store, event);
  const bodyRef = useRef(null);
  const [failedImage, setFailedImage] = useState(null);

  useEffect(() => { if (bodyRef.current) bodyRef.current.scrollTop = 0; }, [event?.id]);

  if (!quest) {
    return (
      <aside className="quest-panel is-idle" aria-label="Quest details">
        <h3>Reading the map</h3>
        <p className="preview-hint">Select any quest on the map or in the list. Its details appear here and stay open while you look at others. Region names are decorative; every quest shows its real city, locality and venue.</p>
        <ul className="region-legend">
          {REGIONS.map((r) => <li key={r.id}><span>{r.name}</span><small>{r.theme} · {counts[r.id] || 0}</small></li>)}
        </ul>
      </aside>
    );
  }

  const region = regionForCategory(quest.category);
  const imageFailed = failedImage === quest.id;
  const free = quest.isFree || quest.priceStarting === 0 || Number(quest.price) === 0;
  const price = free ? 'Free' : (quest.priceStarting != null ? `From ₹${Number(quest.priceStarting).toLocaleString('en-IN')}` : (quest.price != null ? `₹${quest.price}` : null));
  const more = siblings.filter((s) => String(s.id) !== String(quest.id)).slice(0, MORE_LIMIT);
  const registerLabel = free ? 'RSVP free' : 'Book tickets';
  const place = [quest.venue, quest.locality, quest.city].filter(Boolean).join(', ');

  return (
    <aside className="quest-panel has-selection" aria-label="Quest details" data-quest-id={quest.id}>
      <div className="panel-head">
        <button type="button" className="panel-back" onClick={onClose} aria-label="Back to the map">← <span>Back</span></button>
        <button type="button" className="panel-close" onClick={onClose} aria-label="Close quest details">×</button>
      </div>
      {/* Announces every switch to assistive tech without moving focus. */}
      <p className="sr-only" role="status" aria-live="polite">Selected quest: {quest.title}</p>

      <div className="panel-body" ref={bodyRef}>
        <div className="panel-art">
          {quest.imageUrl && !imageFailed
            ? <img key={quest.id} src={quest.imageUrl} alt="" width="360" height="200" decoding="async" onError={() => setFailedImage(quest.id)} />
            : <span aria-hidden="true">{categoryGlyph(quest.category)}</span>}
        </div>
        <span className="preview-cat">{quest.category} · {region.name}</span>
        <h3 className="panel-title">{quest.title}</h3>
        {price && <p className="preview-price">{price}</p>}

        <dl className="preview-facts">
          <div><dt>When</dt><dd>{formatLongDateTime(quest)}{quest.endTime ? ` – ${quest.endTime}` : ''}</dd></div>
          <div><dt>Where</dt><dd>{place}</dd></div>
          {quest.organizerName && <div><dt>Hosted by</dt><dd>{quest.organizerName}</dd></div>}
          {quest.capacity ? <div><dt>Capacity</dt><dd>{quest.capacity}</dd></div> : null}
        </dl>

        <p className="panel-desc">{quest.description}</p>

        {loading && <p className="panel-note" role="status"><span className="panel-spinner" aria-hidden="true" /> Loading the latest details…</p>}
        {error && !loading && (
          <p className="panel-note is-error" role="alert">
            Couldn’t refresh the latest details. What you see is from the listing.{' '}
            <button type="button" className="link-btn" onClick={retry}>Try again</button>
          </p>
        )}

        <div className="preview-actions">
          <button type="button" className="primary-btn" onClick={() => onRegister(quest)}>{registerLabel}</button>
          <button type="button" className={saved ? 'save-btn active' : 'save-btn'} aria-pressed={saved} onClick={() => onToggleSave(quest)}>{saved ? 'Saved' : 'Save quest'}</button>
          <a className="secondary-btn" href={`/quests/${encodeURIComponent(quest.id)}`}>Full event page</a>
        </div>

        {more.length > 0 && (
          <nav className="panel-more" aria-label={`More quests in ${region.name}`}>
            <h4>More in {region.name}</h4>
            <ul>
              {more.map((s) => (
                <li key={s.id}>
                  <button type="button" onClick={() => onSelect(s)} onPointerEnter={() => store.prefetch(s.id)} onFocus={() => store.prefetch(s.id)}>
                    <strong>{s.title}</strong>
                    <small>{s.locality || s.city}</small>
                  </button>
                </li>
              ))}
            </ul>
          </nav>
        )}
      </div>
    </aside>
  );
}
