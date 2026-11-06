const pad = (n) => String(n).padStart(2, '0');

function toUtcStamp(date, time) {
  const [y, m, d] = String(date).split('-').map(Number);
  const [hh, mm] = String(time || '09:00').split(':').map(Number);
  const utc = new Date(Date.UTC(y, m - 1, d, hh || 0, (mm || 0) - 330));
  return `${utc.getUTCFullYear()}${pad(utc.getUTCMonth() + 1)}${pad(utc.getUTCDate())}T${pad(utc.getUTCHours())}${pad(utc.getUTCMinutes())}00Z`;
}

export function googleCalendarUrl(event) {
  const start = toUtcStamp(event.date, event.startTime);
  const end = event.endTime
    ? toUtcStamp(event.endDate || event.date, event.endTime)
    : toUtcStamp(event.date, `${pad(((Number(String(event.startTime || '09:00').split(':')[0]) || 9) + 2) % 24)}:${String(event.startTime || '09:00').split(':')[1] || '00'}`);
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: event.title || 'SIDEQUEST event',
    dates: `${start}/${end}`,
    details: String(event.description || '').slice(0, 500),
    location: [event.venue, event.city].filter(Boolean).join(', '),
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
