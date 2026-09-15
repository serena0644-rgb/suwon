-- 회원가입한 계정을 첫 관리자로 만들 때 사용하세요.
-- 관리자 권한은 회원가입 화면에서 받지 않고, DB에서 직접 지정합니다.

insert into public.profiles (id, email, display_name, role)
select
  id,
  email,
  coalesce(raw_user_meta_data ->> 'display_name', ''),
  'admin'
from auth.users
where lower(email) = lower('gosu18005@gmail.com')
on conflict (id) do update
set role = 'admin';
