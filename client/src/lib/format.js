const dateOf = (event) => (event && event.date ? new Date(`${event.date}T${event.startTime || '09:00'}:00`) : null);

export function formatShortDate(event) {
  const date = dateOf(event);
  if (!date || Number.isNaN(date.getTime())) return 'Date TBD';
  return new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short' }).format(date);
}

export function formatLongDateTime(event) {
  const date = dateOf(event);
  if (!date || Number.isNaN(date.getTime())) return 'Date TBD';
  return new Intl.DateTimeFormat('en-IN', { weekday: 'long', day: 'numeric', month: 'long', hour: 'numeric', minute: '2-digit' }).format(date);
}

export const CATEGORY_GLYPHS = {
  Music: '♫', Technology: '⌘', Sports: '↗', 'Art and culture': '✳', Education: '✎', Gaming: '◇', 'Community activities': '◎', Workshops: '✂',
};
export const categoryGlyph = (category) => CATEGORY_GLYPHS[category] || '✦';
