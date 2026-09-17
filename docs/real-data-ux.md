# Real-data map and selection flow

The home, parking, map, facility guide and my-page screens start without invented selections. Parking availability, operating hours, fees, route duration and accessibility grades are not inferred.

## Data sources

- Kakao Maps JavaScript SDK with the services library: keyword search and parking category PK6 around browser-provided GPS coordinates (2 km radius). SDK results provide names, coordinates, addresses and phone numbers when present.
- Existing Korea Tourism Organization searchKeyword2, locationBasedList2, detailCommon2 and detailWithTour2 endpoints. Facility details are joined only by the provider's contentId, not by a guessed name match.
- Approved Supabase reports and the existing authenticated report submission flow.
- User-selected places saved locally under the versioned suwon-ddp-real-selections-v1 key. Legacy demo storage is left untouched and never loaded into the real-data UI. Saved lists are browser-local, not account synchronization. Sharing copies place names and actual Kakao links; it does not publish a browser-local detail URL.

## Configuration and limits

Set TOUR_API_SERVICE_KEY on the server. API errors or missing credentials return failure status and no sample results. NEXT_PUBLIC_KAKAO_MAP_APP_KEY can override the existing public JavaScript key. Register the production, preview and localhost origins in the Kakao app's Web platform settings. localhost:3107 and localhost:3108 are currently rejected by the existing key; the production origin is accepted.

Geolocation runs on the user's current-location action and uses no default GPS position after rejection. The initial Suwon map viewport is not a current position or selected destination. Test coordinates used by browser automation simulate GPS permission, not a physical-device GPS measurement.

Directions open the selected destination in Kakao Maps; Kakao handles origin selection/current-location permission. No locally calculated route or guaranteed wheelchair-safe navigation is claimed. Live parking capacity and route geometry/time need an additional verified provider before being displayed. A saved course is an explicit visit list, not a calculated recommendation.

## Validation

Run node --test tests/real-data.test.mjs for storage, deletion, malformed data, missing credentials and upstream error regression coverage. The existing rendered-html.test.mjs targets an obsolete vinext loading skeleton and is not a Next.js application test.

Production build and changed-file ESLint checks passed. Browser verification used the local production build under the authorized production origin via test-only request interception; the live deployment was not changed. Real Kakao parking results, actual TourAPI contentId 129437 facilities, selection, external directions, saving, editing, deletion, reload, denied GPS and empty my-page were checked. Desktop (1440px), tablet (768px) and mobile (390px) screenshots were inspected for horizontal overflow and rendered maps.
