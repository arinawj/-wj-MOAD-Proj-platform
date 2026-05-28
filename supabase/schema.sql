create extension if not exists "pgcrypto";

-- user_roles
create table if not exists public.user_roles (
  email      text primary key,
  role       text not null check (role in ('master','editor','viewer','none')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- projects
create table if not exists public.projects (
  id            uuid primary key default gen_random_uuid(),
  advertiser    text not null,
  name          text not null,
  campaign      text not null default '',
  vehicle_count int  not null default 1,
  memo          text not null default '',
  start_date    date,
  end_date      date,
  created_by    uuid references auth.users(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- tasks
create table if not exists public.tasks (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references public.projects(id) on delete cascade,
  title       text not null,
  department  text not null default '',
  assignee    text not null default '',
  start_date  date not null,
  end_date    date not null,
  status      text not null check (status in ('todo','in_progress','done')) default 'todo',
  progress    int  not null default 0 check (progress >= 0 and progress <= 100),
  color       text not null default '',
  memo        text not null default '',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- updated_at trigger
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

drop trigger if exists trg_user_roles_upd on public.user_roles;
create trigger trg_user_roles_upd before update on public.user_roles
  for each row execute function public.set_updated_at();

drop trigger if exists trg_projects_upd on public.projects;
create trigger trg_projects_upd before update on public.projects
  for each row execute function public.set_updated_at();

drop trigger if exists trg_tasks_upd on public.tasks;
create trigger trg_tasks_upd before update on public.tasks
  for each row execute function public.set_updated_at();

-- helper: current user's role
create or replace function public.current_user_role()
returns text language sql stable security definer set search_path = public as $$
  select coalesce(
    (select role from public.user_roles where lower(email) = lower(auth.email()) limit 1),
    'none'
  );
$$;

-- seed initial master
insert into public.user_roles (email, role)
values ('arinawj@gmail.com', 'master')
on conflict (email) do nothing;

-- RLS
alter table public.user_roles enable row level security;
alter table public.projects   enable row level security;
alter table public.tasks      enable row level security;

drop policy if exists "roles_select" on public.user_roles;
create policy "roles_select" on public.user_roles for select to authenticated
  using (lower(email) = lower(auth.email()) or public.current_user_role() = 'master');

drop policy if exists "roles_insert" on public.user_roles;
create policy "roles_insert" on public.user_roles for insert to authenticated
  with check (public.current_user_role() = 'master');

drop policy if exists "roles_update" on public.user_roles;
create policy "roles_update" on public.user_roles for update to authenticated
  using (public.current_user_role() = 'master')
  with check (public.current_user_role() = 'master');

drop policy if exists "roles_delete" on public.user_roles;
create policy "roles_delete" on public.user_roles for delete to authenticated
  using (public.current_user_role() = 'master');

drop policy if exists "projects_select" on public.projects;
create policy "projects_select" on public.projects for select to authenticated
  using (public.current_user_role() in ('master','editor','viewer'));

drop policy if exists "projects_insert" on public.projects;
create policy "projects_insert" on public.projects for insert to authenticated
  with check (public.current_user_role() in ('master','editor'));

drop policy if exists "projects_update" on public.projects;
create policy "projects_update" on public.projects for update to authenticated
  using (public.current_user_role() in ('master','editor'))
  with check (public.current_user_role() in ('master','editor'));

drop policy if exists "projects_delete" on public.projects;
create policy "projects_delete" on public.projects for delete to authenticated
  using (public.current_user_role() in ('master','editor'));

drop policy if exists "tasks_select" on public.tasks;
create policy "tasks_select" on public.tasks for select to authenticated
  using (public.current_user_role() in ('master','editor','viewer'));

drop policy if exists "tasks_insert" on public.tasks;
create policy "tasks_insert" on public.tasks for insert to authenticated
  with check (public.current_user_role() in ('master','editor'));

drop policy if exists "tasks_update" on public.tasks;
create policy "tasks_update" on public.tasks for update to authenticated
  using (public.current_user_role() in ('master','editor'))
  with check (public.current_user_role() in ('master','editor'));

drop policy if exists "tasks_delete" on public.tasks;
create policy "tasks_delete" on public.tasks for delete to authenticated
  using (public.current_user_role() in ('master','editor'));

create index if not exists idx_projects_advertiser on public.projects(advertiser);
create index if not exists idx_tasks_project_id   on public.tasks(project_id);
create index if not exists idx_tasks_dates        on public.tasks(start_date, end_date);
create index if not exists idx_tasks_status       on public.tasks(status);

-- ============================================================
-- Supabase May 30 2026+ 보안 정책 대응
-- 새 프로젝트는 public 스키마 테이블에 명시적 GRANT 필요
-- (RLS가 행 단위 접근을 제어하므로 GRANT는 안전함)
-- ============================================================

-- 스키마 사용 권한
grant usage on schema public to anon, authenticated, service_role;

-- 현재 테이블 접근 권한
grant select, insert, update, delete on public.user_roles to authenticated;
grant select, insert, update, delete on public.projects   to authenticated;
grant select, insert, update, delete on public.tasks      to authenticated;

-- 함수 실행 권한
grant execute on function public.current_user_role() to anon, authenticated;
grant execute on function public.set_updated_at()    to authenticated;

-- 앞으로 추가되는 테이블에도 자동 적용 (default privileges)
alter default privileges for role postgres in schema public
  grant select, insert, update, delete on tables to authenticated;
alter default privileges for role postgres in schema public
  grant execute on routines to authenticated;
alter default privileges for role postgres in schema public
  grant usage on sequences to authenticated;
