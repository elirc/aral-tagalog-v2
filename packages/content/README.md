# @aral/content

Course sources (YAML) + compiler. Content is authored here, validated with Zod,
and compiled into an immutable versioned bundle that both clients and the API use.

```
course/en-tl/
  course.yaml        # course meta: langs, version, title, difficulty tiers
  vocab.yaml         # shared vocabulary (audio + translations, CNT-02)
  units/NN-slug.yaml # one file per unit, lessons inline, `tier:` names its track
audio/en-tl/         # <audio_ref>.mp3 clips (recorded or TTS-generated)
```

## Build

```sh
pnpm --filter @aral/content build
```

Produces `dist/`:
- `course_en_tl.json` + `course_en_tl_v<version>.json` — the CourseBundle
- `manifest.json` — `{ courseId, version, bundle, audio }`
- `audio_texts.json` — audio ref → Tagalog text (for TTS generation)

## Authoring cheatsheet

Exercise types (see `src/schema.ts` for the full schema):

```yaml
- type: choice          # multiple choice
  prompt: "'Kape' means..."
  answer: Coffee
  distractors: [Milk, Water]
  audio: kape           # optional audio ref

- type: translate       # tap-the-words; direction inferred from fields
  prompt_tl: Kumusta ka?     # tl->en ...or use prompt_en + answer_tl for en->tl
  answer_en: How are you?
  accept: [How are you doing?]   # optional alternates
  extra_words: [good, thanks]    # distractor words added to the bank
  grading: { ng_nang: true, hyphens: true }  # Tagalog tolerance flags (CNT-04)

- type: listen          # tap what you hear (audio required)
  audio: kumusta_ka
  answer_tl: Kumusta ka

- type: match           # match pairs
  pairs: [{ tl: aso, en: dog }]

- type: fill_blank      # sentence with ___; options make it buttons
  sentence: "Magandang ___!"
  answer: umaga
  options: [umaga, gabi]

- type: arrange         # word order: scrambled answer words, no distractors
  prompt: "I will go to the market tomorrow."   # the English meaning
  answer_tl: Pupunta ako sa palengke bukas
  accept: [Bukas pupunta ako sa palengke]
  # `tokens:` is optional — the compiler scrambles the answer deterministically
  # and re-rolls if the shuffle lands in answer order

- type: dialogue        # conversation/passage; each ___ takes the next blank
  intro: At the market
  lines:
    - speaker: Ikaw
      text: "Magkano ___ ang mangga?"
      translation: "How much are the mangoes?"
    - speaker: Tindera
      text: "Otsenta ___ ang isang kilo."
  blanks:
    - answer: po
      options: [po, ba, na]     # omit `options` for a free-text blank
    - answer: piso
      accept: [pesos]
      options: [piso, pera]
```

`arrange` and `dialogue` are the advanced-tier types: one tests syntax with
every word already given, the other tests comprehension across several turns.
The compiler rejects an `arrange` whose tokens are already in answer order, and
a `dialogue` whose blank count doesn't match the `___` in its lines.

Word banks are auto-generated (answer words + `extra_words`, deterministic
shuffle) unless you provide `word_bank` explicitly.

## Difficulty tiers

`course.yaml` declares ordered tiers and every unit names one:

```yaml
# course.yaml
tiers:
  - id: foundation
    title: Foundations
    description: Your first words — greetings, people, food, numbers.
    entry_hint: Start here if Tagalog is completely new to you.
    color: "#4a8f00"

# units/52-idioms.yaml
tier: mastery
```

A tier opens when the previous one is finished, or when a learner places into
it directly (a `tier_started` progress event, written from the course map). The
compiler enforces that every unit names a declared tier and that each tier's
units stay **contiguous** — unlocking is scoped to a tier, so a unit stranded
inside another tier would be reachable in an order the course map never shows.

Omit `tiers:` entirely and the course behaves exactly as it did before tiers:
one flat, linearly unlocked sequence.

## Generated units

Most of the course is generated. `generator/` holds a lexicon and a set of
grammar *focuses*; `pnpm content:generate` crosses every focus with every noun
theme and writes the result into `course/en-tl/units` as ordinary YAML.

```sh
pnpm content:generate                       # rewrite all generated units
node generator/generate.mjs --scale 0.01    # a small sample, for eyeballing
node generator/generate.mjs --clean         # delete them again
node generator/generate.mjs --bump          # also increment course.yaml version
```

```
generator/
  lexicon.mjs      words: nouns (theme + category), verbs (every aspect form
                   written out, plus `objIds` where a verb only takes certain
                   objects), adjectives, numbers, time words
  themes.mjs       41 noun themes: display title, dialogue scene, and the
                   places that theme can plausibly happen in
  grammar.mjs      surface rules: the linker, mga/ang/ng/sa, articles and
                   plurals on the English side, pronoun cases
  makers.mjs       reusable clause builders (clause, baQuestion, command,
                   comparison, objectFocus, joinClauses, …)
  focus-*.mjs      one file per tier; each focus = a grammar point, its tip,
                   four lesson titles, its sentence makers and a Q/A pair that
                   becomes the unit's dialogue
  context.mjs      the word picker handed to makers — keeps a unit thematic
  build.mjs        sentences -> nine exercises per lesson, four lessons per unit
```

Editing rules of thumb:

- **Change the generator, not the generated YAML.** Regenerating overwrites
  every `18t-g*/35r-g*/51q-g*/57g-g*` file. Hand-authored units are never
  touched, and generated unit ids never shadow one.
- Generated files are named so they sort *inside* their tier's run, which is
  what keeps the compiler's tier-contiguity check happy.
- Sentences are deduped course-wide, and each unit is seeded from
  `tier:focus:theme:pass`, so a run is reproducible.
- Every exercise is built through the same checks `validate.ts` enforces, so a
  shape that would fail the build is dropped at generation time instead.

## Audio

1. **Recordings win (AUD-01):** drop `<ref>.mp3` into `audio/en-tl/`.
2. **TTS fallback (AUD-02):** `node scripts/generate-audio.mjs --model <piper-voice.onnx>`
   generates any refs that have no recording, at build time, offline.

Bumping content: edit YAML, increment `version` in `course.yaml`, rebuild.
Clients compare versions via the manifest and re-download (CNT-03).
