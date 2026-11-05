import BrandLogo from './BrandLogo';

export default function Footer({ onCityClick, onCategoryClick }) {
  return (
    <footer className="sq-footer">
      <div className="footer-top-grid">
        <div className="footer-brand-col">
          <BrandLogo variant="compact" />
          <p className="footer-tagline">
            India’s premier hyperlocal event discovery and verified ticketing platform. Uncover technology conferences, collegiate festivals, live concerts, and creative workshops across the nation.
          </p>
          <div className="footer-india-badge">
            <span>🇮🇳</span>
            <span>Covering 15+ Cities Across India</span>
          </div>
        </div>

        <div className="footer-links-col">
          <h4>Explore Top Cities</h4>
          <ul>
            <li><button type="button" className="footer-link-btn" onClick={() => onCityClick?.('Bengaluru')}>Bengaluru</button></li>
            <li><button type="button" className="footer-link-btn" onClick={() => onCityClick?.('Mumbai')}>Mumbai</button></li>
            <li><button type="button" className="footer-link-btn" onClick={() => onCityClick?.('Delhi NCR')}>Delhi NCR</button></li>
            <li><button type="button" className="footer-link-btn" onClick={() => onCityClick?.('Pune')}>Pune</button></li>
            <li><button type="button" className="footer-link-btn" onClick={() => onCityClick?.('Hyderabad')}>Hyderabad</button></li>
            <li><button type="button" className="footer-link-btn" onClick={() => onCityClick?.('Chennai')}>Chennai</button></li>
            <li><button type="button" className="footer-link-btn" onClick={() => onCityClick?.('Goa')}>Goa</button></li>
            <li><button type="button" className="footer-link-btn" onClick={() => onCityClick?.('Kolkata')}>Kolkata</button></li>
          </ul>
        </div>

        <div className="footer-links-col">
          <h4>Popular Categories</h4>
          <ul>
            <li><button type="button" className="footer-link-btn" onClick={() => onCategoryClick?.('Technology')}>Technology & Hackathons</button></li>
            <li><button type="button" className="footer-link-btn" onClick={() => onCategoryClick?.('College festivals')}>College Festivals</button></li>
            <li><button type="button" className="footer-link-btn" onClick={() => onCategoryClick?.('Music concerts')}>Concerts & Live Music</button></li>
            <li><button type="button" className="footer-link-btn" onClick={() => onCategoryClick?.('Startup & entrepreneurship')}>Startups & Pitch Days</button></li>
            <li><button type="button" className="footer-link-btn" onClick={() => onCategoryClick?.('Art, photography and creative workshops')}>Art & Creative Workshops</button></li>
            <li><button type="button" className="footer-link-btn" onClick={() => onCategoryClick?.('Sports, marathons and outdoor activities')}>Marathons & Sports</button></li>
          </ul>
        </div>

        <div className="footer-links-col">
          <h4>For Organisers & Hosts</h4>
          <ul>
            <li><a href="/organizer">Host an Event</a></li>
            <li><a href="/organizer">Organiser Command Centre</a></li>
            <li><a href="/organizer">QR Check-In Scanner</a></li>
            <li><a href="/safety">Trust & Safety Guidelines</a></li>
            <li><a href="/admin">Platform Admin Portal</a></li>
          </ul>
        </div>
      </div>

      <div className="footer-bottom-bar">
        <p className="copyright-text">
          &copy; 2026 SIDEQUEST India Technologies. All real event listings are attributed to their official organizers.
        </p>
        <div className="footer-legal-links">
          <a href="/safety">Trust & Safety</a>
          <a href="/privacy">Privacy Policy</a>
          <a href="/terms">Terms of Service</a>
          <a href="/help">Help & Contact</a>
        </div>
      </div>
    </footer>
  );
}
