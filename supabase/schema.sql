-- Supabase SQL Editor で実行してください。

create table if not exists public.memos (
  id uuid primary key default gen_random_uuid(),
  title text not null default '',
  body text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists memos_set_updated_at on public.memos;
create trigger memos_set_updated_at
before update on public.memos
for each row
execute function public.set_updated_at();

alter table public.memos enable row level security;

drop policy if exists "Allow public select" on public.memos;
drop policy if exists "Allow public insert" on public.memos;
drop policy if exists "Allow public update" on public.memos;
drop policy if exists "Allow public delete" on public.memos;

create policy "Allow public select"
on public.memos
for select
to anon, authenticated
using (true);

create policy "Allow public insert"
on public.memos
for insert
to anon, authenticated
with check (true);

create policy "Allow public update"
on public.memos
for update
to anon, authenticated
using (true)
with check (true);

create policy "Allow public delete"
on public.memos
for delete
to anon, authenticated
using (true);

grant select, insert, update, delete on table public.memos to anon, authenticated;
