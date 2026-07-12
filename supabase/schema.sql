-- AssetFlow — Full Schema
-- Run this entire file in Supabase SQL Editor

-- Departments
create table if not exists departments (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  location text,
  created_at timestamptz default now()
);

-- Profiles (linked to auth.users)
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  email text not null unique,
  role text not null default 'employee' check (role in ('employee','department_head','asset_manager','admin')),
  department_id uuid references departments(id),
  status text not null default 'active' check (status in ('active','inactive')),
  created_at timestamptz default now()
);

-- Auto-create profile on signup
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into profiles (id, name, email)
  values (new.id, coalesce(new.raw_user_meta_data->>'name', split_part(new.email,'@',1)), new.email)
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- Asset categories
create table if not exists asset_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  default_depreciation_rate numeric,
  created_at timestamptz default now()
);

-- Assets
create table if not exists assets (
  id uuid primary key default gen_random_uuid(),
  tag text not null unique,
  name text not null,
  category_id uuid references asset_categories(id),
  department_id uuid references departments(id),
  status text not null default 'available' check (status in ('available','allocated','reserved','under_maintenance','lost','retired','disposed')),
  condition text default 'good' check (condition in ('new','good','fair','poor')),
  serial_number text,
  purchase_date date,
  purchase_cost numeric,
  location text,
  description text,
  photo_url text,
  qr_code_url text,
  is_bookable boolean default false,
  current_holder_id uuid references profiles(id),
  current_holder_type text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Allocations
create table if not exists allocations (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references assets(id),
  from_user_id uuid references profiles(id),
  to_user_id uuid not null references profiles(id),
  status text not null default 'active' check (status in ('active','returned','overdue')),
  expected_return_date date,
  returned_at timestamptz,
  condition_notes text,
  created_at timestamptz default now()
);

-- Transfer requests
create table if not exists transfer_requests (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references assets(id),
  from_user_id uuid not null references profiles(id),
  to_user_id uuid not null references profiles(id),
  reason text,
  status text not null default 'requested' check (status in ('requested','completed','rejected')),
  approved_by uuid references profiles(id),
  created_at timestamptz default now()
);

-- Maintenance requests
create table if not exists maintenance_requests (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references assets(id),
  raised_by uuid not null references profiles(id),
  issue text not null,
  priority text not null default 'medium' check (priority in ('low','medium','high','critical')),
  status text not null default 'pending' check (status in ('pending','approved','rejected','technician_assigned','in_progress','resolved')),
  approved_by uuid references profiles(id),
  technician_name text,
  photo_url text,
  condition_notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Bookings
create table if not exists bookings (
  id uuid primary key default gen_random_uuid(),
  resource_asset_id uuid not null references assets(id),
  booked_by_user_id uuid not null references profiles(id),
  start_time timestamptz not null,
  end_time timestamptz not null,
  status text not null default 'upcoming' check (status in ('upcoming','ongoing','completed','cancelled')),
  created_at timestamptz default now()
);

-- Audit cycles
create table if not exists audit_cycles (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  scope_department_id uuid references departments(id),
  start_date date,
  end_date date,
  status text not null default 'open' check (status in ('open','in_progress','closed')),
  created_by uuid references profiles(id),
  created_at timestamptz default now()
);

-- Audit items
create table if not exists audit_items (
  id uuid primary key default gen_random_uuid(),
  audit_cycle_id uuid not null references audit_cycles(id),
  asset_id uuid not null references assets(id),
  verification text not null check (verification in ('verified','missing','damaged')),
  notes text,
  audited_at timestamptz default now()
);

-- Notifications
create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id),
  type text not null,
  message text not null,
  is_read boolean default false,
  related_entity_id uuid,
  related_entity_type text,
  created_at timestamptz default now()
);

-- Activity log (hash chained)
create table if not exists activity_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id),
  action text not null,
  entity_type text,
  entity_id uuid,
  timestamp timestamptz default now(),
  details jsonb default '{}',
  prev_hash text,
  row_hash text,
  created_at timestamptz default now()
);

-- Enable Realtime on key tables
alter publication supabase_realtime add table assets;
alter publication supabase_realtime add table allocations;
alter publication supabase_realtime add table bookings;
alter publication supabase_realtime add table notifications;
alter publication supabase_realtime add table activity_log;

-- Row Level Security (basic — open for hackathon, tighten post-event)
alter table profiles enable row level security;
alter table assets enable row level security;
alter table allocations enable row level security;
alter table notifications enable row level security;

create policy "profiles_select" on profiles for select using (true);
create policy "profiles_update_own" on profiles for update using (auth.uid() = id);

create policy "assets_select" on assets for select using (true);
create policy "assets_insert" on assets for insert with check (true);
create policy "assets_update" on assets for update using (true);

create policy "allocations_select" on allocations for select using (true);
create policy "allocations_insert" on allocations for insert with check (true);
create policy "allocations_update" on allocations for update using (true);

create policy "notifications_select" on notifications for select using (auth.uid() = user_id);
create policy "notifications_insert" on notifications for insert with check (true);
create policy "notifications_update" on notifications for update using (auth.uid() = user_id);
