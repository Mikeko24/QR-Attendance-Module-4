create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text,
  role text not null default 'student' check (role in ('student', 'teacher', 'admin')),
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles
  add column if not exists avatar_url text;

create table if not exists public.academic_groups (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  icon_name text not null default 'school',
  icon_color text not null default '#2563EB',
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.academic_groups
  add column if not exists icon_name text not null default 'school';

alter table public.academic_groups
  add column if not exists icon_color text not null default '#2563EB';

create table if not exists public.academic_subgroups (
  id uuid primary key default gen_random_uuid(),
  academic_group_id uuid not null references public.academic_groups (id) on delete cascade,
  name text not null,
  icon_name text not null default 'category',
  icon_color text not null default '#2563EB',
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (academic_group_id, name)
);

alter table public.academic_subgroups
  add column if not exists icon_name text not null default 'category';

alter table public.academic_subgroups
  add column if not exists icon_color text not null default '#2563EB';

insert into public.academic_groups (name)
values ('General')
on conflict (name) do nothing;

alter table public.profiles
  add column if not exists academic_group_id uuid references public.academic_groups (id) on delete set null;

alter table public.profiles
  add column if not exists academic_subgroup_id uuid references public.academic_subgroups (id) on delete set null;

alter table public.profiles
  add column if not exists academic_assignment_change_count integer not null default 0;

alter table public.profiles
  add column if not exists academic_assignment_changed_at timestamptz;

alter table public.profiles
  drop constraint if exists profiles_role_check;

alter table public.profiles
  add constraint profiles_role_check
  check (role in ('student', 'teacher', 'admin'));

insert into storage.buckets (id, name, public)
values ('profile-images', 'profile-images', true)
on conflict (id) do update set public = true;

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  event_code text not null unique,
  title text not null,
  start_time timestamptz,
  end_time timestamptz,
  academic_group_id uuid references public.academic_groups (id) on delete restrict,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.events
  add column if not exists academic_group_id uuid references public.academic_groups (id) on delete restrict;

alter table public.events
  add column if not exists academic_subgroup_id uuid references public.academic_subgroups (id) on delete set null;

alter table public.events
  add column if not exists academic_subgroup_ids uuid[] not null default '{}';

update public.events
set academic_subgroup_ids = array[academic_subgroup_id]
where academic_subgroup_id is not null
  and cardinality(academic_subgroup_ids) = 0;

update public.profiles
set academic_group_id = (select id from public.academic_groups where name = 'General' limit 1),
    updated_at = now()
where academic_group_id is null;

update public.events
set academic_group_id = (select id from public.academic_groups where name = 'General' limit 1)
where academic_group_id is null;

alter table public.events
  alter column academic_group_id set not null;

create table if not exists public.attendance (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references auth.users (id) on delete cascade,
  event_id uuid not null references public.events (id) on delete cascade,
  scanned_at timestamptz not null default now(),
  unique (student_id, event_id)
);

alter table public.profiles enable row level security;
alter table public.academic_groups enable row level security;
alter table public.academic_subgroups enable row level security;
alter table public.events enable row level security;
alter table public.attendance enable row level security;

drop policy if exists "Profiles are viewable by owner" on public.profiles;
create policy "Profiles are viewable by owner" on public.profiles
  for select using (auth.uid() = id);

drop policy if exists "Users can insert their own profile" on public.profiles;
create policy "Users can insert their own profile" on public.profiles
  for insert with check (auth.uid() = id);

drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile" on public.profiles
  for update using (auth.uid() = id)
  with check (auth.uid() = id);

drop policy if exists "Students can update their own academic group" on public.profiles;
create policy "Students can update their own academic group" on public.profiles
  for update using (auth.uid() = id)
  with check (auth.uid() = id);

drop policy if exists "Profile images are publicly readable" on storage.objects;
create policy "Profile images are publicly readable" on storage.objects
  for select using (bucket_id = 'profile-images');

drop policy if exists "Users can upload their own profile images" on storage.objects;
create policy "Users can upload their own profile images" on storage.objects
  for insert with check (
    bucket_id = 'profile-images'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "Users can update their own profile images" on storage.objects;
create policy "Users can update their own profile images" on storage.objects
  for update using (
    bucket_id = 'profile-images'
    and auth.uid()::text = (storage.foldername(name))[1]
  )
  with check (
    bucket_id = 'profile-images'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "Users can delete their own profile images" on storage.objects;
create policy "Users can delete their own profile images" on storage.objects
  for delete using (
    bucket_id = 'profile-images'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "Teachers can view profiles of their attendees" on public.profiles;
create policy "Teachers can view profiles of their attendees" on public.profiles
  for select using (
    exists (
      select 1 from public.attendance a
      join public.events e on e.id = a.event_id
      where a.student_id = profiles.id and e.created_by = auth.uid()
    )
  );

create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'admin'
  );
$$;

drop policy if exists "Academic groups are readable by authenticated users" on public.academic_groups;
create policy "Academic groups are readable by authenticated users" on public.academic_groups
  for select using (auth.role() = 'authenticated');

drop policy if exists "Admins can insert academic groups" on public.academic_groups;
create policy "Admins can insert academic groups" on public.academic_groups
  for insert with check (public.is_admin());

drop policy if exists "Admins can update academic groups" on public.academic_groups;
create policy "Admins can update academic groups" on public.academic_groups
  for update using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "Admins can delete academic groups" on public.academic_groups;
create policy "Admins can delete academic groups" on public.academic_groups
  for delete using (public.is_admin());

drop policy if exists "Academic subgroups are readable by authenticated users" on public.academic_subgroups;
create policy "Academic subgroups are readable by authenticated users" on public.academic_subgroups
  for select using (auth.role() = 'authenticated');

drop policy if exists "Admins can insert academic subgroups" on public.academic_subgroups;
create policy "Admins can insert academic subgroups" on public.academic_subgroups
  for insert with check (public.is_admin());

drop policy if exists "Students can insert first academic subgroup" on public.academic_subgroups;
create policy "Students can insert first academic subgroup" on public.academic_subgroups
  for insert with check (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role = 'student'
        and p.academic_assignment_change_count = 0
    )
    and not exists (
      select 1
      from public.academic_subgroups existing
      where existing.academic_group_id = academic_subgroups.academic_group_id
    )
  );

drop policy if exists "Admins can update academic subgroups" on public.academic_subgroups;
create policy "Admins can update academic subgroups" on public.academic_subgroups
  for update using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "Admins can delete academic subgroups" on public.academic_subgroups;
create policy "Admins can delete academic subgroups" on public.academic_subgroups
  for delete using (public.is_admin());

drop policy if exists "Admins can view all profiles" on public.profiles;
create policy "Admins can view all profiles" on public.profiles
  for select using (public.is_admin());

drop policy if exists "Admins can update profiles" on public.profiles;
create policy "Admins can update profiles" on public.profiles
  for update using (public.is_admin())
  with check (public.is_admin());

create or replace function public.guard_profile_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() = old.id and not public.is_admin() then
    if new.role is distinct from old.role then
      raise exception 'Only an admin can change account roles.';
    end if;

    if new.email is distinct from old.email then
      raise exception 'Profile email cannot be changed here.';
    end if;

    if new.academic_group_id is distinct from old.academic_group_id
      or new.academic_subgroup_id is distinct from old.academic_subgroup_id then
      if old.role = 'student' and old.academic_assignment_change_count >= 1 then
        raise exception 'Students can change their course and subgroup only once. Ask an admin to correct it.';
      end if;

      new.academic_assignment_change_count = old.academic_assignment_change_count + 1;
      new.academic_assignment_changed_at = now();
    else
      new.academic_assignment_change_count = old.academic_assignment_change_count;
      new.academic_assignment_changed_at = old.academic_assignment_changed_at;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists guard_profile_update_before_update on public.profiles;
create trigger guard_profile_update_before_update
  before update on public.profiles
  for each row execute procedure public.guard_profile_update();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
    case
      when new.raw_user_meta_data ->> 'role' in ('student', 'teacher')
        then new.raw_user_meta_data ->> 'role'
      else 'student'
    end
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

drop policy if exists "Events are readable by any authenticated user" on public.events;
create policy "Events are readable by any authenticated user" on public.events
  for select using (auth.role() = 'authenticated');

drop policy if exists "Users can insert events" on public.events;
create policy "Users can insert events" on public.events
  for insert with check (
    auth.uid() = created_by
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('teacher', 'admin')
    )
    and exists (
      select 1 from public.academic_groups g
      where g.id = events.academic_group_id
    )
    and (
      cardinality(events.academic_subgroup_ids) = 0
      or not exists (
        select 1
        from unnest(events.academic_subgroup_ids) as selected_subgroup_id
        where not exists (
          select 1
          from public.academic_subgroups sg
          where sg.id = selected_subgroup_id
            and sg.academic_group_id = events.academic_group_id
        )
      )
    )
  );

drop policy if exists "Users can update their own events" on public.events;
create policy "Users can update their own events" on public.events
  for update using (
    auth.uid() = created_by
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('teacher', 'admin')
    )
  )
  with check (
    auth.uid() = created_by
    and exists (
      select 1 from public.academic_groups g
      where g.id = events.academic_group_id
    )
    and (
      cardinality(events.academic_subgroup_ids) = 0
      or not exists (
        select 1
        from unnest(events.academic_subgroup_ids) as selected_subgroup_id
        where not exists (
          select 1
          from public.academic_subgroups sg
          where sg.id = selected_subgroup_id
            and sg.academic_group_id = events.academic_group_id
        )
      )
    )
  );

