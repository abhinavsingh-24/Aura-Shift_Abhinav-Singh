import { useCallback, useState } from 'react';
import SearchableSelect from './SearchableSelect';
import { locationApi } from '../../services/locationApi';
import './location.css';

const toOption = (record, hint) => ({ ...record, hint: hint || undefined });
const EMPTY = { state: null, district: null, city: null, locality: null, pincode: '' };

export function selectionToIds(sel) {
  return {
    stateId: sel.state?.id, districtId: sel.district?.id, cityId: sel.city?.id,
    localityId: sel.locality?.id, pincode: sel.pincode || undefined,
  };
}

/**
 * Cascading India location picker: Country → State → District → City → Locality → PIN.
 * Every level is fetched on demand from /api/locations. GPS detection is opt-in and manual entry always works.
 */
export default function LocationSelector({ value = EMPTY, onChange, requiredLevel = 'state', showDetect = true, errors = {} }) {
  const [detecting, setDetecting] = useState(false);
  const [notice, setNotice] = useState('');
  const [pinError, setPinError] = useState('');
  const sel = { ...EMPTY, ...value };
  const levels = ['state', 'district', 'city', 'locality'];
  const required = (level) => levels.indexOf(level) <= levels.indexOf(requiredLevel);

  const fetchStates = useCallback((q) => locationApi.states({ q }).then((r) => r.data.map((s) => toOption(s, s.kind === 'union_territory' ? 'Union Territory' : ''))), []);
  const fetchDistricts = useCallback((q) => (sel.state ? locationApi.districts(sel.state.id, { q }).then((r) => r.data.map((d) => toOption(d))) : Promise.resolve([])), [sel.state]);
  const fetchCities = useCallback((q) => (sel.district ? locationApi.cities(sel.district.id, { q }).then((r) => r.data.map((c) => toOption(c))) : Promise.resolve([])), [sel.district]);
  const fetchLocalities = useCallback((q) => {
    if (sel.city) return locationApi.localities(sel.city.id, { q }).then((r) => r.data.map((l) => toOption(l, l.pincode)));
    if (sel.district) return locationApi.districtLocalities(sel.district.id, { q }).then((r) => r.data.map((l) => toOption(l, l.pincode)));
    return Promise.resolve([]);
  }, [sel.city, sel.district]);

  const emit = (next) => { setNotice(''); setPinError(''); onChange({ ...EMPTY, ...next }); };

  const detect = () => {
    setNotice('');
    if (!('geolocation' in navigator)) { setNotice('Your browser does not support location detection. Please choose manually.'); return; }
    setDetecting(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const found = await locationApi.detect(pos.coords.latitude, pos.coords.longitude);
          emit({ state: found.state, district: found.district, city: found.city || null, locality: found.locality || null, pincode: found.pincode || '' });
          setNotice('Approximate location detected. Your exact coordinates were not stored.');
        } catch (err) {
          setNotice(err.status === 404 ? 'We could not match your position to a place in India. Please choose manually.' : err.message);
        } finally { setDetecting(false); }
      },
      (err) => {
        setDetecting(false);
        setNotice(err.code === 1
          ? 'Location permission was denied. No problem — choose your location manually below.'
          : 'We could not determine your location. Please choose it manually.');
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 },
    );
  };

  const onPin = async (text) => {
    const pin = text.replace(/\D/g, '').slice(0, 6);
    setNotice('');
    onChange({ ...sel, pincode: pin });
    setPinError('');
    if (pin.length !== 6) return;
    try {
      const found = await locationApi.pincode(pin);
      if (found.state && found.district) {
        onChange({ ...EMPTY, state: found.state, district: found.district, pincode: pin });
      }
    } catch (err) {
      setPinError(err.status === 404 ? 'This PIN code is not in our master data.' : err.message);
    }
  };

  const hasAny = sel.state || sel.district || sel.city || sel.locality || sel.pincode;

  return (
    <div className="loc-selector">
      <div className="loc-toolbar">
        {showDetect && (
          <button type="button" className="loc-btn loc-btn-accent" onClick={detect} disabled={detecting}>
            {detecting ? <><span className="loc-spinner" aria-hidden="true" /> Detecting…</> : '📍 Use my current location'}
          </button>
        )}
        {hasAny && <button type="button" className="loc-btn" onClick={() => emit({})}>Clear selection</button>}
      </div>
      {notice && <p className="loc-notice" role="status">{notice}</p>}

      <div className="loc-grid">
        <div className="loc-field is-fixed"><span className="loc-label">Country</span><div className="loc-trigger"><span className="loc-value">🇮🇳 India</span></div></div>
        <SearchableSelect label="State / UT" required={required('state')} value={sel.state} fetchOptions={fetchStates} placeholder="Search state or UT" error={errors.state}
          onChange={(o) => emit({ state: o })} />
        <SearchableSelect label="District" required={required('district')} value={sel.district} fetchOptions={fetchDistricts} disabled={!sel.state} deps={sel.state?.id}
          placeholder={sel.state ? 'Search district' : 'Select a state first'} error={errors.district} emptyText="No districts found"
          onChange={(o) => emit({ state: sel.state, district: o })} />
        <SearchableSelect label="City / Town" required={required('city')} value={sel.city} fetchOptions={fetchCities} disabled={!sel.district} deps={sel.district?.id}
          placeholder={sel.district ? 'Search city' : 'Select a district first'} error={errors.city}
          emptyText="No city records for this district yet — pick a locality instead"
          onChange={(o) => emit({ state: sel.state, district: sel.district, city: o })} />
        <SearchableSelect label="Locality / Area" required={required('locality')} value={sel.locality} fetchOptions={fetchLocalities} disabled={!sel.district} deps={`${sel.district?.id}|${sel.city?.id}`}
          placeholder={sel.district ? 'Search locality' : 'Select a district first'} error={errors.locality} emptyText="No localities found"
          onChange={(o) => emit({ state: sel.state, district: sel.district, city: sel.city, locality: o, pincode: o ? o.pincode : '' })} />
        <div className={`loc-field ${pinError ? 'has-error' : ''}`}>
          <label className="loc-label" htmlFor="loc-pin">PIN code</label>
          <input id="loc-pin" className="loc-trigger loc-input" inputMode="numeric" autoComplete="postal-code" maxLength={6} value={sel.pincode || ''} placeholder="6-digit PIN" onChange={(e) => onPin(e.target.value)} />
          {pinError && <span className="loc-error" role="alert">{pinError}</span>}
        </div>
      </div>
    </div>
  );
}
