create type public.app_role as enum ('admin','user');
create table public.user_roles (id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, role app_role not null, unique(user_id, role));
grant select on public.user_roles to authenticated; grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;
create or replace function public.has_role(_user_id uuid, _role app_role) returns boolean language sql stable security definer set search_path = public as $$ select exists (select 1 from public.user_roles where user_id=_user_id and role=_role) $$;
create policy "own roles" on public.user_roles for select to authenticated using (user_id = auth.uid() or public.has_role(auth.uid(),'admin'));

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text, birth_date date, city text,
  language text default 'en',
  plan text not null default 'trial',
  memory_summary text not null default '',
  welcome_message text,
  onboarded boolean not null default false,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now());
grant select, insert, update on public.profiles to authenticated; grant all on public.profiles to service_role;
alter table public.profiles enable row level security;
create policy "view own or admin" on public.profiles for select to authenticated using (id = auth.uid() or public.has_role(auth.uid(),'admin'));
create policy "insert own" on public.profiles for insert to authenticated with check (id = auth.uid() and plan = 'trial');
create policy "update own" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
create or replace function public.protect_profile_plan() returns trigger language plpgsql set search_path = public as $$
begin
  if current_user = 'authenticated' and (new.plan is distinct from old.plan or new.memory_summary is distinct from old.memory_summary) then
    new.plan := old.plan; new.memory_summary := old.memory_summary;
  end if;
  new.updated_at := now();
  return new;
end $$;
create trigger profiles_protect before update on public.profiles for each row execute function public.protect_profile_plan();
create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin insert into public.profiles (id, email) values (new.id, new.email) on conflict do nothing; return new; end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

create table public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null, content text not null,
  summarized boolean not null default false,
  created_at timestamptz not null default now());
create index on public.chat_messages(user_id, created_at);
grant select, delete on public.chat_messages to authenticated; grant all on public.chat_messages to service_role;
alter table public.chat_messages enable row level security;
create policy "own messages" on public.chat_messages for select to authenticated using (user_id = auth.uid());
create policy "delete own messages" on public.chat_messages for delete to authenticated using (user_id = auth.uid());

create table public.user_api_keys (user_id uuid primary key references auth.users(id) on delete cascade, openrouter_key text not null, updated_at timestamptz not null default now());
grant all on public.user_api_keys to service_role;
alter table public.user_api_keys enable row level security;

create table public.licenses (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  source text not null default 'appsumo',
  redeemed_by uuid references auth.users(id) on delete set null,
  redeemed_at timestamptz,
  created_at timestamptz not null default now());
grant select on public.licenses to authenticated; grant all on public.licenses to service_role;
alter table public.licenses enable row level security;
create policy "admin view licenses" on public.licenses for select to authenticated using (public.has_role(auth.uid(),'admin') or redeemed_by = auth.uid());

create table public.app_settings (
  id int primary key default 1 check (id = 1),
  admin_email text,
  openrouter_keys text[] not null default '{}',
  rotation_index int not null default 0,
  draft_models text[] not null default array['anthropic/claude-sonnet-4.5','openai/gpt-5','google/gemini-2.5-pro'],
  refine_model text not null default 'anthropic/claude-sonnet-4.5',
  monthly_price_usd numeric not null default 19,
  updated_at timestamptz not null default now());
insert into public.app_settings (id) values (1);
grant all on public.app_settings to service_role;
alter table public.app_settings enable row level security;