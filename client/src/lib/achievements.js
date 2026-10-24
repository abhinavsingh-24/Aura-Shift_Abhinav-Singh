const BADGES = [
  { id: 'first-save', title: 'First Bookmark', icon: '✦', description: 'Save your first quest.', rule: (s) => s.savedCount >= 1, progress: (s) => Math.min(s.savedCount, 1), target: 1 },
  { id: 'curator', title: 'Quest Curator', icon: '▤', description: 'Keep three quests on your saved list.', rule: (s) => s.savedCount >= 3, progress: (s) => Math.min(s.savedCount, 3), target: 3 },
  { id: 'cartographer', title: 'Route Cartographer', icon: '↗', description: 'Create a Quest Chain.', rule: (s) => s.chainCount >= 1, progress: (s) => Math.min(s.chainCount, 1), target: 1 },
  { id: 'planner', title: 'Master Planner', icon: '⌖', description: 'Add three stops across your Quest Chains.', rule: (s) => s.chainStops >= 3, progress: (s) => Math.min(s.chainStops, 3), target: 3 },
  { id: 'wildcard', title: 'Wild Card', icon: '✧', description: 'Reveal your first Mystery Quest.', rule: (s) => s.mysteryRevealCount >= 1, progress: (s) => Math.min(s.mysteryRevealCount, 1), target: 1 },
  { id: 'curious', title: 'Curiosity Engine', icon: '✺', description: 'Reveal five Mystery Quests.', rule: (s) => s.mysteryRevealCount >= 5, progress: (s) => Math.min(s.mysteryRevealCount, 5), target: 5 },
];

export function getAchievements(stats = {}) {
  const safe = {
    savedCount: Math.max(0, Number(stats.savedCount) || 0),
    chainCount: Math.max(0, Number(stats.chainCount) || 0),
    chainStops: Math.max(0, Number(stats.chainStops) || 0),
    mysteryRevealCount: Math.max(0, Number(stats.mysteryRevealCount) || 0),
  };
  return BADGES.map(({ rule, progress, ...badge }) => ({ ...badge, earned: rule(safe), progress: progress(safe), percent: Math.round((progress(safe) / badge.target) * 100) }));
}
