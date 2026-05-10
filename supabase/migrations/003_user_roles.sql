-- User roles table — maps Supabase auth users to app roles
create table if not exists user_roles (
  user_id    uuid primary key references auth.users on delete cascade,
  role       text not null default 'readonly'
               check (role in ('admin', 'therapist', 'billing', 'readonly')),
  therapist_id uuid references therapists on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table user_roles enable row level security;

-- Each user can read their own role (used by useCurrentUser hook)
create policy "read_own_role"
  on user_roles for select
  using (auth.uid() = user_id);

-- All writes go through service-role server actions — no client-side write policies needed.

-- After running this migration, give yourself admin access:
-- INSERT INTO user_roles (user_id, role)
-- VALUES ('<your-user-id>', 'admin')
-- ON CONFLICT (user_id) DO UPDATE SET role = 'admin';
--
-- Find your user_id in: Supabase Dashboard → Authentication → Users
