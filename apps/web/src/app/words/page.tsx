"use client";

import { useMemo, useState } from "react";
import { normalizeSearch, searchVocab, type VocabEntry } from "@aral/core";
import { Header } from "@/components/Header";
import { playAudio } from "@/lib/audio";
import { bundle } from "@/lib/content";

const PAGE_SIZE = 40;
export default function WordsPage() {
  const [query, setQuery] = useState("");
  const [letter, setLetter] = useState("");
  const [page, setPage] = useState(0);
  const all = useMemo(() => Object.values(bundle.vocab).sort((a, b) =>
    a.lemma.localeCompare(b.lemma, "fil", { sensitivity: "base" })), []);
  const letters = useMemo(() => [...new Set(all.map((entry) => normalizeSearch(entry.lemma)[0]?.toUpperCase()).filter(Boolean))], [all]);
  const shown = useMemo(() => searchVocab(all, query).filter((entry) => !letter || normalizeSearch(entry.lemma).startsWith(letter.toLowerCase())), [all, query, letter]);
  const pages = Math.max(1, Math.ceil(shown.length / PAGE_SIZE));
  const activePage = Math.min(page, pages - 1);
  const start = activePage * PAGE_SIZE;
  const clear = () => { setQuery(""); setLetter(""); setPage(0); };
  return <>
    <Header />
    <main id="main-content" tabIndex={-1} className="container">
      <h1 className="page-title">Phrasebook</h1>
      <p className="page-sub">{all.length.toLocaleString()} words and phrases for everyday Tagalog. Listen, look up a meaning, and try saying it aloud.</p>
      <label className="field-label" htmlFor="word-search">Find a word or phrase</label>
      <input id="word-search" className="search-input" type="search" placeholder="Search Tagalog or English?" value={query}
        onChange={(event) => { setQuery(event.target.value); setPage(0); }} aria-label="Search words" />
      <div className="letter-filters" role="group" aria-label="Filter by first letter">
        {["", ...letters].map((value) => <button key={value} aria-pressed={letter === value} onClick={() => { setLetter(value!); setPage(0); }}>{value || "All"}</button>)}
      </div>
      <p className="search-summary" role="status">{shown.length.toLocaleString()} results{shown.length > 0 && <> ? Showing {start + 1}?{Math.min(start + PAGE_SIZE, shown.length)}</>}
        {(query || letter) && <> ? <button className="text-button" onClick={clear}>Clear filters</button></>}
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
    <button className="word-audio" onClick={() => void listen()} aria-label={"play audio for " + entry.lemma} title="Play pronunciation">??</button>
    <div className="word-main">
      <p className="word-lemma" lang="fil">{entry.lemma}</p>
      <p className="word-translation">{entry.translation}</p>
      {entry.notes && <p className="word-notes">{entry.notes}</p>}
      {unavailable && <p className="word-notes" role="status">Audio is unavailable on this device. You can still practice with the written phrase.</p>}
    </div>
  </div>;
}
