import { useState } from 'react';
import { updateUserPreferences } from '../services/api';

const AVAILABLE_INTERESTS = [
  { id: 'Technology', label: 'Technology', icon: '⌘', desc: 'Summits, Hackathons & AI' },
  { id: 'Music', label: 'Music & Concerts', icon: '♫', desc: 'Indie Gigs, Acoustic & Live' },
  { id: 'College festivals', label: 'College Festivals', icon: '🎓', desc: 'Inter-Collegiate Competitions' },
  { id: 'Workshops', label: 'Workshops & Maker', icon: '✂', desc: 'Pottery, Painting & Labs' },
  { id: 'Gaming', label: 'Gaming & Esports', icon: '◇', desc: 'Tournaments & LAN Battles' },
  { id: 'Sports', label: 'Sports & Outdoors', icon: '↗', desc: 'Runs, Badminton & Turf' },
  { id: 'Art and culture', label: 'Art & Culture', icon: '✳', desc: 'Heritage, Craft & Exhibits' },
  { id: 'Community activities', label: 'Community & Meetups', icon: '◎', desc: 'Book Clubs, Walks & Mixers' },
  { id: 'Startup & entrepreneurship', label: 'Startups & Pitch', icon: '🚀', desc: 'Demo Days & Founder Mixers' },
];

const POPULAR_CITIES = [
  'Bengaluru',
  'Mumbai',
  'Delhi NCR',
  'Pune',
  'Hyderabad',
  'Chennai',
  'Goa',
  'Kolkata',
  'Ahmedabad',
  'Jaipur',
  'Kochi',
  'Chandigarh',
];

const CITY_LOCALITIES = {
  Bengaluru: ['Koramangala', 'Indiranagar', 'HSR Layout', 'Whitefield', 'Jayanagar', 'MG Road'],
  Mumbai: ['Bandra', 'Andheri West', 'Juhu', 'Colaba', 'Lower Parel', 'Powai'],
  'Delhi NCR': ['Hauz Khas', 'Cyber City Gurgaon', 'Connaught Place', 'Saket', 'Noida Sec 18'],
  Pune: ['Koregaon Park', 'Viman Nagar', 'Kothrud', 'Baner', 'Aundh'],
  Hyderabad: ['Jubilee Hills', 'HITEC City', 'Banjara Hills', 'Gachibowli', 'Madhapur'],
  Chennai: ['Adyar', 'T. Nagar', 'Alwarpet', 'Nungambakkam', 'Besant Nagar'],
  Goa: ['Panaji', 'Anjuna', 'Vagator', 'Assagao', 'Calangute'],
  Kolkata: ['Park Street', 'Salt Lake', 'New Town', 'Ballygunge'],
  Ahmedabad: ['Bodakdev', 'Navrangpura', 'Satellite', 'SG Highway'],
  Jaipur: ['C-Scheme', 'Malviya Nagar', 'Vaishali Nagar', 'Raja Park'],
  Kochi: ['Fort Kochi', 'Panampilly Nagar', 'Kakkanad', 'Marine Drive'],
  Chandigarh: ['Sector 17', 'Sector 35', 'Sector 26', 'Mohali'],
};

