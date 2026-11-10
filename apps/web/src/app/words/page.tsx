"use client";

import { memo, useDeferredValue, useMemo, useRef, useState } from "react";
import type { VocabEntry } from "@aral/core";
import { Header } from "@/components/Header";
import { playAudio } from "@/lib/audio";
import { bundle } from "@/lib/content";
import "../pages-mobile.css";

/** lowercase + strip accents, so typing "pagpapala" also finds "pagpapalà" */
function fold(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

interface Indexed {
  entry: VocabEntry;
  lemma: string;
  translation: string;
  notes: string;
  letter: string;
}

/**
 * Lower is better. Tagalog-side hits outrank English ones, prefix/word-start
 * hits outrank mid-word ones, and notes are a last resort — so "ka" surfaces
 * "kain" before every note that happens to contain "ka".
 */
function score(w: Indexed, q: string): number {
  if (w.lemma === q) return 0;
  if (w.lemma.startsWith(q)) return 1;
  if (w.translation === q) return 2;
  if (w.translation.startsWith(q) || w.translation.includes(" " + q)) return 3;
  if (w.lemma.includes(q)) return 4;
  if (w.translation.includes(q)) return 5;
  if (w.notes.includes(q)) return 6;
  return -1;
}

/**
 * Phrasebook: every vocab entry in the course, searchable, with audio.
 * Pure content view — no progress writes, works logged out.
 */
export default function WordsPage() {
  const [query, setQuery] = useState("");
  // typing stays instant on slow phones; the ~1k-row list catches up a frame later
  const deferredQuery = useDeferredValue(query);
  const inputRef = useRef<HTMLInputElement>(null);

  const all = useMemo<Indexed[]>(
    () =>
      Object.values(bundle.vocab)
        .map((entry) => {
          const lemma = fold(entry.lemma);
          return {
            entry,
            lemma,
            translation: fold(entry.translation),
            notes: fold(entry.notes ?? ""),
            // first letter, skipping leading punctuation ("'Wag" files under W)
            letter: (lemma.match(/[a-z]/)?.[0] ?? "#").toUpperCase(),
          };
        })
        // section letter first so every section is contiguous, then locale order
        .sort((a, b) =>
          a.letter === b.letter
            ? a.entry.lemma.localeCompare(b.entry.lemma, "fil", { sensitivity: "base" })
            : a.letter < b.letter
              ? -1
              : 1,
        ),
    [],
  );

  // alphabetical sections when browsing; a flat ranked list when searching
  const groups = useMemo(() => {
    const by = new Map<string, VocabEntry[]>();
    for (const w of all) {
      const list = by.get(w.letter);
      if (list) list.push(w.entry);
      else by.set(w.letter, [w.entry]);
    }
    return [...by.entries()];
  }, [all]);

  const q = fold(deferredQuery.trim());
  const results = useMemo(() => {
    if (!q) return null;
    const hits: { entry: VocabEntry; s: number }[] = [];
    for (const w of all) {
      const s = score(w, q);
      if (s >= 0) hits.push({ entry: w.entry, s });
    }
    // Array.prototype.sort is stable, so ties keep alphabetical order
    return hits.sort((a, b) => a.s - b.s).map((h) => h.entry);
  }, [all, q]);

  const clear = () => {
    setQuery("");
    inputRef.current?.focus();
  };

  return (
    <>
      <Header />
      <main className="container" id="main">
        <h1 className="page-title">Phrasebook</h1>
        <p className="page-sub">
          All {all.length.toLocaleString("en-US")} words &amp; phrases from the course. Tap 🔊 to hear them.
        </p>
        <div className="search-field" role="search">
          <input
            ref={inputRef}
            className="search-input"
            type="search"
            inputMode="search"
            enterKeyHint="search"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="none"
            spellCheck={false}
            placeholder="Search Tagalog or English…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              // results filter live; Enter/"Search" just dismisses the phone keyboard
              if (e.key === "Enter") e.currentTarget.blur();
              if (e.key === "Escape" && query) {
                e.preventDefault();
                setQuery("");
              }
            }}
            aria-label="Search words"
            aria-controls="word-results"
          />
          {query && (
            <button type="button" className="search-clear" onClick={clear} aria-label="Clear search">
              <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
              </svg>
            </button>
          )}
        </div>
        <p className="search-count" aria-live="polite">
          {results
            ? results.length > 0
              ? `${results.length.toLocaleString("en-US")} match${results.length === 1 ? "" : "es"}`
              : ""
            : ""}
        </p>
        <div id="word-results">
          {results ? (
            results.length === 0 ? (
              <div className="word-empty">
                <p>No matches for “{deferredQuery.trim()}”.</p>
                <p className="word-empty-hint">Try a shorter word, or search in English.</p>
                <button type="button" className="btn btn-ghost" onClick={clear}>
                  Clear search
                </button>
              </div>
            ) : (
              results.map((v) => <WordRow key={v.id} entry={v} />)
            )
          ) : (
            groups.map(([letter, entries]) => (
              <section key={letter} aria-labelledby={`letter-${letter}`}>
                <h2 className="word-letter" id={`letter-${letter}`}>
                  {letter}
                </h2>
                {entries.map((v) => (
                  <WordRow key={v.id} entry={v} />
                ))}
              </section>
            ))
          )}
        </div>
      </main>
    </>
  );
}

// memo: entries are stable bundle objects, so typing never re-renders a row
const WordRow = memo(function WordRow({ entry }: { entry: VocabEntry }) {
  return (
    <div className="word-row">
      <button
        type="button"
        className="word-audio"
        onClick={() => void playAudio(entry.audio, entry.lemma)}
        aria-label={`Play audio for ${entry.lemma}`}
      >
        🔊
      </button>
      <div className="word-main">
        <p className="word-lemma" lang="tl">
          {entry.lemma}
        </p>
        <p className="word-translation">{entry.translation}</p>
        {entry.notes && <p className="word-notes">{entry.notes}</p>}
      </div>
    </div>
  );
});
