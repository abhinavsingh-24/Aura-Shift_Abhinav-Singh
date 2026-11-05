import { REGIONS } from '../../lib/mapLayout';

/** Shared by map and list. The decorative regions are category groupings, not geography. */
export default function RegionFilter({ value, onChange, total, counts }) {
  return (
    <div className="map-region-filter" role="group" aria-label="Filter by map region (themed category groups, not real places)">
      <button type="button" className={value === 'all' ? 'active' : ''} aria-pressed={value === 'all'} onClick={() => onChange('all')}>Whole map <span>{total}</span></button>
      {REGIONS.map((region) => (
        <button key={region.id} type="button" className={value === region.id ? 'active' : ''} aria-pressed={value === region.id} onClick={() => onChange(region.id)}>
          <span className="region-filter-name">{region.name}</span><span>{counts[region.id] || 0}</span>
        </button>
      ))}
    </div>
  );
}
