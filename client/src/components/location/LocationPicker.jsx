import { useEffect, useState } from 'react';
import LocationSelector, { selectionToIds } from './LocationSelector';
import { locationApi } from '../../services/locationApi';
import './location.css';

const DISCOVERY_KEY = 'sidequest_discovery_location';

export function loadDiscoveryLocation() {
  try { return JSON.parse(localStorage.getItem(DISCOVERY_KEY) || 'null'); } catch { return null; }
}
function storeDiscoveryLocation(sel) {
  try {
    if (!sel) localStorage.removeItem(DISCOVERY_KEY);
    else localStorage.setItem(DISCOVERY_KEY, JSON.stringify(sel));
  } catch { /* storage unavailable */ }
}

export function describeLocation(sel) {
  if (!sel) return '';
  return [sel.locality?.name, sel.city?.name, sel.district?.name, sel.state?.name].filter(Boolean)
    .filter((n, i, a) => a.indexOf(n) === i).slice(0, 3).join(', ');
}

/**
 * Discovery location: temporary, device-only (localStorage), IDs and names only.
 * Home location: saved to the signed-in account via /api/locations/preferences. Coordinates are never stored.
 */
export default function LocationPicker({ currentUser, onApplyDiscovery, onClose }) {
  const [value, setValue] = useState(loadDiscoveryLocation() || {});
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const validate = async () => {
    if (!value.state) { setErrors({ state: 'Please choose a state or union territory.' }); return false; }
    try {
      await locationApi.validate(selectionToIds(value));
      setErrors({});
      return true;
    } catch (err) {
      setErrors({ state: (err.details && err.details[0]) || err.message });
      return false;
    }
  };

  const applyDiscovery = async () => {
    if (!(await validate())) return;
    storeDiscoveryLocation(value);
    onApplyDiscovery(value);
    onClose();
  };

  const saveHome = async () => {
    if (!(await validate())) return;
    setBusy(true);
    try {
      await locationApi.savePreferences(selectionToIds(value));
      setMessage('Saved as your home location.');
    } catch (err) { setMessage(err.message); } finally { setBusy(false); }
  };

  const clearDiscovery = () => { storeDiscoveryLocation(null); onApplyDiscovery(null); onClose(); };

  return (
    <div className="loc-modal-backdrop" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="loc-modal" role="dialog" aria-modal="true" aria-labelledby="loc-modal-title">
        <h2 id="loc-modal-title">Choose your location</h2>
        <p className="loc-sub">Find quests near you. Detection is optional — you can always pick manually.</p>
        <LocationSelector value={value} onChange={(v) => { setValue(v); setErrors({}); setMessage(''); }} errors={errors} />
        <div className="loc-scope">
          <span>🔎 <b>Discovery location</b> stays on this device and can be changed anytime.</span>
          {currentUser && <span>🏠 <b>Home location</b> is saved to your account (no coordinates).</span>}
        </div>
        {message && <p className="loc-notice" role="status">{message}</p>}
        <div className="loc-modal-actions">
          {loadDiscoveryLocation() && <button type="button" className="loc-btn" onClick={clearDiscovery}>Reset discovery</button>}
          <button type="button" className="loc-btn" onClick={onClose}>Cancel</button>
          {currentUser && <button type="button" className="loc-btn" disabled={busy} onClick={saveHome}>Save as home</button>}
          <button type="button" className="loc-btn loc-btn-accent" onClick={applyDiscovery}>Use for discovery</button>
        </div>
      </div>
    </div>
  );
}
