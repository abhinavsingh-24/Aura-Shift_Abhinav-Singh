export function getExplorerLevel({ saved = 0, reviews = 0, chainStops = 0, reveals = 0, chatMessages = 0 } = {}) {
  const xp = Math.max(0, saved) * 10 + Math.max(0, reviews) * 25 + Math.max(0, chainStops) * 15 + Math.max(0, reveals) * 5 + Math.max(0, chatMessages) * 2;
  const level = Math.floor(xp / 100) + 1;
  return { xp, level, title: level >= 10 ? 'Legendary Explorer' : level >= 7 ? 'Trailblazer' : level >= 4 ? 'Pathfinder' : level >= 2 ? 'Wayfinder' : 'Rookie Explorer', currentLevelXp: xp % 100, nextLevelXp: 100, progress: xp % 100 };
}
