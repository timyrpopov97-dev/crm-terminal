-- Выполните это целиком в Supabase → SQL Editor → New query → Run

create table if not exists deals (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users not null,
  name text not null,
  company text default '',
  phone text default '',
  email text default '',
  amount numeric default 0,
  description text default '',
  currency text default 'UAH',
  stage text default 'lead',
  source text default 'manual',
  created_at timestamptz default now()
);

alter table deals enable row level security;

create policy "select own deals"
  on deals for select
  using (auth.uid() = user_id);

create policy "insert own deals"
  on deals for insert
  with check (auth.uid() = user_id);

create policy "update own deals"
  on deals for update
  using (auth.uid() = user_id);

create policy "delete own deals"
  on deals for delete
  using (auth.uid() = user_id);

-- Настройки доски: свои названия колонок и валюта отображения для каждого пользователя
create table if not exists board_settings (
  user_id uuid references auth.users primary key,
  column_labels jsonb default '{}'::jsonb,
  currency text default 'UAH',
  updated_at timestamptz default now()
);

alter table board_settings enable row level security;

create policy "select own settings"
  on board_settings for select
  using (auth.uid() = user_id);

create policy "insert own settings"
  on board_settings for insert
  with check (auth.uid() = user_id);

create policy "update own settings"
  on board_settings for update
  using (auth.uid() = user_id);

-- Если таблица deals уже была создана раньше (до появления source),
-- выполните только эту строку отдельно:
alter table deals add column if not exists source text default 'manual';
