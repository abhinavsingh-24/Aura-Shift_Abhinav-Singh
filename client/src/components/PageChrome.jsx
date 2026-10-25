import { GROUPS, siblingsOf } from '../lib/routes';
import BrandLogo from './BrandLogo';
import { ROUTES } from '../lib/routes';

const allowed = (route, user) => (!route.role || (user && user.role === route.role)) && (!route.auth || user);

/** Page title block shared by every route: group breadcrumb, h1 (focus target after navigation), purpose line and sibling tabs. */
export function PageHeading({ route, user, title, blurb }) {
  const group = GROUPS[route.group];
  const tabs = siblingsOf(route.group).filter((r) => allowed(r, user));
  return (
    <header className="route-heading sq-heading">
      <p className="sq-crumbs">{group.label}{route.id !== 'quest-detail' && route.label ? <> <span aria-hidden="true">/</span> <span>{route.label}</span></> : null}</p>
      <h1 tabIndex={-1} data-page-heading>{title || route.title}</h1>
      {(blurb ?? route.blurb) ? <p className="description">{blurb ?? route.blurb}</p> : null}
      {tabs.length > 1 && route.id !== 'quest-detail' ? (
        <nav className="sq-subnav" aria-label={`${group.label} pages`}>
          {tabs.map((tab) => <a key={tab.id} href={tab.path} aria-current={tab.id === route.id ? 'page' : undefined}>{tab.label}</a>)}
        </nav>
      ) : null}
    </header>
  );
}

export function NotFound() {
  return (
    <section className="panel sq-notfound" aria-labelledby="nf-title">
      <BrandLogo variant="emblem" href="" />
      <p className="sq-crumbs">Error 404</p>
      <h2 id="nf-title">This part of the map is uncharted.</h2>
      <p className="description">The page you followed does not exist, or it moved. Head back to the map and pick another path.</p>
      <div className="hero-actions">
        <a className="primary-btn" href="/">Back to the Quest Map</a>
        <a className="secondary-btn" href="/quests">Browse the Quest Board</a>
      </div>
    </section>
  );
}

export function SiteFooter({ database, user }) {
  const groups = Object.keys(GROUPS).map((id) => ({ id, items: ROUTES.filter((r) => r.group === id && allowed(r, user)) })).filter((g) => g.items.length);
  return (
    <footer className="site-footer sq-footer">
      <div className="sq-footer-brand">
        <BrandLogo variant="compact" tagline />
        <p>Life is the main quest. Experiences are the sidequests.</p>
        <p className="helper-text">
          {database === 'memory' ? 'Demo mode: accounts and quests are held in server memory and reset when the server restarts. ' : ''}
          Event details may include clearly labelled sample data. Saved quests, notes and chat are stored in this browser for your account.
        </p>
      </div>
      <nav className="sq-footer-nav" aria-label="Footer">
        {groups.map((g) => (
          <div key={g.id}>
            <h2>{GROUPS[g.id].label}</h2>
            <ul>{g.items.map((r) => <li key={r.id}><a href={r.path}>{r.label}</a></li>)}</ul>
          </div>
        ))}
      </nav>
    </footer>
  );
}
