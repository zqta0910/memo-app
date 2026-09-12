"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";
import type { Memo } from "@/lib/types";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function preview(body: string) {
  const text = body.replace(/\s+/g, " ").trim();
  if (!text) return "本文なし";
  return text.length > 80 ? `${text.slice(0, 80)}…` : text;
}

export default function MemoApp() {
  const [memos, setMemos] = useState<Memo[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedMemo = useMemo(
    () => memos.find((memo) => memo.id === selectedId) ?? null,
    [memos, selectedId],
  );
  const isDirty =
    (selectedMemo?.title ?? "") !== title || (selectedMemo?.body ?? "") !== body;

  const resetForm = useCallback((memo?: Memo | null) => {
    setSelectedId(memo?.id ?? null);
    setTitle(memo?.title ?? "");
    setBody(memo?.body ?? "");
    setError(null);
  }, []);

  const loadMemos = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await getSupabase()
        .from("memos")
        .select("*")
        .order("updated_at", { ascending: false });

      if (fetchError) {
        setError(fetchError.message);
        setLoading(false);
        return;
      }

      setMemos((data ?? []) as Memo[]);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Supabase への接続に失敗しました。`.env.local` の URL とキーを確認してください。",
      );
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    void loadMemos();
  }, [loadMemos]);

  function startNewMemo() {
    resetForm(null);
  }

  function selectMemo(memo: Memo) {
    if (isDirty && !window.confirm("未保存の変更があります。破棄しますか？")) {
      return;
    }
    resetForm(memo);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isSupabaseConfigured) return;

    const nextTitle = title.trim();
    const nextBody = body.trim();

    if (!nextTitle && !nextBody) {
      setError("タイトルか本文を入力してください。");
      return;
    }

    setSaving(true);
    setError(null);

    const supabase = getSupabase();

    if (selectedId) {
      const { data, error: updateError } = await supabase
        .from("memos")
        .update({ title: nextTitle, body: nextBody })
        .eq("id", selectedId)
        .select()
        .single();

      if (updateError) {
        setError(updateError.message);
        setSaving(false);
        return;
      }

      const updated = data as Memo;
      setMemos((current) =>
        [updated, ...current.filter((memo) => memo.id !== updated.id)].sort(
          (a, b) => Date.parse(b.updated_at) - Date.parse(a.updated_at),
        ),
      );
      resetForm(updated);
    } else {
      const { data, error: insertError } = await supabase
        .from("memos")
        .insert({ title: nextTitle, body: nextBody })
        .select()
        .single();

      if (insertError) {
        setError(insertError.message);
        setSaving(false);
        return;
      }

      const created = data as Memo;
      setMemos((current) => [created, ...current]);
      resetForm(created);
    }

    setSaving(false);
  }

  async function handleDelete() {
    if (!selectedId || !isSupabaseConfigured) return;
    if (!window.confirm("このメモを削除しますか？")) return;

    setSaving(true);
    setError(null);

    const { error: deleteError } = await getSupabase()
      .from("memos")
      .delete()
      .eq("id", selectedId);

    if (deleteError) {
      setError(deleteError.message);
      setSaving(false);
      return;
    }

    setMemos((current) => current.filter((memo) => memo.id !== selectedId));
    resetForm(null);
    setSaving(false);
  }

  if (!isSupabaseConfigured) {
    return (
      <section className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-amber-950">
        <h2 className="text-lg font-semibold">環境変数を設定してください</h2>
        <p className="mt-2 text-sm leading-6">
          プロジェクト直下に <code className="rounded bg-white px-1.5 py-0.5">.env.local</code>{" "}
          を作成し、Supabase の URL と anon key を入れてから開発サーバーを再起動してください。
        </p>
        <pre className="mt-4 overflow-x-auto rounded-xl bg-white p-4 text-sm">
{`NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key`}
        </pre>
      </section>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,18rem)_minmax(0,1fr)]">
      <aside className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold tracking-wide text-zinc-500">
            メモ一覧
          </h2>
          <button
            type="button"
            onClick={startNewMemo}
            className="rounded-full bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-700"
          >
            新規作成
          </button>
        </div>

        {loading ? (
          <p className="mt-6 text-sm text-zinc-500">読み込み中...</p>
        ) : memos.length === 0 ? (
          <p className="mt-6 text-sm text-zinc-500">
            まだメモがありません。右のフォームから作成できます。
          </p>
        ) : (
          <ul className="mt-4 space-y-2">
            {memos.map((memo) => {
              const active = memo.id === selectedId;
              return (
                <li key={memo.id}>
                  <button
                    type="button"
                    onClick={() => selectMemo(memo)}
                    className={`w-full rounded-xl border px-3 py-3 text-left transition ${
                      active
                        ? "border-zinc-900 bg-zinc-900 text-white"
                        : "border-zinc-200 bg-zinc-50 hover:border-zinc-300 hover:bg-white"
                    }`}
                  >
                    <p className="truncate font-medium">
                      {memo.title || "無題のメモ"}
                    </p>
                    <p
                      className={`mt-1 line-clamp-2 text-sm ${
                        active ? "text-zinc-300" : "text-zinc-500"
                      }`}
                    >
                      {preview(memo.body)}
                    </p>
                    <p
                      className={`mt-2 text-xs ${
                        active ? "text-zinc-400" : "text-zinc-400"
                      }`}
                    >
                      {formatDate(memo.updated_at)}
                    </p>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </aside>

      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">
              {selectedId ? "メモを編集" : "新しいメモ"}
            </h2>
            {selectedMemo ? (
              <p className="mt-1 text-sm text-zinc-500">
                更新: {formatDate(selectedMemo.updated_at)}
              </p>
            ) : (
              <p className="mt-1 text-sm text-zinc-500">
                タイトルと本文を入力して保存してください。
              </p>
            )}
          </div>
          {selectedId ? (
            <button
              type="button"
              onClick={() => void handleDelete()}
              disabled={saving}
              className="rounded-full border border-red-200 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
            >
              削除
            </button>
          ) : null}
        </div>

        {error ? (
          <p className="mb-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            {error}
          </p>
        ) : null}

        <form className="flex flex-col gap-4" onSubmit={(event) => void handleSubmit(event)}>
          <label className="flex flex-col gap-2">
            <span className="text-sm font-medium text-zinc-700">タイトル</span>
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="買い物リスト"
              className="rounded-xl border border-zinc-200 px-3 py-2 outline-none ring-zinc-900 focus:ring-2"
            />
          </label>
          <label className="flex flex-col gap-2">
            <span className="text-sm font-medium text-zinc-700">本文</span>
            <textarea
              value={body}
              onChange={(event) => setBody(event.target.value)}
              placeholder="メモの内容を書いてください"
              rows={14}
              className="min-h-64 resize-y rounded-xl border border-zinc-200 px-3 py-2 outline-none ring-zinc-900 focus:ring-2"
            />
          </label>
          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={saving}
              className="rounded-full bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50"
            >
              {saving ? "保存中..." : selectedId ? "更新する" : "作成する"}
            </button>
            {isDirty ? (
              <span className="text-sm text-zinc-500">未保存の変更があります</span>
            ) : null}
          </div>
        </form>
      </section>
    </div>
  );
}
