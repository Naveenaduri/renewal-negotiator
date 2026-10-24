create table deals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  vendor text, product text, price numeric, renewal_date date,
  status text default 'new', est_saving numeric,
  created_at timestamptz default now()
);
create table runs (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid references deals(id) on delete cascade,
  user_id uuid not null default auth.uid(),
  status text default 'queued',
  created_at timestamptz default now()
);
create table run_steps (
  id bigserial primary key,
  run_id uuid references runs(id) on delete cascade,
  lane text, kind text, text text,
  created_at timestamptz default now()
);
create table messages (
  id bigserial primary key,
  run_id uuid references runs(id) on delete cascade,
  role text check (role in ('buyer','vendor_sim','judge','user_vendor')),
  round int, text text,
  created_at timestamptz default now()
);
create table receipts (
  id bigserial primary key,
  run_id uuid references runs(id) on delete cascade,
  claim text, source_url text, screenshot_url text,
  verified boolean default false,
  fetched_at timestamptz default now()
);

alter table deals enable row level security;
alter table runs enable row level security;
alter table run_steps enable row level security;
alter table messages enable row level security;
alter table receipts enable row level security;

create policy "own deals" on deals for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own runs" on runs for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own steps" on run_steps for select using (exists (select 1 from runs r where r.id = run_id and r.user_id = auth.uid()));
create policy "own messages" on messages for select using (exists (select 1 from runs r where r.id = run_id and r.user_id = auth.uid()));
create policy "own receipts" on receipts for select using (exists (select 1 from runs r where r.id = run_id and r.user_id = auth.uid()));
-- Agents write steps/messages/receipts with the service role key (server-side only).

alter publication supabase_realtime add table run_steps, messages, receipts;
