# Username login repair

The live database lacked profiles.username while the repository's signup form already stored the requested ID in auth.users.raw_user_meta_data.username. The migrations add a unique nullable username, backfill missing IDs from that exact metadata using auth user IDs, and update the signup trigger. Email prefixes are never generated as usernames, and existing roles/IDs are preserved. A rolled-back auth.users insert verified the trigger without leaving a test account behind.

The old login form also called a nonexistent /api/auth/lookup route. The actual /api/lookup handler used the anonymous session to read profiles, which existing RLS correctly disallowed. The new login form invokes the username-login Edge Function, which resolves the email server-side, verifies the password through Supabase Auth, and returns access/refresh tokens only after authentication. The client then sets its session and keeps the existing role-based redirect. Profiles are not made publicly readable and emails are not returned from failed logins.

The Edge Function uses Supabase-managed secret/publishable environment variables, with legacy fallback. Its public gateway has verify_jwt=false because login precedes a session; the handler performs username/password authentication before issuing tokens. The service_role receives SELECT only on username and email for lookup. No secret is committed or delivered to the browser.

The two migrations and Edge Function have been applied to project gxsealogcrllzswzwzhq. Frontend changes require merging/deploying the fix/username-login PR; deploying the function alone does not fix the old frontend URL. The separate map UX PR is unchanged.

Checks: migration verification, exact metadata backfill (one existing account), trigger rollback test, unchanged account count/RLS, live invalid-input/nonexistent-user/wrong-password responses, changed-file lint, application production build, and node --test tests/username-login.test.mjs. Successful authentication with the real user's password cannot be tested without that credential; it is not requested or reset. Tests of successful token issuance use isolated mocks, not user records.
