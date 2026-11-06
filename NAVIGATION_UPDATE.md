# SIDEQUEST Navigation Update

## Changes
- Added a persistent five-destination mobile bottom navigation: Discover, Explore, Saved, Tickets, and Profile/Sign in.
- Wired mobile navigation through the existing client-side `navigateTo` function so it does not force full page reloads.
- Added active-route highlighting to grouped desktop navigation menus.
- Desktop navigation groups remain Explore, My Activity, Organizer, and More; guest navigation keeps Explore and Discover SIDEQUEST grouped separately.
- SPA navigation closes the mobile menu and any open desktop dropdowns before scrolling to the new page.
- Added safe-area spacing, accessible focus rings, count badges, and mobile content clearance so the bottom bar does not cover page content.
- Kept Explore Events, Quest Radar, and For You in the existing Explore dropdown and secondary Explore sub-navigation.

## Verification
- Source-level changes were reviewed.
- Automated build/lint could not be completed because `npm ci` timed out in this environment. Run `npm install` (or `npm ci`) and then `npm run build` from the project root to verify locally.
