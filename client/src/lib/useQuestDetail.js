import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { mergeQuest } from './questDetailStore';

/**
 * Detail for the selected quest. `base` (list data) renders immediately; the richer fetched detail is merged in
 * when it arrives. Switching ids aborts requests for the previous one and never blocks rendering.
 */
export function useQuestDetail(store, base) {
  const id = base ? base.id : null;
  useSyncExternalStore(store.subscribe, store.getVersion);

  useEffect(() => {
    if (id === null) return;
    store.select(id);
    store.abortObsolete(id);
  }, [store, id]);

  const retry = useCallback(() => { if (id !== null) store.retry(id); }, [store, id]);
  if (!base) return { quest: null, loading: false, error: null, retry };
  return {
    quest: mergeQuest(base, store.get(id)),
    loading: store.isLoading(id) && !store.get(id),
    error: store.getError(id),
    retry,
  };
}
