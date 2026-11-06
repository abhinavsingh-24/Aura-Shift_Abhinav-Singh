export default function MobileBottomNav({ currentPage, currentUser, savedCount = 0, onNavigate }) {
  const items = [
    { href: '/', key: 'discover', pages: ['home'], icon: '✦', label: 'Discover' },
    { href: '/quests', key: 'quests', pages: ['quests', 'radar', 'recommended', 'nearby', 'mystery'], icon: '⌕', label: 'Explore' },
    { href: '/saved', key: 'saved', pages: ['saved', 'chains', 'reminders'], icon: '☆', label: 'Saved', count: savedCount },
    { href: '/bookings', key: 'tickets', pages: ['bookings', 'calendar'], icon: '▤', label: 'Tickets' },
    { href: currentUser ? '/profile' : '/login', key: 'profile', pages: ['profile', 'levels', 'achievements', 'onboarding', 'login', 'register'], icon: '◉', label: currentUser ? 'Profile' : 'Sign in' },
  ];

  const handleClick = (event, href) => {
    if (!onNavigate || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return;
    event.preventDefault();
    onNavigate(href);
  };

  return (
    <nav className="mobile-bottom-nav" aria-label="Primary mobile navigation">
      {items.map((item) => {
        const active = item.pages.includes(currentPage);
        return (
          <a
            key={item.key}
            href={item.href}
            className={`mobile-nav-item ${active ? 'is-active' : ''}`}
            aria-current={active ? 'page' : undefined}
            onClick={(event) => handleClick(event, item.href)}
          >
            <span className="mobile-nav-icon-wrap">
              <span className="nav-icon" aria-hidden="true">{item.icon}</span>
              {item.count > 0 && <span className="bottom-badge">{item.count > 99 ? '99+' : item.count}</span>}
            </span>
            <span className="nav-label">{item.label}</span>
          </a>
        );
      })}
    </nav>
  );
}
