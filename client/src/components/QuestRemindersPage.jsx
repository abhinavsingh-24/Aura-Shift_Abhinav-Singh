import { useMemo } from 'react';
import { formatLongDateTime } from '../lib/format';

export default function QuestRemindersPage({
  allEvents = [],
  savedQuestIds = [],
  reminderLeadMinutes = 60,
  setReminderLeadMinutes,
  remindersEnabled = false,
  setRemindersEnabled,
  reminderStatus = '',
  setReminderStatus,
  reminderNow,
  onViewDetails,
}) {
  const leadMs = reminderLeadMinutes * 60 * 1000;

  const reminderItems = useMemo(() => {
    const now = reminderNow || 0;
    const upcoming = allEvents
      .filter((event) => savedQuestIds.some((id) => String(id) === String(event.id)))
      .map((event) => {
        let start = 0;
        if (event.date) {
          const dateStr = String(event.date).trim();
          const timeStr = event.startTime ? String(event.startTime).trim() : '23:59';
          const parsed = new Date(`${dateStr}T${timeStr}:00`);
          start = Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
        }
        return { event, start };
      })
      .filter((item) => item.start >= now)
      .sort((a, b) => a.start - b.start);

    return upcoming.map((item) => ({
      ...item,
      reminderAt: item.start - leadMs,
      status: now >= item.start - leadMs ? 'due' : 'scheduled',
      minutesUntil: Math.max(0, Math.round((item.start - now) / 60000)),
    }));
  }, [allEvents, savedQuestIds, reminderNow, leadMs]);

  const enableQuestReminders = async () => {
    if (typeof Notification === 'undefined') {
      if (setReminderStatus) setReminderStatus('This browser does not support notifications. Upcoming reminders remain visible here.');
      return;
    }
    if (!savedQuestIds.length) {
      if (setReminderStatus) setReminderStatus('Save at least one quest first, then enable reminders for it.');
      return;
    }
    if (Notification.permission === 'denied') {
      if (setReminderStatus) setReminderStatus('Notifications are blocked by this browser. Change site permissions in your browser settings.');
      return;
    }
    try {
      const permission = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
      if (permission !== 'granted') {
        if (setReminderStatus) setReminderStatus('Notification permission was not granted. You can still view upcoming saved quests here.');
        return;
      }
      if (setRemindersEnabled) setRemindersEnabled(true);
      if (setReminderStatus) setReminderStatus('Quest reminders are active for your saved upcoming quests on this browser.');
    } catch {
      if (setReminderStatus) setReminderStatus('Could not enable notifications. You can still view upcoming saved quests here.');
    }
  };

  const disableQuestReminders = () => {
    if (setRemindersEnabled) setRemindersEnabled(false);
    if (setReminderStatus) setReminderStatus('Browser reminders are turned off. Your saved quests are unchanged.');
  };

  return (
    <section id="quest-reminders" className="panel reminders-panel" aria-labelledby="reminders-heading">
      <div className="section-heading">
        <div>
          <span className="eyebrow">Quest Reminders</span>
          <h2 id="reminders-heading">Keep your next adventure on the radar.</h2>
          <p className="small-copy">
            Set browser reminders for quests you’ve saved. This is an optional, device-local notification feature.
          </p>
        </div>
        <span className="reminder-emblem" aria-hidden="true">◷<i>✦</i></span>
      </div>

      <div className="reminder-controls">
        <label>
          <span>Remind me before the event:</span>
          <select
            value={reminderLeadMinutes}
            onChange={(event) => setReminderLeadMinutes?.(Number(event.target.value))}
          >
            <option value="15">15 minutes before</option>
            <option value="30">30 minutes before</option>
            <option value="60">1 hour before</option>
            <option value="1440">1 day before</option>
          </select>
        </label>

        <div className="reminder-toggle-card">
          <div>
            <strong>{remindersEnabled ? 'Browser reminders are active' : 'Browser reminders are off'}</strong>
            <p className="small-copy">
              {typeof Notification === 'undefined'
                ? 'Notifications are not available in this browser.'
                : Notification.permission === 'denied'
                ? 'Notifications are blocked in browser settings.'
                : 'Keep this browser open around the reminder time for scheduled notifications.'}
            </p>
          </div>
          {remindersEnabled ? (
            <button type="button" className="secondary-btn" onClick={disableQuestReminders}>Turn off</button>
          ) : (
            <button type="button" className="primary-btn" onClick={enableQuestReminders}>Enable reminders</button>
          )}
        </div>
      </div>

      {reminderStatus ? <p className="message compact" role="status">{reminderStatus}</p> : null}

      <div className="reminder-summary">
        <div><strong>{savedQuestIds.length}</strong><span>Saved quests</span></div>
        <div><strong>{reminderItems.length}</strong><span>Upcoming saved quests</span></div>
        <div><strong>{reminderItems.filter((item) => item.status === 'due').length}</strong><span>Due soon</span></div>
      </div>

      <div className="reminders-list-heading" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.5rem', marginBottom: '1rem' }}>
        <div>
          <span className="eyebrow">Your schedule</span>
          <h3>Upcoming saved events</h3>
        </div>
        <a className="secondary-btn btn-sm" href="/saved">Manage saved quests</a>
      </div>

      {!savedQuestIds.length ? (
        <div className="empty-state reminder-empty">
          <span className="empty-icon" aria-hidden="true">◷</span>
          <h3>Your reminder list is empty</h3>
          <p>Save an event from the Quest Board or Quest Radar to set reminders.</p>
          <a href="/quests" className="primary-btn btn-sm">Browse Quests</a>
        </div>
      ) : reminderItems.length === 0 ? (
        <div className="empty-state reminder-empty">
          <span className="empty-icon" aria-hidden="true">✓</span>
          <h3>No upcoming saved events</h3>
          <p>All your saved quests are past dates or do not have future schedules set.</p>
        </div>
      ) : (
        <div className="reminders-list">
          {reminderItems.map((item) => (
            <article className="reminder-card" key={item.event.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', borderBottom: '1px solid var(--line)' }}>
              <div>
                <span className={`pill ${item.status === 'due' ? 'accent' : 'muted'}`}>
                  {item.status === 'due' ? '🔔 Due Now' : `In ${Math.round(item.minutesUntil / 60)}h`}
                </span>
                <h4 style={{ margin: '0.4rem 0 0.2rem' }}>{item.event.title}</h4>
                <p className="small-copy" style={{ margin: 0 }}>
                  {formatLongDateTime(item.event)} · {item.event.venue}, {item.event.city}
                </p>
              </div>
              <button
                type="button"
                className="secondary-btn btn-sm"
                onClick={() => onViewDetails?.(item.event)}
              >
                View
              </button>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
