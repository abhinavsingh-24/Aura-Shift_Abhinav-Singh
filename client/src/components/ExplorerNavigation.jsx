import { useEffect, useRef, useState } from 'react';
import BrandLogo from './BrandLogo';
import { GROUPS, navFor } from '../lib/routes';
import './nav.css';

function Disclosure({ id, label, items, activeId, openId, setOpenId, align = 'left', icon, badge }) {
  const open = openId === id;
  const ref = useRef(null);
  const buttonRef = useRef(null);
  const active = items.some((item) => item.id === activeId);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') { setOpenId(''); buttonRef.current?.focus(); } };
    const onDown = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpenId(''); };
    document.addEventListener('keydown', onKey); document.addEventListener('pointerdown', onDown);
    return () => { document.removeEventListener('keydown', onKey); document.removeEventListener('pointerdown', onDown); };
  }, [open, setOpenId]);

  return (
    <div className={`sq-disclosure${open ? ' is-open' : ''}${active ? ' is-active' : ''}`} ref={ref}>
      <button ref={buttonRef} type="button" className="sq-disclosure-btn" aria-expanded={open} aria-haspopup="true" aria-controls={`sq-menu-${id}`} onClick={() => setOpenId(open ? '' : id)}>
        {icon ? <span className="sq-avatar" aria-hidden="true">{icon}</span> : null}
        <span>{label}</span>{badge}
        <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M2 4.5 6 8.5l4-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </button>
      <div id={`sq-menu-${id}`} className={`sq-popover sq-popover-${align}`} hidden={!open}>
        {items}
      </div>
    </div>
  );
}

function MenuLink({ route, activeId }) {
  return (
    <a href={route.path} className="sq-menu-link" aria-current={route.id === activeId ? 'page' : undefined}>
      <strong>{route.label}</strong>
      <small>{route.blurb}</small>
    </a>
  );
}

export default function ExplorerNavigation({ user, activeId, authLoading, savedCount = 0, onSignOut }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openId, setOpenId] = useState('');

  useEffect(() => { setMobileOpen(false); setOpenId(''); }, [activeId]);
  useEffect(() => {
    if (!mobileOpen) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') setMobileOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [mobileOpen]);

  const primary = navFor('primary', user);
  const tools = navFor('adventure', user);
  const publish = navFor('primary-action', user)[0];
  const account = navFor('account', user);
  const accountGroups = ['journal', 'explore', 'organize'].map((group) => ({ group, items: account.filter((r) => r.group === group) })).filter((g) => g.items.length);
  const initial = (user?.name || '?').trim().charAt(0).toUpperCase();
  const firstName = (user?.name || '').split(' ')[0];

  return (
    <header className="sq-topbar">
      <div className="sq-topbar-inner">
        <BrandLogo variant="compact" />
        <button type="button" className="sq-menu-toggle" aria-expanded={mobileOpen} aria-controls="sq-nav-panel" onClick={() => setMobileOpen((v) => !v)}>
          <span className="sq-burger" aria-hidden="true" /><span>{mobileOpen ? 'Close' : 'Menu'}</span>
        </button>
        <nav id="sq-nav-panel" className={`sq-nav${mobileOpen ? ' is-open' : ''}`} aria-label="Main navigation">
          <ul className="sq-nav-primary">
            {primary.map((route) => (
              <li key={route.id}><a href={route.path} className="sq-nav-link" aria-current={route.id === activeId ? 'page' : undefined}>{route.label}</a></li>
            ))}
            <li>
              <Disclosure id="tools" label="Adventure tools" activeId={activeId} openId={openId} setOpenId={setOpenId}
                items={tools.map((route) => <MenuLink key={route.id} route={route} activeId={activeId} />)} />
            </li>
          </ul>

          <div className="sq-nav-end">
            {publish ? <a href={publish.path} className="sq-publish" aria-current={publish.id === activeId ? 'page' : undefined}>{publish.label}</a> : null}
            {authLoading ? <span className="sq-nav-loading" aria-live="polite">Checking account…</span> : user ? (
              <Disclosure id="account" label={firstName || 'Account'} icon={initial} align="right" activeId={activeId} openId={openId} setOpenId={setOpenId}
                badge={savedCount ? <span className="sq-count" aria-label={`${savedCount} saved quests`}>{savedCount}</span> : null}
                items={[
                  <p key="who" className="sq-menu-who"><strong>{user.name}</strong><small>{user.email} · {user.role === 'organizer' ? 'Organizer' : 'Explorer'}</small></p>,
                  ...accountGroups.flatMap(({ group, items }) => [
                    <p key={`h-${group}`} className="sq-menu-heading">{GROUPS[group].label}</p>,
                    ...items.map((route) => <MenuLink key={route.id} route={route} activeId={activeId} />),
                  ]),
                  <button key="out" type="button" className="sq-signout" onClick={onSignOut}>Sign out</button>,
                ]} />
            ) : (
              <>
                <a href="/saved" className="sq-nav-link" aria-current={activeId === 'saved' ? 'page' : undefined}>Saved{savedCount ? <span className="sq-count">{savedCount}</span> : null}</a>
                <a href="/login" className="sq-nav-link">Sign in</a>
                <a href="/register" className="sq-join">Join</a>
              </>
            )}
          </div>
        </nav>
      </div>
    </header>
  );
}
