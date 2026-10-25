import { useState } from 'react';
import { updateUserPreferences } from '../services/api';

const AVAILABLE_INTERESTS = [
  { id: 'Technology', label: 'Technology', icon: '⌘' },
  { id: 'Music', label: 'Music & Concerts', icon: '♫' },
  { id: 'College festivals', label: 'College Festivals', icon: '🎓' },
  { id: 'Workshops', label: 'Workshops & Maker', icon: '✂' },
  { id: 'Gaming', label: 'Gaming & Esports', icon: '◇' },
  { id: 'Sports', label: 'Sports & Outdoors', icon: '↗' },
  { id: 'Art and culture', label: 'Art & Culture', icon: '✳' },
  { id: 'Community activities', label: 'Community & Meetups', icon: '◎' },
  { id: 'Startup & entrepreneurship', label: 'Startups & Pitch', icon: '🚀' },
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
  'Indore',
  'Lucknow',
  'Guwahati',
];

export default function ExplorerOnboardingModal({ currentUser, onComplete, onDismiss }) {
  const [step, setStep] = useState(1);
  const [interests, setInterests] = useState(currentUser?.interests?.length ? currentUser.interests : ['Technology', 'Music']);
  const [preferredCity, setPreferredCity] = useState(currentUser?.preferredCity || 'Bengaluru');
  const [remindersEnabled, setRemindersEnabled] = useState(true);
  const [reminderLeadTime, setReminderLeadTime] = useState('1hour');
  const [saving, setSaving] = useState(false);
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
        // Simple heuristic approximation to nearest metro hub
        if (latitude > 25) setPreferredCity('Delhi NCR');
        else if (latitude > 18.5 && longitude < 74) setPreferredCity('Mumbai');
        else if (latitude > 18 && longitude < 74.5) setPreferredCity('Pune');
        else if (latitude > 17 && longitude > 78) setPreferredCity('Hyderabad');
        else if (latitude > 13) setPreferredCity('Chennai');
        else setPreferredCity('Bengaluru');
        setLocationStatus('Location detected! Updated your home city.');
      },
      () => {
        setLocationStatus('Permission denied. Please select your city manually below.');
      },
      { timeout: 8000 }
    );
  };

  const handleFinish = async (skip = false) => {
    setSaving(true);
    try {
      const payload = {
        interests: skip ? (currentUser?.interests || ['Technology']) : interests,
        preferredCity: skip ? (currentUser?.preferredCity || 'Bengaluru') : preferredCity,
        remindersEnabled: skip ? true : remindersEnabled,
        reminderLeadTime,
        onboardingCompleted: true,
      };
      const res = await updateUserPreferences(payload);
      onComplete?.(res.user || { ...currentUser, ...payload });
    } catch {
      onComplete?.({
        ...currentUser,
        interests,
        preferredCity,
        remindersEnabled,
        reminderLeadTime,
        onboardingCompleted: true,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="onboarding-title">
      <div className="modal-card onboarding-card">
        {onDismiss && (
          <button
            type="button"
            className="close-button"
            aria-label="Close preferences"
            onClick={onDismiss}
          >
            ×
          </button>
        )}
        {/* Step Progress Bar */}
        <div className="onboarding-progress">
          {[1, 2, 3, 4].map((s) => (
            <div
              key={s}
              className={`progress-step ${s === step ? 'active' : s < step ? 'done' : ''}`}
            >
              <span>{s < step ? '✓' : s}</span>
            </div>
          ))}
        </div>

        {/* STEP 1: Interests */}
        {step === 1 && (
          <div className="onboarding-step-view">
            <span className="eyebrow"><span className="eyebrow-dot" /> Step 1 of 4: Preferences</span>
            <h2 id="onboarding-title">What do you love exploring?</h2>
            <p className="description">
              Select your favorite categories so SIDEQUEST can rank tech summits, concerts, hackathons, and festivals that fit your vibe.
            </p>
            <div className="onboarding-interest-grid">
              {AVAILABLE_INTERESTS.map((item) => {
                const active = interests.includes(item.id);
                return (
                  <button
                    key={item.id}
                    type="button"
                    className={`interest-picker-chip ${active ? 'is-selected' : ''}`}
                    onClick={() => toggleInterest(item.id)}
                  >
                    <span className="chip-icon">{item.icon}</span>
                    <span className="chip-label">{item.label}</span>
                    {active && <span className="chip-check">✓</span>}
                  </button>
                );
              })}
            </div>
            <div className="onboarding-actions">
              <button
                type="button"
                className="primary-btn"
                onClick={() => setStep(2)}
                disabled={interests.length === 0}
              >
                Continue to Location →
              </button>
              <button type="button" className="ghost-btn" onClick={() => handleFinish(true)}>
                Skip for now
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: Location */}
        {step === 2 && (
          <div className="onboarding-step-view">
            <span className="eyebrow"><span className="eyebrow-dot" /> Step 2 of 4: City Base</span>
            <h2 id="onboarding-title">Where is your adventure base?</h2>
            <p className="description">
              Choose your primary city. We never require precise GPS coordinates to explore SIDEQUEST.
            </p>

            <div className="onboarding-location-controls">
              <button
                type="button"
                className="secondary-btn btn-location-detect"
                onClick={handleUseLocation}
              >
                📍 Use my current location
              </button>
              {locationStatus && <p className="helper-text">{locationStatus}</p>}

              <label className="city-select-label">
                <span>Or select an Indian city:</span>
                <select
                  value={preferredCity}
                  onChange={(e) => setPreferredCity(e.target.value)}
                  className="city-select-input"
                >
                  {POPULAR_CITIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </label>
            </div>

            <div className="onboarding-actions">
              <button type="button" className="ghost-btn" onClick={() => setStep(1)}>
                ← Back
              </button>
              <button type="button" className="primary-btn" onClick={() => setStep(3)}>
                Continue to Reminders →
              </button>
              <button type="button" className="ghost-btn" onClick={() => handleFinish(true)}>
                Skip
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: Notifications & Reminders */}
        {step === 3 && (
          <div className="onboarding-step-view">
            <span className="eyebrow"><span className="eyebrow-dot" /> Step 3 of 4: Reminders</span>
            <h2 id="onboarding-title">Never miss an upcoming quest</h2>
            <p className="description">
              Configure gentle alerts for bookmarked events and confirmed tickets.
            </p>

            <div className="reminder-settings-box">
              <label className="toggle-row">
                <input
                  type="checkbox"
                  checked={remindersEnabled}
                  onChange={(e) => setRemindersEnabled(e.target.checked)}
                />
                <span className="toggle-text">
                  <strong>Enable in-app quest reminders</strong>
                  <small>Receive alerts on your dashboard when bookmarked quests approach.</small>
                </span>
              </label>

              {remindersEnabled && (
                <label className="lead-time-select">
                  <span>Remind me:</span>
                  <select
                    value={reminderLeadTime}
                    onChange={(e) => setReminderLeadTime(e.target.value)}
                  >
                    <option value="15min">15 minutes before</option>
                    <option value="30min">30 minutes before</option>
                    <option value="1hour">1 hour before</option>
                    <option value="1day">1 day before</option>
                  </select>
                </label>
              )}
            </div>

            <div className="onboarding-actions">
              <button type="button" className="ghost-btn" onClick={() => setStep(2)}>
                ← Back
              </button>
              <button type="button" className="primary-btn" onClick={() => setStep(4)}>
                Review & Confirm →
              </button>
              <button type="button" className="ghost-btn" onClick={() => handleFinish(true)}>
                Skip
              </button>
            </div>
          </div>
        )}

        {/* STEP 4: Completion */}
        {step === 4 && (
          <div className="onboarding-step-view text-center">
            <span className="eyebrow"><span className="eyebrow-dot" /> Complete</span>
            <div className="celebration-emblem" aria-hidden="true">🎉</div>
            <h2 id="onboarding-title">You're all set to explore!</h2>
            <p className="description">
              Your profile is personalized for <strong>{preferredCity}</strong> with interests in{' '}
              <strong>{interests.join(', ')}</strong>.
            </p>
            <div className="onboarding-summary-badge">
              <span>🧭 Home: {preferredCity}</span>
              <span>🏷️ {interests.length} Categories</span>
              <span>🔔 Alerts: {remindersEnabled ? reminderLeadTime : 'Off'}</span>
            </div>

            <div className="onboarding-actions centered">
              <button
                type="button"
                className="primary-btn btn-lg"
                onClick={() => handleFinish(false)}
                disabled={saving}
              >
                {saving ? 'Saving preferences…' : 'Discover My Events 🚀'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
