import { useMemo } from 'react';
import { formatLongDateTime } from '../lib/format';

export default function QuestCalendarPage({
  allEvents = [],
  savedQuestIds = [],
  onViewDetails,
  now,
}) {
  const planned = useMemo(() => {
    const cutoff = now || new Date(0);
    return allEvents
      .filter(
        (event) =>
          savedQuestIds.some((id) => String(id) === String(event.id)) &&
          event.date &&
          new Date(`${event.date}T${event.startTime || '23:59'}:00`) >= cutoff,
      )
      .sort((a, b) => `${a.date} ${a.startTime || ''}`.localeCompare(`${b.date} ${b.startTime || ''}`));
  }, [allEvents, savedQuestIds, now]);

  const exportCalendar = () => {
    const esc = (value) =>
      String(value || '')
        .replace(/\\/g, '\\\\')
        .replace(/,/g, '\\,')
        .replace(/;/g, '\\;')
        .replace(/\n/g, '\\n');

    const stamp = (event) =>
      `${String(event.date).replaceAll('-', '')}T${String(event.startTime || '09:00').replace(':', '')}00`;

    const lines = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//SIDEQUEST//Quest Calendar//EN',
      ...planned.flatMap((event) => [
        'BEGIN:VEVENT',
        `UID:${esc(event.id)}@sidequest`,
        `DTSTART:${stamp(event)}`,
        `SUMMARY:${esc(event.title)}`,
        `LOCATION:${esc([event.venue, event.locality, event.city].filter(Boolean).join(', '))}`,
        `DESCRIPTION:${esc(event.description)}`,
        'END:VEVENT',
      ]),
      'END:VCALENDAR',
    ];

    const blob = new Blob([lines.join('\r\n')], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'sidequest-schedule.ics';
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section className="panel feature-panel calendar-panel" aria-labelledby="calendar-heading">
      <div className="section-heading">
        <div>
          <span className="eyebrow">Quest Calendar</span>
          <h2 id="calendar-heading">Your upcoming quest schedule.</h2>
          <p className="small-copy">
            A chronological timeline of your saved quests with downloadable .ics export for Google Calendar, Apple Calendar, and Outlook.
          </p>
        </div>
        <span className="feature-emblem" aria-hidden="true">▦</span>
      </div>

      <div
        className="calendar-toolbar"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '1.2rem',
          flexWrap: 'wrap',
          gap: '1rem',
        }}
      >
        <div>
          <strong>{planned.length}</strong>
          <span> upcoming scheduled {planned.length === 1 ? 'quest' : 'quests'}</span>
        </div>
        <button
          className="primary-btn"
          type="button"
          onClick={exportCalendar}
          disabled={!planned.length}
        >
          📅 Export .ics Calendar
        </button>
      </div>

      {planned.length ? (
        <div className="calendar-list">
          {planned.map((event) => (
            <article className="calendar-event" key={event.id}>
              <div className="calendar-date">
                <span>{new Date(`${event.date}T00:00:00`).toLocaleDateString('en-IN', { month: 'short' })}</span>
                <strong>{new Date(`${event.date}T00:00:00`).getDate()}</strong>
                <small>{new Date(`${event.date}T00:00:00`).toLocaleDateString('en-IN', { weekday: 'short' })}</small>
              </div>
              <div className="calendar-event-copy">
                <span className="pill accent">{event.category}</span>
                <h3>{event.title}</h3>
                <p className="small-copy">
                  {formatLongDateTime(event)} · {[event.venue, event.locality, event.city].filter(Boolean).join(', ')}
                </p>
              </div>
              <button
                type="button"
                className="secondary-btn"
                onClick={() => onViewDetails?.(event)}
              >
                View Details
              </button>
            </article>
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <span className="empty-icon" aria-hidden="true">📅</span>
          <h3>No saved upcoming quests yet</h3>
          <p>Bookmark events from the Quest Board or Quest Radar to populate your personal calendar.</p>
          <a href="/quests" className="primary-btn btn-sm">Explore Quest Board</a>
        </div>
      )}
    </section>
  );
}
