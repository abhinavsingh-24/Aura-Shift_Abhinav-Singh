export function validateReviewDraft(story) {
  const value = String(story || '').trim();
  if (value.length < 12) return { valid: false, message: 'Add at least 12 characters so your story helps another explorer.' };
  if (value.length > 600) return { valid: false, message: 'Keep your story to 600 characters or fewer.' };
  return { valid: true, message: '' };
}

export function createLocalReview({ rating, story, tips = '', author = 'Local Explorer', now = new Date() }) {
  const validation = validateReviewDraft(story);
  if (!validation.valid) throw new Error(validation.message);
  const parsedRating = Number(rating);
  return {
    id: `review-${now.getTime()}`,
    author: String(author || 'Local Explorer').trim().slice(0, 80) || 'Local Explorer',
    rating: Number.isFinite(parsedRating) ? Math.min(5, Math.max(1, Math.round(parsedRating))) : 5,
    story: String(story).trim(),
    tips: String(tips || '').trim().slice(0, 180),
    createdAt: now.toISOString(),
  };
}
