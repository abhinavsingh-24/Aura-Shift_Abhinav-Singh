const REPORT_REASONS = new Set(['misleading', 'unsafe', 'spam', 'harassment', 'inappropriate', 'other']);

function validateReportDraft(input = {}) {
  const errors = [];
  const targetType = typeof input.targetType === 'string' ? input.targetType.trim() : '';
  const targetId = typeof input.targetId === 'string' ? input.targetId.trim() : '';
  const reason = typeof input.reason === 'string' ? input.reason.trim() : '';
  const details = typeof input.details === 'string' ? input.details.trim() : '';
  if (!['event', 'organizer'].includes(targetType)) errors.push('Choose an event or organizer to report.');
  if (!targetId || targetId.length > 160) errors.push('A valid report target is required.');
  if (!REPORT_REASONS.has(reason)) errors.push('Choose a valid report reason.');
  if (details.length > 1000) errors.push('Details must be 1,000 characters or fewer.');
  return { isValid: errors.length === 0, errors, value: { targetType, targetId, reason, details } };
}

module.exports = { REPORT_REASONS, validateReportDraft };
