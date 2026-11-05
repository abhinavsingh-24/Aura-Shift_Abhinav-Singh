import { getEventById } from './api';
import { createQuestDetailStore } from '../lib/questDetailStore';

/** App-wide detail cache: one instance, so hover prefetch, map clicks and list clicks all share requests. */
export const questDetailStore = createQuestDetailStore((id, { signal }) => getEventById(id, { signal }));
