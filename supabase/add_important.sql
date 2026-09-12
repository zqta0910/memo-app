-- 既存の memos テーブルに重要フラグを足すとき、これだけ実行してください。

alter table public.memos
  add column if not exists important boolean not null default false;
