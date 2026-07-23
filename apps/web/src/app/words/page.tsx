"use client";

import { useMemo, useState } from "react";
import type { VocabEntry } from "@aral/core";
import { Header } from "@/components/Header";
import { playAudio } from "@/lib/audio";
import { bundle } from "@/lib/content";

/**
 * Phrasebook: every vocab entry in the course, searchable, with audio.
 * Pure content view — no progress writes, works logged out.
 */
export default function WordsPage() {
  const [query, setQuery] = useState("");

  const all = useMemo(
    () =>
      Object.values(bundle.vocab).sort((a, b) =>
        a.lemma.localeCompare(b.lemma, "fil", { sensitivity: "base" }),
      ),
    [],
  );

  const q = query.trim().toLowerCase();
  const shown = q
    ? all.filter(
        (v) =>
          v.lemma.toLowerCase().includes(q) ||
          v.translation.toLowerCase().includes(q) ||
          (v.notes ?? "").toLowerCase().includes(q),
      )
    : all;

  // group by first letter for scannability (search results stay flat)
  const groups = useMemo(() => {
    if (q) return null;
    const by = new Map<string, VocabEntry[]>();
    for (const v of shown) {
      const letter = (v.lemma[0] ?? "#").toUpperCase();
      if (!by.has(letter)) by.set(letter, []);
      by.get(letter)!.push(v);
    }
    return [...by.entries()];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, all]);

  return (
    <>
      <Header />
      <main className="container">
        <h1 className="page-title">Phrasebook</h1>
        <p className="page-sub">
          All {all.length} words &amp; phrases from the course. Tap 🔊 to hear them.
        </p>
        <input
          className="search-input"
          type="search"
          placeholder="Search Tagalog or English…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search words"
        />
        {shown.length === 0 && <p className="word-empty">No matches for “{query}”.</p>}
        {groups
          ? groups.map(([letter, entries]) => (
              <section key={letter}>
                <h2 className="word-letter">{letter}</h2>
                {entries.map((v) => (
                  <WordRow key={v.id} entry={v} />
                ))}
              </section>
            ))
          : shown.map((v) => <WordRow key={v.id} entry={v} />)}
      </main>
    </>
  );
}

function WordRow({ entry }: { entry: VocabEntry }) {
  return (
    <div className="word-row">
      <button
        className="word-audio"
        onClick={() => playAudio(entry.audio, entry.lemma)}
        aria-label={`play audio for ${entry.lemma}`}
        title="play audio"
      >
        🔊
      </button>
      <div className="word-main">
        <p className="word-lemma">{entry.lemma}</p>
        <p className="word-translation">{entry.translation}</p>
        {entry.notes && <p className="word-notes">{entry.notes}</p>}
      </div>
    </div>
  );
}
