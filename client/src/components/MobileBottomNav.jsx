export default function MobileBottomNav({ currentPage, currentUser, savedCount = 0 }) {
  return (
    <nav className="mobile-bottom-nav" aria-label="Mobile Navigation">
      <a
        href="/"
        className={`mobile-nav-item ${currentPage === 'home' ? 'is-active' : ''}`}
      >
        <span className="nav-icon">✨</span>
        <span className="nav-label">Discover</span>
      </a>

      <a
        href="/quests"
        className={`mobile-nav-item ${currentPage === 'quests' ? 'is-active' : ''}`}
      >
        <span className="nav-icon">🔍</span>
        <span className="nav-label">Quests</span>
      </a>

      <a
        href="/saved"
        className={`mobile-nav-item ${currentPage === 'saved' ? 'is-active' : ''}`}
      >
        <span className="nav-icon">🔖</span>
        <span className="nav-label">Saved</span>
        {savedCount > 0 && <span className="bottom-badge">{savedCount}</span>}
      </a>

      <a
        href="/bookings"
        className={`mobile-nav-item ${currentPage === 'bookings' ? 'is-active' : ''}`}
      >
        <span className="nav-icon">🎟️</span>
        <span className="nav-label">Tickets</span>
      </a>

      <a
        href={currentUser?.role === 'organizer' || currentUser?.role === 'admin' ? '/organizer' : '/profile'}
        className={`mobile-nav-item ${currentPage === 'organizer' || currentPage === 'profile' ? 'is-active' : ''}`}
      >
        <span className="nav-icon">👤</span>
        <span className="nav-label">{currentUser?.role === 'organizer' ? 'Hub' : 'Profile'}</span>
      </a>
    </nav>
  );
}

