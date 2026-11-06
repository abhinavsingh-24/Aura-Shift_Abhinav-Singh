import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const CITY_COORDS = {
  bengaluru: [12.9716, 77.5946], mumbai: [19.076, 72.8777], 'delhi ncr': [28.6139, 77.209], delhi: [28.6139, 77.209],
  pune: [18.5204, 73.8567], hyderabad: [17.385, 78.4867], chennai: [13.0827, 80.2707], kolkata: [22.5726, 88.3639],
  ahmedabad: [23.0225, 72.5714], jaipur: [26.9124, 75.7873], goa: [15.2993, 74.124], kochi: [9.9312, 76.2673],
  indore: [22.7196, 75.8577], lucknow: [26.8467, 80.9462], chandigarh: [30.7333, 76.7794], guwahati: [26.1445, 91.7362],
};

function coordsFor(event, index) {
  const lat = Number(event.latitude);
  const lng = Number(event.longitude);
  if (Number.isFinite(lat) && Number.isFinite(lng) && (lat !== 0 || lng !== 0)) return [lat, lng];
  const base = CITY_COORDS[String(event.city || '').toLowerCase()];
  if (!base) return null;
  // Spread city-level fallbacks slightly so markers don't stack exactly.
  const angle = index * 2.4;
  return [base[0] + Math.cos(angle) * 0.02 * ((index % 5) + 1), base[1] + Math.sin(angle) * 0.02 * ((index % 5) + 1)];
}

export default function LeafletMap({ events, userCoordinates, onOpen }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const layerRef = useRef(null);

  useEffect(() => {
    const map = L.map(containerRef.current, { scrollWheelZoom: true }).setView([22.5, 79], 5);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18,
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map);
    layerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!map || !layer) return;
    layer.clearLayers();
    const points = [];
    events.forEach((event, index) => {
      const pos = coordsFor(event, index);
      if (!pos) return;
      points.push(pos);
      const marker = L.circleMarker(pos, { radius: 9, color: '#7a3510', weight: 2, fillColor: '#c2571a', fillOpacity: 0.85 });
      const box = document.createElement('div');
      const title = document.createElement('strong');
      title.textContent = event.title;
      const meta = document.createElement('div');
      meta.textContent = `${event.date || ''} · ${[event.venue, event.city].filter(Boolean).join(', ')}`;
      const btn = document.createElement('button');
      btn.textContent = 'View quest';
      btn.style.marginTop = '6px';
      btn.addEventListener('click', () => onOpen && onOpen(event));
      box.append(title, meta, btn);
      marker.bindPopup(box);
      marker.addTo(layer);
    });
    if (userCoordinates && Number.isFinite(userCoordinates.latitude)) {
      const me = [userCoordinates.latitude, userCoordinates.longitude];
      L.circleMarker(me, { radius: 7, color: '#1d4ed8', fillColor: '#3b82f6', fillOpacity: 1 }).bindTooltip('You are here').addTo(layer);
      points.push(me);
    }
    if (points.length) map.fitBounds(L.latLngBounds(points), { padding: [40, 40], maxZoom: 12 });
  }, [events, userCoordinates, onOpen]);

  return <div ref={containerRef} style={{ height: 520, borderRadius: 12, overflow: 'hidden' }} aria-label="Interactive event map" />;
}
