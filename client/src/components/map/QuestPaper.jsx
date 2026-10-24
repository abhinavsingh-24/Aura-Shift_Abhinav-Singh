import { memo, useRef, useState } from 'react';
import { MAP_W, MAP_H } from '../../lib/mapLayout';
import { categoryGlyph, formatShortDate } from '../../lib/format';

/** A real event, pinned to the map as a small invitation. Position comes from the layout, never from random per-render values. */
function QuestPaper({ event, point, selected, saved, onSelect, onFocusPaper }) {
  const ref = useRef(null);
  const [imageFailed, setImageFailed] = useState(false);

  const handleMove = (e) => {
    if (e.pointerType !== 'mouse' || !ref.current) return;
    const b = ref.current.getBoundingClientRect();
    const px = (e.clientX - b.left) / b.width - 0.5;
    const py = (e.clientY - b.top) / b.height - 0.5;
    ref.current.style.setProperty('--tilt-y', `${(px * 16).toFixed(1)}deg`);
    ref.current.style.setProperty('--tilt-x', `${(py * -14).toFixed(1)}deg`);
  };
  const resetTilt = () => {
    if (!ref.current) return;
    ref.current.style.setProperty('--tilt-x', '0deg');
    ref.current.style.setProperty('--tilt-y', '0deg');
  };

  const label = `${event.title}. ${event.category}. ${formatShortDate(event)}. ${event.locality}, ${event.city}. ${selected ? 'Selected.' : 'Press to preview.'}`;

  return (
    <button
      ref={ref}
      type="button"
      className={`quest-paper${selected ? ' is-selected' : ''}${saved ? ' is-saved' : ''}`}
      style={{ left: `${(point.x / MAP_W) * 100}%`, top: `${(point.y / MAP_H) * 100}%`, '--rot0': `${point.rot}deg`, zIndex: selected ? 50 : Math.round(point.y / 10) }}
      aria-pressed={selected}
      aria-label={label}
      data-quest-id={event.id}
      onClick={() => onSelect(event)}
      onFocus={() => onFocusPaper(event)}
      onPointerMove={handleMove}
      onPointerLeave={resetTilt}
    >
      <span className="paper-seal" aria-hidden="true" />
      <span className="paper-thumb" aria-hidden="true">
        {event.imageUrl && !imageFailed
          ? <img src={event.imageUrl} alt="" loading="lazy" draggable="false" onError={() => setImageFailed(true)} />
          : <span className="paper-glyph">{categoryGlyph(event.category)}</span>}
      </span>
      <span className="paper-body">
        <span className="paper-cat">{event.category}</span>
        <strong className="paper-title">{event.title}</strong>
        <span className="paper-meta">{formatShortDate(event)} · {event.locality}</span>
      </span>
    </button>
  );
}

export default memo(QuestPaper);
