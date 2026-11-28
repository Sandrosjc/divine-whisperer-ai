-- Chequetto — contador de visitas e cotas diárias SEM service role.
-- O servidor (Render) usa apenas a chave publicável: tudo que precisa de
-- privilégio vira função `security definer` com validação interna.
-- Idempotente: pode rodar mais de uma vez.

-- ============================================================
-- 1) CONTADOR DE VISITAS
-- ============================================================
create table if not exists public.page_visits (
  id bigserial primary key,
  visitor_hash text not null check (length(visitor_hash) = 64),
  path text not null default '/',
  day date not null default (now() at time zone 'utc')::date,
  created_at timestamptz not null default now()
);

create index if not exists page_visits_created_at_idx on public.page_visits (created_at desc);
create index if not exists page_visits_visitor_hash_idx on public.page_visits (visitor_hash);
create index if not exists page_visits_day_idx on public.page_visits (day);

-- Ninguém acessa a tabela direto: só pelas funções abaixo.
alter table public.page_visits enable row level security;
revoke all on public.page_visits from anon, authenticated;
revoke all on sequence public.page_visits_id_seq from anon, authenticated;

-- Registra uma visita. Recebe o hash do visitante (nunca o cookie) e limita a
-- 40 registros por visitante/dia para não servir de bomba de linhas.
create or replace function public.track_visit(_hash text, _path text default '/')
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  today date := (now() at time zone 'utc')::date;
  seen int;
begin
  if _hash is null or _hash !~ '^[0-9a-f]{64}$' then
    return false;
  end if;

  select count(*) into seen
    from public.page_visits
   where visitor_hash = _hash and day = today;
  if seen >= 40 then
    return false;
  end if;

  insert into public.page_visits (visitor_hash, path, day)
  values (_hash, left(coalesce(nullif(_path, ''), '/'), 200), today);
  return true;
end $$;

revoke all on function public.track_visit(text, text) from public;
grant execute on function public.track_visit(text, text) to anon, authenticated;

-- Números do contador: só para administrador. O JWT do usuário chega pela
-- requisição, então `auth.uid()` é quem está pedindo — nunca a URL.
create or replace function public.page_visits_stats()
returns table (total bigint, unicos bigint)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.has_role(auth.uid(), 'admin') then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  return query
    select count(*)::bigint as total,
           count(distinct (visitor_hash, day))::bigint as unicos
      from public.page_visits;
end $$;

revoke all on function public.page_visits_stats() from public;
grant execute on function public.page_visits_stats() to anon, authenticated;

-- ============================================================
-- 2) PERFIL: profissão e idade vindos do modal de cadastro
-- ============================================================
alter table public.profiles add column if not exists profession text;
alter table public.profiles add column if not exists age int
  check (age is null or (age >= 5 and age <= 120));

-- ============================================================
-- 3) COTA DO VISITANTE — 5 mensagens grátis por dia
-- ============================================================
create table if not exists public.guest_usage (
  fp text not null,
  day date not null default (now() at time zone 'utc')::date,
  count int not null default 0,
  primary key (fp, day)
);

alter table public.guest_usage enable row level security;
revoke all on public.guest_usage from anon, authenticated;

create or replace function public.consume_guest_message(_fp text, _limit int default 5)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare c int;
begin
  if _fp is null or length(_fp) < 16 or length(_fp) > 128 then
    raise exception 'invalid' using errcode = '22023';
  end if;

  insert into public.guest_usage (fp, day, count)
  values (_fp, (now() at time zone 'utc')::date, 0)
  on conflict do nothing;

  update public.guest_usage
     set count = count + 1
   where fp = _fp
     and day = (now() at time zone 'utc')::date
     and count < least(greatest(_limit, 1), 5)
  returning count into c;

  return coalesce(c, -1);
end $$;

revoke all on function public.consume_guest_message(text, int) from public;
grant execute on function public.consume_guest_message(text, int) to anon, authenticated;

-- ============================================================
-- 4) COTA DO USUÁRIO LOGADO — 10 mensagens por dia
-- ============================================================
-- Contador próprio: apagar o histórico de chat não devolve cota.
create table if not exists public.user_daily_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null default (now() at time zone 'utc')::date,
  count int not null default 0,
  primary key (user_id, day)
);

alter table public.user_daily_usage enable row level security;
revoke all on public.user_daily_usage from anon, authenticated;

create index if not exists chat_messages_user_created_idx
  on public.chat_messages (user_id, created_at desc);

-- A mensagem do assistente é gravada com o JWT do próprio usuário (RLS).
grant insert on public.chat_messages to authenticated;
drop policy if exists "insert own messages" on public.chat_messages;
create policy "insert own messages" on public.chat_messages
  for insert to authenticated
  with check (user_id = auth.uid());

-- Consome uma mensagem do dia de forma atômica: valida o plano, conta,
-- grava a mensagem do usuário e devolve o que o app precisa exibir.
create or replace function public.consume_chat_message(_content text, _limit int default 10)
returns table (allowed boolean, used int, plan text)
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  user_plan text;
  used_now int;
  today date := (now() at time zone 'utc')::date;
  cap int := least(greatest(_limit, 1), 10);
begin
  if uid is null then
    raise exception 'unauthorized' using errcode = '42501';
  end if;
  if _content is null or length(btrim(_content)) = 0 then
    raise exception 'invalid' using errcode = '22023';
  end if;

  select p.plan::text into user_plan from public.profiles p where p.id = uid;
  user_plan := coalesce(user_plan, 'trial');

  if user_plan = 'suspended' then
    return query select false, 0, user_plan;
    return;
  end if;

  -- Plano vitalício: sem cota.
  if user_plan = 'lifetime' then
    insert into public.chat_messages (user_id, role, content)
    values (uid, 'user', left(_content, 8000));
    return query select true, 0, user_plan;
    return;
  end if;

  insert into public.user_daily_usage (user_id, day, count)
  values (uid, today, 0)
  on conflict do nothing;

  select u.count into used_now
    from public.user_daily_usage u
   where u.user_id = uid and u.day = today;
  used_now := coalesce(used_now, 0);

  if used_now >= cap then
    return query select false, used_now, user_plan;
    return;
  end if;

  update public.user_daily_usage u
     set count = u.count + 1
   where u.user_id = uid and u.day = today;

  insert into public.chat_messages (user_id, role, content)
  values (uid, 'user', left(_content, 8000));

  return query select true, used_now + 1, user_plan;
end $$;

revoke all on function public.consume_chat_message(text, int) from public, anon;
grant execute on function public.consume_chat_message(text, int) to authenticated;

-- ============================================================
-- 5) ADMIN — só se o seu login não for achequetto@outlook.com
-- ============================================================
-- insert into public.user_roles (user_id, role)
-- select id, 'admin'::app_role from auth.users
-- where lower(email) = lower('seu-email@aqui.com')
-- on conflict (user_id, role) do nothing;
