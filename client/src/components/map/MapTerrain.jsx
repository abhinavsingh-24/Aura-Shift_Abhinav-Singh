import { memo, useMemo } from 'react';
import { MAP_W, MAP_H, REGIONS, hash32, seeded } from '../../lib/mapLayout';

// Scatter helper: deterministic points inside a region ellipse.
function scatter(region, count, salt, spread = 1.05) {
  const rand = seeded(hash32(`${region.id}:${salt}`));
  return Array.from({ length: count }, () => {
    const a = rand() * Math.PI * 2;
    const r = Math.sqrt(rand()) * spread;
    return { x: region.cx + Math.cos(a) * region.rx * r, y: region.cy + Math.sin(a) * region.ry * r, s: 0.8 + rand() * 0.6 };
  });
}

const WASH = { woods: '#A8B89A', meadow: '#D8CDE8', village: '#E6D6A2', forge: '#B8D0D2', arena: '#C3D4A2', garden: '#CFE0C4' };
const PATHS = [
  'M235 215 C340 250 430 320 600 400', 'M600 400 C700 330 800 260 930 205', 'M600 400 C560 500 640 560 615 655',
  'M615 655 C500 700 330 640 215 610', 'M615 655 C740 700 860 640 975 600',
];

function MapTerrain({ counts }) {
  const art = useMemo(() => {
    const by = Object.fromEntries(REGIONS.map((r) => [r.id, r]));
    const hillRand = seeded(hash32('hills'));
    return {
      hills: Array.from({ length: 12 }, () => ({ x: hillRand() * MAP_W, y: 80 + hillRand() * (MAP_H - 160), rx: 70 + hillRand() * 90, ry: 26 + hillRand() * 30 })),
      woodsTrees: scatter(by.woods, 30, 't', 1.1), gardenTrees: scatter(by.garden, 9, 't', 1.2), strayTrees: scatter(by.arena, 8, 't', 1.5),
      villageHouses: scatter(by.village, 5, 'h', 0.95), lanterns: scatter(by.village, 7, 'l', 1.0), flowers: scatter(by.garden, 26, 'f', 1.0),
      notes: scatter(by.meadow, 6, 'n', 1.0),
    };
  }, []);

  return (
    <svg className="map-terrain" viewBox={`0 0 ${MAP_W} ${MAP_H}`} preserveAspectRatio="none" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="sq-paper" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#F8F2E2" /><stop offset="1" stopColor="#E7DFC9" /></linearGradient>
        <radialGradient id="sq-vignette" cx=".5" cy=".5" r=".75"><stop offset=".6" stopColor="#8A6B3B" stopOpacity="0" /><stop offset="1" stopColor="#8A6B3B" stopOpacity=".28" /></radialGradient>
        <filter id="sq-grain" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" seed="4" /><feColorMatrix values="0 0 0 0 .45  0 0 0 0 .36  0 0 0 0 .2  0 0 0 .5 0" /></filter>
        <symbol id="sq-tree" viewBox="0 0 20 28"><rect x="9" y="20" width="2.4" height="7" fill="#6B4F2A" /><path d="M10 0 L19 20 H1Z" fill="#2F5E46" /><path d="M10 7 L17 22 H3Z" fill="#3E7656" /></symbol>
        <symbol id="sq-house" viewBox="0 0 30 26"><rect x="4" y="11" width="22" height="14" fill="#FFFCF4" stroke="#6F7065" /><path d="M1 12 L15 1 L29 12Z" fill="#B5694A" /><rect x="12" y="16" width="6" height="9" fill="#8B6A3E" /><rect x="6.5" y="14" width="4" height="4" fill="#F1D58A" /></symbol>
        <symbol id="sq-mtn" viewBox="0 0 60 40"><path d="M0 40 L24 4 L36 22 L44 12 L60 40Z" fill="#8F9A85" /><path d="M24 4 L30 14 L24 12 L18 15Z" fill="#fff" opacity=".9" /></symbol>
      </defs>

      <rect width={MAP_W} height={MAP_H} fill="url(#sq-paper)" />
      <rect width={MAP_W} height={MAP_H} filter="url(#sq-grain)" opacity=".22" />

      {/* soft region washes */}
      {REGIONS.map((r) => (
        <g key={r.id}>
          <ellipse cx={r.cx} cy={r.cy} rx={r.rx * 1.12} ry={r.ry * 1.12} fill={WASH[r.id]} opacity=".5" />
          <ellipse cx={r.cx} cy={r.cy} rx={r.rx * 1.12} ry={r.ry * 1.12} fill="none" stroke="#6F7065" strokeOpacity=".32" strokeDasharray="3 8" strokeWidth="2" />
        </g>
      ))}
      {art.hills.map((h, i) => <ellipse key={i} cx={h.x} cy={h.y} rx={h.rx} ry={h.ry} fill="#B9CCA0" opacity=".32" stroke="#7E9A6B" strokeOpacity=".28" />)}

      {/* mountain range, north */}
      {[430, 500, 570, 640, 710, 780].map((x, i) => <use key={x} href="#sq-mtn" x={x} y={18 + (i % 2) * 14} width={84 - (i % 3) * 8} height={56 - (i % 3) * 6} />)}

      {/* river, tributary, lake, bridge */}
      <g fill="none" strokeLinecap="round">
        <path d="M520 -20 C470 110 560 190 500 290 C450 380 380 450 430 560 C470 650 420 740 380 820" stroke="#8FB3B7" strokeWidth="30" />
        <path d="M520 -20 C470 110 560 190 500 290 C450 380 380 450 430 560 C470 650 420 740 380 820" stroke="#C9E0E1" strokeWidth="20" />
        <path d="M720 510 C640 530 560 520 470 560" stroke="#8FB3B7" strokeWidth="16" /><path d="M720 510 C640 530 560 520 470 560" stroke="#C9E0E1" strokeWidth="9" />
      </g>
      <ellipse cx="800" cy="505" rx="82" ry="46" fill="#C9E0E1" stroke="#8FB3B7" strokeWidth="5" />
      <ellipse cx="808" cy="500" rx="22" ry="12" fill="#B9CCA0" stroke="#7E9A6B" /><use href="#sq-tree" x="800" y="480" width="14" height="20" />
      <g transform="translate(468 332) rotate(62)"><rect x="-30" y="-9" width="60" height="18" rx="4" fill="#B08A52" /><path d="M-26 -9v18M-13 -9v18M0 -9v18M13 -9v18M26 -9v18" stroke="#7B5B2E" strokeWidth="2" /></g>

      {/* winding paths */}
      {PATHS.map((d) => <path key={d} d={d} fill="none" stroke="#EADFBE" strokeWidth="11" strokeLinecap="round" />)}
      {PATHS.map((d) => <path key={`${d}-d`} d={d} fill="none" stroke="#8A6B3B" strokeOpacity=".6" strokeWidth="4" strokeLinecap="round" strokeDasharray="2 10" />)}

      {/* landmarks */}
      {art.woodsTrees.map((t, i) => <use key={`w${i}`} href="#sq-tree" x={t.x} y={t.y} width={22 * t.s} height={30 * t.s} />)}
      {art.gardenTrees.map((t, i) => <use key={`g${i}`} href="#sq-tree" x={t.x} y={t.y} width={20 * t.s} height={28 * t.s} />)}
      {art.strayTrees.map((t, i) => <use key={`s${i}`} href="#sq-tree" x={t.x} y={t.y} width={18 * t.s} height={25 * t.s} />)}
      {art.villageHouses.map((h, i) => <use key={`h${i}`} href="#sq-house" x={h.x} y={h.y} width={34 * h.s} height={29 * h.s} />)}
      {art.lanterns.map((l, i) => <g key={`l${i}`}><circle cx={l.x} cy={l.y} r="9" fill="#F1D58A" opacity=".35" /><circle cx={l.x} cy={l.y} r="3" fill="#C6A15B" /></g>)}
      {art.flowers.map((f, i) => <circle key={`f${i}`} cx={f.x} cy={f.y} r="3.2" fill={['#D8A7B8', '#F1D58A', '#fff'][i % 3]} opacity=".9" />)}
      {art.notes.map((n, i) => <text key={`n${i}`} x={n.x} y={n.y} fontSize="20" fill="#6B5A93" opacity=".55">{i % 2 ? '♪' : '♫'}</text>)}
      {/* observatory */}
      <g transform="translate(345 105)"><rect x="-12" y="0" width="24" height="42" fill="#FFFCF4" stroke="#6F7065" /><path d="M-15 0 A15 15 0 0 1 15 0Z" fill="#7C8FB0" /><path d="M0 -14v-9" stroke="#6F7065" strokeWidth="2" /></g>
      {/* forge */}
      <g transform="translate(110 520)"><use href="#sq-house" width="52" height="44" /><rect x="40" y="-14" width="9" height="26" fill="#7B5B2E" /><path d="M44 -18 C34 -34 56 -40 44 -58" fill="none" stroke="#8F9A85" strokeWidth="5" strokeLinecap="round" opacity=".6" /></g>
      {/* arena */}
      <g transform="translate(615 725)"><ellipse rx="64" ry="20" fill="#E6D6A2" stroke="#8A6B3B" strokeWidth="3" /><ellipse rx="42" ry="11" fill="#C3D4A2" stroke="#8A6B3B" strokeOpacity=".6" /><path d="M-64 0v-24l14 6-14 6M64 0v-24l-14 6 14 6" fill="#B5694A" stroke="#7B5B2E" /></g>
      {/* garden fountain */}
      <g transform="translate(1085 520)"><circle r="26" fill="#C9E0E1" stroke="#6F7065" strokeWidth="2" /><circle r="8" fill="#FFFCF4" stroke="#6F7065" /><path d="M0 -8 C-4 -22 4 -22 0 -34" stroke="#8FB3B7" strokeWidth="3" fill="none" strokeLinecap="round" /></g>
      {/* gazebo */}
      <g transform="translate(1065 105)"><path d="M-24 0 L0 -22 L24 0Z" fill="#8A7BB0" /><path d="M-18 0v26M18 0v26M0 0v26" stroke="#6F7065" strokeWidth="3" /><rect x="-22" y="26" width="44" height="5" fill="#B08A52" /></g>

      {/* handwritten region names + live counts (counts reflect the current filters) */}
      {REGIONS.map((r) => (
        <g key={`label-${r.id}`} textAnchor="middle">
          <text className="map-region-name" x={r.cx} y={r.cy - r.ry * 0.9}>{r.name}</text>
          <text className="map-region-count" x={r.cx} y={r.cy - r.ry * 0.9 + 22}>{counts[r.id] ? `${counts[r.id]} quest${counts[r.id] === 1 ? '' : 's'}` : 'no quests here'}</text>
        </g>
      ))}

      {/* compass rose */}
      <g transform="translate(72 418) scale(.85)" opacity=".92">
        <circle r="44" fill="#FFFCF4" fillOpacity=".7" stroke="#C6A15B" strokeWidth="2" />
        <path d="M0 -40 L7 0 L0 40 L-7 0Z" fill="#254E3B" /><path d="M-40 0 L0 -7 L40 0 L0 7Z" fill="#A8B89A" />
        <path d="M0 -40 L7 0 L-7 0Z" fill="#C6A15B" /><text y="-48" fontSize="16" fontWeight="700" fill="#254E3B" textAnchor="middle">N</text>
      </g>

      <rect width={MAP_W} height={MAP_H} fill="url(#sq-vignette)" />
      <rect x="10" y="10" width={MAP_W - 20} height={MAP_H - 20} fill="none" stroke="#C6A15B" strokeWidth="3" />
      <rect x="20" y="20" width={MAP_W - 40} height={MAP_H - 40} fill="none" stroke="#C6A15B" strokeWidth="1" strokeOpacity=".7" />
    </svg>
  );
}

export default memo(MapTerrain);
