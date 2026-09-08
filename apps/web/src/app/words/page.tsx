"use client";

import { useEffect, useMemo, useState, useDeferredValue } from "react";
import { normalizeSearch, searchVocab, type VocabEntry } from "@aral/core";
import { ContentLoadError } from "@/components/ContentLoadError";
import { Header } from "@/components/Header";
import { playAudio } from "@/lib/audio";
import { loadVocabulary } from "@/lib/content";

const PAGE_SIZE = 40;
export default function WordsPage() {
  const [query, setQuery] = useState("");
  const [letter, setLetter] = useState("");
  const [page, setPage] = useState(0);
  const [all, setAll] = useState<VocabEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  const deferredQuery = useDeferredValue(query);
  useEffect(() => {
    let active = true;
    setLoading(true); setError(false);
    void loadVocabulary().then(({ vocab }) => {
      if (!active) return;
      const collator = new Intl.Collator("fil", { sensitivity: "base" });
      setAll(Object.values(vocab).sort((a, b) => collator.compare(a.lemma, b.lemma)));
      setLoading(false);
    }).catch(() => { if (active) { setError(true); setLoading(false); } });
    return () => { active = false; };
  }, [retry]);
  const letters = useMemo(() => [...new Set(all.map((entry) => normalizeSearch(entry.lemma)[0]?.toUpperCase()).filter(Boolean))], [all]);
  const shown = useMemo(() => searchVocab(all, deferredQuery).filter((entry) => !letter || normalizeSearch(entry.lemma).startsWith(letter.toLowerCase())), [all, deferredQuery, letter]);
  const pages = Math.max(1, Math.ceil(shown.length / PAGE_SIZE));
  const activePage = Math.min(page, pages - 1);
  const start = activePage * PAGE_SIZE;
  const clear = () => { setQuery(""); setLetter(""); setPage(0); };
  return <>
    <Header />
    <main id="main-content" tabIndex={-1} className="container">
      <h1 className="page-title">Phrasebook</h1>
      <p className="page-sub">{loading ? "Loading your" : all.length.toLocaleString()} words and phrases for everyday Tagalog. Listen, look up a meaning, and try saying it aloud.</p>
      {loading && <p role="status">Loading phrasebook…</p>}
      {error && <ContentLoadError title="Could not load the phrasebook" retryLabel="Retry phrasebook" onRetry={() => setRetry((n) => n + 1)} />}
      {!loading && !error && <>
      <label className="field-label" htmlFor="word-search">Find a word or phrase</label>
      <input id="word-search" className="search-input" type="search" placeholder="Search Tagalog or English…" value={query}
        onChange={(event) => { setQuery(event.target.value); setPage(0); }} aria-label="Search words" />
      <div className="letter-filters" role="group" aria-label="Filter by first letter">
        {["", ...letters].map((value) => <button key={value} aria-pressed={letter === value} onClick={() => { setLetter(value!); setPage(0); }}>{value || "All"}</button>)}
      </div>
      <p className="search-summary" role="status">{shown.length.toLocaleString()} results{shown.length > 0 && <> · Showing {start + 1}–{Math.min(start + PAGE_SIZE, shown.length)}</>}
        {(query || letter) && <> · <button className="text-button" onClick={clear}>Clear filters</button></>}
      </p>
      {shown.length === 0 && <div className="card word-empty"><h2>No matching words</h2><p>Try a shorter word, an English meaning, or another letter.</p><button className="btn btn-ghost" onClick={clear}>Show all words</button></div>}
      {pages > 1 && <nav className="unit-pages" aria-label="Phrasebook pages">
        <button className="btn btn-ghost" disabled={activePage === 0} onClick={() => setPage(activePage - 1)}>Previous words</button>
        <label className="page-picker">Page <select aria-label="Phrasebook page" value={activePage} onChange={(event) => setPage(Number(event.target.value))}>
          {Array.from({ length: pages }, (_, index) => <option value={index} key={index}>{index + 1} of {pages}</option>)}
        </select></label>
        <button className="btn btn-ghost" disabled={activePage + 1 >= pages} onClick={() => setPage(activePage + 1)}>Next words</button>
      </nav>}
      {shown.slice(start, start + PAGE_SIZE).map((entry) => <WordRow key={entry.id} entry={entry} />)}
      </>}
    </main>
  </>;
}

function WordRow({ entry }: { entry: VocabEntry }) {
  const [unavailable, setUnavailable] = useState(false);
  const listen = async () => {
    setUnavailable(false);
    try { setUnavailable(!await playAudio(entry.audio, entry.lemma)); }
    catch { setUnavailable(true); }
  };
  return <div className="word-row">
    <button className="word-audio" onClick={() => void listen()} aria-label={"play audio for " + entry.lemma} title="Play pronunciation">🔊</button>
    <div className="word-main">
      <p className="word-lemma" lang="fil">{entry.lemma}</p>
      <p className="word-translation">{entry.translation}</p>
      {entry.notes && <p className="word-notes">{entry.notes}</p>}
      {unavailable && <p className="word-notes" role="status">Audio is unavailable on this device. You can still practice with the written phrase.</p>}
    </div>
  </div>;
}