export default function ExplorerOnboardingModal({ currentUser, onComplete, onDismiss, isMandatory = true }) {
  const [preferredCity, setPreferredCity] = useState(currentUser?.preferredCity || 'Bengaluru');
  const [locality, setLocality] = useState(currentUser?.preferredLocality || currentUser?.locality || '');
  const [interests, setInterests] = useState(
    Array.isArray(currentUser?.interests) && currentUser.interests.length > 0
      ? currentUser.interests
      : []
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [locationStatus, setLocationStatus] = useState('');

  const toggleInterest = (id) => {
    setInterests((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleUseLocation = () => {
    if (!navigator.geolocation) {
      setLocationStatus('Geolocation is not supported by your browser.');
      return;
    }
    setLocationStatus('Locating your position…');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        let detected = 'Bengaluru';
        if (latitude > 25) detected = 'Delhi NCR';
        else if (latitude > 18.5 && longitude < 74) detected = 'Mumbai';
        else if (latitude > 18 && longitude < 74.5) detected = 'Pune';
        else if (latitude > 17 && longitude > 78) detected = 'Hyderabad';
        else if (latitude > 13) detected = 'Chennai';

        setPreferredCity(detected);
        if (!locality) {
          setLocality(CITY_LOCALITIES[detected]?.[0] || '');
        }
        setLocationStatus(`✓ Detected ${detected}! Base updated.`);
      },
      () => {
        setLocationStatus('Permission denied. Please select your base manually.');
      },
      { timeout: 8000 }
    );
  };

  const isCompleteValid = Boolean(preferredCity && locality.trim().length >= 2 && interests.length >= 3);

  const getMissingFeedback = () => {
    const missing = [];
    if (!preferredCity) missing.push('Home City');
    if (!locality.trim() || locality.trim().length < 2) missing.push('Neighborhood / Locality');
    if (interests.length < 3) missing.push(`${3 - interests.length} more passion${3 - interests.length === 1 ? '' : 's'}`);
    return missing.join(' • ');
  };

  const handleCompleteSetup = async (e) => {
    e?.preventDefault();
    if (!isCompleteValid) {
      setError('Please select a Home City, enter your Locality, and choose at least 3 passions.');
      return;
    }

    setSaving(true);
    setError('');

    const payload = {
      interests,
      preferredCity: preferredCity.trim(),
      preferredLocality: locality.trim(),
      locality: locality.trim(),
      onboardingCompleted: true,
      remindersEnabled: true,
      reminderLeadTime: '1hour',
    };

    try {
      try {
        window.localStorage.setItem('sidequest_user_preferences', JSON.stringify(payload));
        window.localStorage.setItem('sidequest_onboarding_completed', 'true');
        window.localStorage.setItem('sidequest-selected-city', payload.preferredCity);
        window.localStorage.setItem('sidequest-selected-locality', payload.locality);
        window.localStorage.setItem('sidequest-interests', JSON.stringify(payload.interests));
      } catch {
        /* storage full */
      }

      const res = await updateUserPreferences(payload);
      onComplete?.(res.user || { ...currentUser, ...payload });
    } catch {
      // In offline or fallback mode, apply stored preferences directly
      onComplete?.({
        ...currentUser,
        ...payload,
      });
    } finally {
      setSaving(false);
    }
  };

  const recommendedNeighborhoods = CITY_LOCALITIES[preferredCity] || CITY_LOCALITIES.Bengaluru;

  return (
    <div
      className={`modal-backdrop modal-overlay onboarding-lock-backdrop ${isMandatory ? 'is-mandatory' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="onboarding-modal-title"
      onClick={() => {
        if (!isMandatory && onDismiss) onDismiss();
      }}
    >
      <div
        className="modal-card onboarding-card onboarding-enhanced-card"
        onClick={(e) => e.stopPropagation()}
      >
        {!isMandatory && onDismiss && (
          <button
            type="button"
            className="close-button"
            aria-label="Close preferences modal"
            onClick={onDismiss}
          >
            ×
          </button>
        )}

        <div className="onboarding-brand-header">
          <div className="onboarding-compass-icon" aria-hidden="true">🧭</div>
          <span className="eyebrow"><span className="eyebrow-dot" /> Mandatory Explorer Setup</span>
          <h2 id="onboarding-modal-title" className="onboarding-heading">
            Set Up Your Explorer Base
          </h2>
          <p className="description">
            Customize your discovery radar across Indian cities. Verified quests, passes, and chains will automatically tune to your home base and personal vibe.
          </p>
        </div>

        <form onSubmit={handleCompleteSetup} className="onboarding-form">
          {/* SECTION 1: HOME CITY & LOCALITY */}
          <div className="onboarding-section-box">
            <div className="onboarding-section-header">
              <span className="onboarding-step-num">01</span>
              <div>
                <strong>Home City & Neighborhood</strong>
                <span className="onboarding-subtext">Pinpoints live quests near your physical base</span>
              </div>
            </div>

            <div className="onboarding-city-grid">
              <label className="onboarding-field">
                <span className="onboarding-field-label">Home City</span>
                <select
                  value={preferredCity}
                  onChange={(e) => {
                    const nextCity = e.target.value;
                    setPreferredCity(nextCity);
                    setLocality('');
                  }}
                  className="onboarding-select"
                >
                  {POPULAR_CITIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </label>

              <label className="onboarding-field">
                <span className="onboarding-field-label">Locality / Neighborhood</span>
                <input
                  type="text"
                  required
                  value={locality}
                  onChange={(e) => setLocality(e.target.value)}
                  placeholder="e.g. Koramangala, Bandra, Hauz Khas"
                  className="onboarding-input"
                />
              </label>
            </div>

            {/* Quick Locality Suggestions */}
            <div className="onboarding-locality-pills">
              <span className="pills-hint">Quick pick for {preferredCity}:</span>
              {recommendedNeighborhoods.slice(0, 5).map((loc) => (
                <button
                  key={loc}
                  type="button"
                  className={`locality-chip ${locality.toLowerCase() === loc.toLowerCase() ? 'is-selected' : ''}`}
                  onClick={() => setLocality(loc)}
                >
                  {loc}
                </button>
              ))}
            </div>

            <div className="onboarding-gps-row">
              <button
                type="button"
                className="ghost-btn btn-sm gps-detect-btn"
                onClick={handleUseLocation}
              >
                📍 Auto-detect GPS Coordinates
              </button>
              {locationStatus && <span className="location-status-badge">{locationStatus}</span>}
            </div>
          </div>

          {/* SECTION 2: INTERESTS (MIN 3 REQUIRED) */}
          <div className="onboarding-section-box">
            <div className="onboarding-section-header">
              <span className="onboarding-step-num">02</span>
              <div>
                <div className="interests-title-row">
                  <strong>Choose At Least 3 Passions</strong>
                  <span className={`interests-counter-pill ${interests.length >= 3 ? 'is-valid' : 'is-pending'}`}>
                    {interests.length >= 3 ? `✓ ${interests.length} Selected` : `⚠️ Pick ${3 - interests.length} more (${interests.length}/3)`}
                  </span>
                </div>
                <span className="onboarding-subtext">Directly drives the "For You" engine & Quest Radar matches</span>
              </div>
            </div>

            <div className="onboarding-interests-picker">
              {AVAILABLE_INTERESTS.map((item) => {
                const active = interests.includes(item.id);
                return (
                  <button
                    key={item.id}
                    type="button"
                    className={`interest-card-chip ${active ? 'is-active' : ''}`}
                    onClick={() => toggleInterest(item.id)}
                  >
                    <span className="interest-chip-icon">{item.icon}</span>
                    <div className="interest-chip-text">
                      <span className="interest-chip-title">{item.label}</span>
                      <span className="interest-chip-desc">{item.desc}</span>
                    </div>
                    <span className="interest-chip-check">{active ? '✓' : '+'}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {error && <div className="message error-message" role="alert">{error}</div>}

          {/* SUBMIT ROW */}
          <div className="onboarding-submit-section">
            <button
              type="submit"
              className="primary-btn btn-lg onboarding-submit-btn"
              disabled={!isCompleteValid || saving}
            >
              {saving ? 'Configuring Adventure Radar…' : 'Complete Setup & Unlock Platform 🚀'}
            </button>
            {!isCompleteValid && (
              <p className="onboarding-validation-hint">
                Required to unlock: {getMissingFeedback()}
              </p>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
