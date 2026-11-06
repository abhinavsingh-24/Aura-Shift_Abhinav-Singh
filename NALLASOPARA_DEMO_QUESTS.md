# Nallasopara demo quests and route planner

## Route optimization

Quest Chains now include a nearest-neighbour route suggestion. It starts from the explorer's GPS coordinates when permission is available; otherwise it uses the first selected stop as the starting point. The suggested order is compared with the current order and the shorter straight-line route is retained. Stops without valid coordinates remain at the end in their original relative order. This is a heuristic, not a guaranteed global optimum or a road-navigation route.

## Nallasopara sample listings

Eight synthetic demo quests are included around Nallasopara, Maharashtra. They use public landmark coordinates for map and distance-filter testing, including Nallasopara Open Ground, Nallasopara Nagar Parishad Park, Zalawad Maidan, Nana Nani Park, and the Nallasopara station area.

**Important:** These are fictional sample activities, not confirmed or scheduled events. They are marked `isSampleData: true`, display a `DEMO QUEST` label, and their descriptions/terms warn users not to travel based on the listing. Replace them with organizer-confirmed event records before production use.

## Seeding

The application preloads these entries into its in-memory event store. On MongoDB startup, missing seed records are inserted idempotently. `npm run db:seed` also includes the Nallasopara demo records.
