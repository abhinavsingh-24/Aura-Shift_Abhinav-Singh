import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Glass-style combobox that fetches options from the backend (never the whole dataset).
 * `fetchOptions(query)` must resolve to an array of { id, name, hint? }.
 */
export default function SearchableSelect({
  label, value, onChange, fetchOptions, disabled = false, placeholder = 'Select…',
  emptyText = 'No matches found', error = '', required = false, deps = '',
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const rootRef = useRef(null);
  const requestId = useRef(0);

  const load = useCallback((text) => {
    const id = ++requestId.current;
    setLoading(true);
    setLoadError('');
    fetchOptions(text)
      .then((list) => { if (id === requestId.current) setOptions(list); })
      .catch((err) => { if (id === requestId.current) { setOptions([]); setLoadError(err.message); } })
      .finally(() => { if (id === requestId.current) setLoading(false); });
  }, [fetchOptions]);

  useEffect(() => {
    if (!open) return undefined;
    const timer = setTimeout(() => load(query), query ? 250 : 0);
    return () => clearTimeout(timer);
    // deps lets the parent invalidate options when its parent selection changes
  }, [open, query, load, deps]);

  useEffect(() => {
    if (!open) return undefined;
    const close = (event) => { if (rootRef.current && !rootRef.current.contains(event.target)) setOpen(false); };
    document.addEventListener('mousedown', close);
    document.addEventListener('touchstart', close);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('touchstart', close); };
  }, [open]);

  const pick = (option) => { onChange(option); setOpen(false); setQuery(''); };

  return (
    <div className={`loc-field ${disabled ? 'is-disabled' : ''} ${error ? 'has-error' : ''}`} ref={rootRef}>
      <span className="loc-label">{label}{required ? <em aria-hidden="true"> *</em> : null}</span>
      <button
        type="button"
        className="loc-trigger"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`${label}: ${value ? value.name : 'not selected'}`}
        onClick={() => setOpen((o) => !o)}
      >
        <span className={value ? 'loc-value' : 'loc-placeholder'}>{value ? value.name : placeholder}</span>
        {value && !disabled ? (
          <span
            role="button"
            tabIndex={0}
            className="loc-clear"
            aria-label={`Clear ${label}`}
            onClick={(e) => { e.stopPropagation(); onChange(null); }}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); onChange(null); } }}
          >✕</span>
        ) : <span className="loc-caret" aria-hidden="true">▾</span>}
      </button>
      {open && (
        <div className="loc-panel" role="listbox" aria-label={`${label} options`}>
          <input
            className="loc-search"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Search ${label.toLowerCase()}…`}
            aria-label={`Search ${label}`}
          />
          <div className="loc-options">
            {loading && <div className="loc-status"><span className="loc-spinner" aria-hidden="true" /> Loading…</div>}
            {!loading && loadError && <div className="loc-status loc-status-error">{loadError}</div>}
            {!loading && !loadError && options.length === 0 && <div className="loc-status">{emptyText}</div>}
            {!loading && options.map((option) => (
              <button
                type="button"
                role="option"
                aria-selected={Boolean(value && value.id === option.id)}
                key={option.id}
                className={`loc-option ${value && value.id === option.id ? 'is-selected' : ''}`}
                onClick={() => pick(option)}
              >
                <span>{option.name}</span>
                {option.hint ? <small>{option.hint}</small> : null}
              </button>
            ))}
          </div>
        </div>
      )}
      {error ? <span className="loc-error" role="alert">{error}</span> : null}
    </div>
  );
}
