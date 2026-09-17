# Final integration

Base: origin/main 0c8b918ef4ce490c11939cac5f7698f4b08a3bb2.

- fix/username-login is already an ancestor of main (PR #2); not merged again.
- feature/map-real-data-ux adds real provider search, facility details and explicitly selected storage.
- claude/map-route-navigation adds pedestrian routing, GPS tracking, route planning and guidance.
- Original worktree and all source branches remain unchanged.

Conflicts: components/home-app.tsx, components/my-routes.tsx, lib/tour/api.ts, .env.example.
The integrated home keeps main's username-first account display, real search/parking/facility UI,
and Claude's route planner. Saved course detail uses the same planner and the real-selection store.
Kakao types and SDK loading are shared. Environment examples include both provider keys.
No default demo courses, fabricated accessibility grades, or straight-line fallback routes are restored.
Failed stairs-exclusion requests do not silently retry an unsafe routing option.

Verification: Next production build, TypeScript and full ESLint pass (two existing admin warnings).
13 regression tests cover storage, username authentication, routing errors, coordinates and provider legs.
Browser checks cover real Kakao parking results, real TourAPI facilities, route selection, missing-provider
safe state, saved lists, editing/deletion/reload, GPS permission denial, auth pages and 1440/768/390px layouts.
The local browser test routes production-origin page requests to the local build solely so genuine Kakao
requests use an already registered origin; it does not modify the live site.

Deployment configuration still matters: TMAP_APP_KEY is server-only and required for embedded pedestrian
routes and GPS guidance. Without it, routing returns 503 with no route; external Kakao destination links
remain usable. Preview and localhost origins need Kakao Web platform registration independently.
Browser saved data is not account-synchronized. Real-user successful login was not tested with a password.

Local test worktree uses shared node_modules. Its temporary turbopack.root setting was removed before commit.
