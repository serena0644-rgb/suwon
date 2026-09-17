-- The login function needs only these two fields; anonymous access stays restricted.
grant select (username, email) on public.profiles to service_role;
notify pgrst, 'reload schema';
