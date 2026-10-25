import React from 'react';

export default function AuthGate({
  title = 'Your next adventure starts here.',
  description = 'Sign in or create a free account to save quests, personalize recommendations, and manage your bookings.',
  next = '',
  requiredRole = 'explorer',
}) {
  const nextParam = next ? `?next=${encodeURIComponent(next)}` : '';
  const registerHref = requiredRole === 'organizer'
    ? `/register?role=organizer${next ? `&next=${encodeURIComponent(next)}` : ''}`
    : `/register${nextParam}`;

  return (
    <div className="auth-gate">
      <div className="auth-gate-card">
        <span className="eyebrow">
          <span className="eyebrow-dot" /> {requiredRole === 'organizer' ? 'Organizer Access' : 'Explorer Access'}
        </span>
        <h2>{title}</h2>
        <p className="description">{description}</p>
        <div className="auth-gate-actions hero-actions">
          <a className="primary-btn" href={`/login${nextParam}`}>Sign in</a>
          <a className="secondary-btn" href={registerHref}>
            {requiredRole === 'organizer' ? 'Create organizer account' : 'Create free account'}
          </a>
          <a className="ghost-btn" href="/quests">Back to Exploring</a>
        </div>
      </div>
    </div>
  );
}

