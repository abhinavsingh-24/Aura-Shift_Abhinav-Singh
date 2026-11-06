# SIDEQUEST navigation fixes

## Changes
- Main navigation dropdowns are now mutually exclusive: opening Explore, My Activity, Organizer, More, or Discover SIDEQUEST closes the previously open menu.
- Clicking outside the navigation/profile menu or pressing Escape closes open menus.
- Selecting a route closes all menus and returns the page to the top.
- Explore Events, Quest Radar, and For You keep their shared nested section navigation on each of the three pages.
- The signed-in account control is simplified to avatar + first name + chevron. The level badge is no longer crowded into the topbar control; progression remains in the profile dropdown.
- Removed the duplicate standalone Sign out button. Sign out remains as a clearly visible action inside the profile dropdown.
- Profile dropdown has a constrained width/height and scrolls internally on small screens.

## Verification
- Source changes were reviewed.
- `npm run build` could not be run because the client dependency installation is incomplete in this workspace (`vite: not found`). Run `npm ci` in `client/`, then `npm run build` to verify locally.
