import { useEffect, useState } from 'react';
import { isClientNavigable } from '../lib/routes';

const NAV_EVENT = 'sidequest:navigate';
const snapshot = () => ({ pathname: window.location.pathname, search: window.location.search, hash: window.location.hash });

/** Navigate inside the app without a full page load. Falls back to a normal navigation for anything external. */
export function navigate(to, { replace = false } = {}) {
  if (!isClientNavigable(to, window.location.origin)) { window.location.assign(to); return; }
  const url = new URL(to, window.location.origin);
  const next = `${url.pathname}${url.search}${url.hash}`;
  const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  if (next !== current) window.history[replace ? 'replaceState' : 'pushState']({}, '', next);
  window.dispatchEvent(new Event(NAV_EVENT));
}

export function useLocation() {
  const [location, setLocation] = useState(snapshot);
  useEffect(() => {
    const update = () => setLocation(snapshot());
    window.addEventListener('popstate', update);
    window.addEventListener(NAV_EVENT, update);
    return () => { window.removeEventListener('popstate', update); window.removeEventListener(NAV_EVENT, update); };
  }, []);
  return location;
}

/** Turns ordinary same-site <a href> clicks into client-side navigation. Modified clicks, new tabs, downloads and #anchors keep native behaviour. */
export function useLinkInterception() {
  useEffect(() => {
    const onClick = (event) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = event.target instanceof Element ? event.target.closest('a[href]') : null;
      if (!anchor) return;
      const href = anchor.getAttribute('href');
      if (!href || href.startsWith('#')) return;
      if ((anchor.target && anchor.target !== '_self') || anchor.hasAttribute('download') || anchor.dataset.native !== undefined) return;
      if (!isClientNavigable(href, window.location.origin)) return;
      event.preventDefault();
      navigate(href);
    };
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, []);
}
