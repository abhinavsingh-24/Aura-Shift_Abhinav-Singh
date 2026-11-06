export function PrivacyPage() {
  return (
    <section className="panel legal-panel" aria-labelledby="privacy-heading">
      <div className="section-heading">
        <div>
          <span className="eyebrow">Privacy & Security</span>
          <h2 id="privacy-heading">Your privacy is fundamental.</h2>
          <p className="small-copy">How SIDEQUEST protects your personal data and digital identity.</p>
        </div>
      </div>
      <div className="legal-content" style={{ display: 'grid', gap: '1.25rem', lineHeight: 1.6 }}>
        <article>
          <h3>1. Account & Security</h3>
          <p>We store passwords exclusively as salted scrypt cryptographic hashes. Plaintext passwords are never recorded in logs or persistent memory. Authentication sessions use secure, signed HttpOnly cookies.</p>
        </article>
        <article>
          <h3>2. Location & Hyperlocal Queries</h3>
          <p>Device GPS coordinates are processed on your device to calculate distance offsets and are never sold or shared with third-party advertising brokers.</p>
        </article>
        <article>
          <h3>3. Ticketing & Payments</h3>
          <p>Payment verification utilizes tamper-proof HMAC-SHA256 digital signatures. All bookings are linked directly to your authenticated profile.</p>
        </article>
      </div>
    </section>
  );
}

export function TermsPage() {
  return (
    <section className="panel legal-panel" aria-labelledby="terms-heading">
      <div className="section-heading">
        <div>
          <span className="eyebrow">Terms of Service</span>
          <h2 id="terms-heading">Platform Agreement & Community Standards</h2>
          <p className="small-copy">Guidelines for Explorers and Organizers using SIDEQUEST India.</p>
        </div>
      </div>
      <div className="legal-content" style={{ display: 'grid', gap: '1.25rem', lineHeight: 1.6 }}>
        <article>
          <h3>1. Verified Event Announcements</h3>
          <p>Event organizers represent that they possess the proper authorizations, licenses, and venue permissions for all published quests.</p>
        </article>
        <article>
          <h3>2. Admissions & Check-in</h3>
          <p>Digital tickets issued by SIDEQUEST are valid for admission subject to the venue’s entry rules. QR check-in codes are single-use per pass.</p>
        </article>
        <article>
          <h3>3. Trust & Safety Enforcement</h3>
          <p>Events reported for safety concerns, harassment, or misleading information are subject to immediate administrative review and moderation.</p>
        </article>
      </div>
    </section>
  );
}

export function HelpPage() {
  return (
    <section className="panel legal-panel" aria-labelledby="help-heading">
      <div className="section-heading">
        <div>
          <span className="eyebrow">Help & Support</span>
          <h2 id="help-heading">Frequently Asked Questions</h2>
          <p className="small-copy">Quick guidance for booking tickets, finding quests, and managing events.</p>
        </div>
      </div>
      <div className="legal-content" style={{ display: 'grid', gap: '1.25rem', lineHeight: 1.6 }}>
        <article>
          <h3>How do digital tickets and QR codes work?</h3>
          <p>When you reserve or book a quest pass, a tamper-resistant ticket with an offline-compatible QR code is generated. View your tickets anytime under <a href="/bookings">My Bookings</a>.</p>
        </article>
        <article>
          <h3>How do I publish an event as an organizer?</h3>
          <p>Register an Organizer account, navigate to <a href="/publish">Publish Quest</a> or the <a href="/organizer">Organizer Hub</a>, fill in your venue and ticket tiers, and publish in under 60 seconds.</p>
        </article>
        <article>
          <h3>How do I report a safety concern?</h3>
          <p>Every event page has an inline &quot;Report this event&quot; form. You can also visit the <a href="/safety">Trust & Safety Portal</a> to submit reports directly to our moderation team.</p>
        </article>
      </div>
    </section>
  );
}

export function AboutPage() {
  return (
    <section className="panel about-panel" aria-labelledby="about-heading">
      <div className="section-heading">
        <div>
          <span className="eyebrow">Our Mission & Story</span>
          <h2 id="about-heading">Your City. Your Next Quest.</h2>
          <p className="description">
            India’s premier hyperlocal event discovery and verified ticketing platform.
          </p>
        </div>
      </div>

      <div className="about-pillars-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem', margin: '1.5rem 0 2rem' }}>
        <div className="card" style={{ padding: '1.5rem', background: 'var(--sq-paper, #FFFCF4)', border: '1px solid var(--sq-border, #D9D0BD)', borderRadius: '14px' }}>
          <span style={{ fontSize: '1.75rem', display: 'block', marginBottom: '0.75rem' }}>🧭</span>
          <h3 style={{ margin: '0 0 0.5rem', color: 'var(--sq-deep, #183B2D)', fontFamily: 'var(--sq-display, Georgia, serif)' }}>Hyperlocal Discovery</h3>
          <p style={{ margin: 0, fontSize: '0.9rem', lineHeight: 1.6, color: 'var(--sq-muted, #6F7065)' }}>
            From developer hackathons in Koramangala to indie acoustic showcases in Bandra, uncover verified experiences happening right across Indian metro hubs.
          </p>
        </div>

        <div className="card" style={{ padding: '1.5rem', background: 'var(--sq-paper, #FFFCF4)', border: '1px solid var(--sq-border, #D9D0BD)', borderRadius: '14px' }}>
          <span style={{ fontSize: '1.75rem', display: 'block', marginBottom: '0.75rem' }}>🎟️</span>
          <h3 style={{ margin: '0 0 0.5rem', color: 'var(--sq-deep, #183B2D)', fontFamily: 'var(--sq-display, Georgia, serif)' }}>Verified Passes & QR Codes</h3>
          <p style={{ margin: 0, fontSize: '0.9rem', lineHeight: 1.6, color: 'var(--sq-muted, #6F7065)' }}>
            Instant digital pass issuance with tamper-resistant HMAC QR verification, dynamic pricing tiers, and real-time gate validation for organizers.
          </p>
        </div>

        <div className="card" style={{ padding: '1.5rem', background: 'var(--sq-paper, #FFFCF4)', border: '1px solid var(--sq-border, #D9D0BD)', borderRadius: '14px' }}>
          <span style={{ fontSize: '1.75rem', display: 'block', marginBottom: '0.75rem' }}>🛡️</span>
          <h3 style={{ margin: '0 0 0.5rem', color: 'var(--sq-deep, #183B2D)', fontFamily: 'var(--sq-display, Georgia, serif)' }}>Community & Safety</h3>
          <p style={{ margin: 0, fontSize: '0.9rem', lineHeight: 1.6, color: 'var(--sq-muted, #6F7065)' }}>
            Zero fake listings, genuine community field notes, built-in safety reporting, and transparent recommendations that respect user privacy.
          </p>
        </div>
      </div>
    </section>
  );
}
