import { useState } from 'react';

export default function ExplorerProfilePage({
  currentUser,
  savedQuestIds = [],
  questChains = [],
  reviewsByQuest = {},
  achievements = [],
  profileDraft = { bio: '', city: '', visibility: 'public' },
  setProfileDraft,
  setToast,
}) {
  const [city, setCity] = useState(profileDraft.city || '');
  const [bio, setBio] = useState(profileDraft.bio || '');

  const totalReviews = Object.values(reviewsByQuest).reduce(
    (total, list) => total + (Array.isArray(list) ? list.length : 0),
    0,
  );
  const earnedBadges = achievements.filter((b) => b.earned).length;

  const handleSave = (event) => {
    event.preventDefault();
    const updated = { ...profileDraft, city, bio };
    if (setProfileDraft) setProfileDraft(updated);
    try {
      window.localStorage.setItem('sidequest-profile', JSON.stringify(updated));
    } catch (e) {
      console.warn('Could not save profile to localStorage', e);
    }
    if (setToast) setToast('Explorer profile saved on this device.');
  };

  return (
    <section className="panel profile-panel" aria-labelledby="profile-heading">
      <div className="section-heading">
        <div>
          <span className="eyebrow">Explorer Profile</span>
          <h2 id="profile-heading">Your story, your way.</h2>
          <p className="small-copy">Personal explorer card and activity history across India.</p>
        </div>
        <div className="profile-avatar" aria-hidden="true">
          {(currentUser?.name || 'E').trim().charAt(0).toUpperCase()}
        </div>
      </div>

      <nav className="sq-subnav" aria-label="Journal pages" style={{ display: 'flex', gap: '8px', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        <a href="/profile" aria-current="page">Explorer Card</a>
        <a href="/achievements">Milestone Badges ({earnedBadges})</a>
        <a href="/levels">Explorer XP</a>
        <a href="/bookings">My Tickets & Bookings</a>
        <a href="/chat">Party Chat</a>
      </nav>

      <div className="profile-overview">
        <div>
          <span className="eyebrow">EXPLORER IDENTIFIER</span>
          <h3>{currentUser?.name || 'Guest Explorer'}</h3>
          <p>{currentUser?.email || 'Sign in to sync your tickets and passes across devices.'}</p>
          <span className="pill accent">{currentUser?.role || 'guest'} account</span>
        </div>

        <div className="profile-stats">
          <div><strong>{savedQuestIds.length}</strong><span>Saved quests</span></div>
          <div><strong>{questChains.length}</strong><span>Quest chains</span></div>
          <div><strong>{totalReviews}</strong><span>Field notes</span></div>
          <div><strong>{earnedBadges}</strong><span>Badges</span></div>
        </div>
      </div>

      <form className="profile-form" onSubmit={handleSave} style={{ marginTop: '2rem' }}>
        <label>
          <span>Home city</span>
          <input
            maxLength="100"
            value={city}
            onChange={(event) => setCity(event.target.value)}
            placeholder="e.g. Bengaluru, Mumbai, Pune, Delhi NCR"
          />
        </label>

        <label>
          <span>About your adventures</span>
          <textarea
            rows="4"
            maxLength="280"
            value={bio}
            onChange={(event) => setBio(event.target.value)}
            placeholder="What kinds of quests do you seek? (280 characters max)"
          />
        </label>

        <button className="primary-btn" type="submit">
          Save explorer profile
        </button>
      </form>
    </section>
  );
}