drop policy if exists "Admins can view all events" on public.events;
create policy "Admins can view all events" on public.events
  for select using (public.is_admin());

drop policy if exists "Admins can update all events" on public.events;
create policy "Admins can update all events" on public.events
  for update using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "Admins can delete all events" on public.events;
create policy "Admins can delete all events" on public.events
  for delete using (public.is_admin());

drop policy if exists "Students can view their own attendance" on public.attendance;
create policy "Students can view their own attendance" on public.attendance
  for select using (auth.uid() = student_id);

drop policy if exists "Students can insert their own attendance" on public.attendance;
create policy "Students can insert their own attendance" on public.attendance
  for insert with check (auth.uid() = student_id);

drop policy if exists "Teachers can view attendance for their events" on public.attendance;
create policy "Teachers can view attendance for their events" on public.attendance
  for select using (
    exists (
      select 1 from public.events e
      where e.id = attendance.event_id and e.created_by = auth.uid()
    )
  );

drop policy if exists "Admins can view all attendance" on public.attendance;
create policy "Admins can view all attendance" on public.attendance
  for select using (public.is_admin());

drop policy if exists "Admins can delete attendance" on public.attendance;
create policy "Admins can delete attendance" on public.attendance
  for delete using (public.is_admin());

drop policy if exists "Admins can update attendance" on public.attendance;
create policy "Admins can update attendance" on public.attendance
  for update using (public.is_admin())
  with check (public.is_admin());

-- Promote an existing Supabase Auth account manually:
-- update public.profiles
-- set role = 'admin',
--     updated_at = now()
-- where email = 'admin@example.com';
