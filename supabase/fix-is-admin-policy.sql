drop policy if exists "Approved reports are public" on public.reports;
drop policy if exists "Authenticated users can read reports" on public.reports;

create policy "Approved reports are public"
on public.reports for select
to anon
using (status = 'approved');

create policy "Authenticated users can read reports"
on public.reports for select
to authenticated
using (status = 'approved' or user_id = auth.uid() or private.is_admin());
