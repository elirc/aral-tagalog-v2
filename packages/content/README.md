# @aral/content

Course sources (YAML) + compiler. Content is authored here, validated with Zod,
and compiled into an immutable versioned bundle that both clients and the API use.

```
course/en-tl/
  course.yaml        # course meta: langs, version, title
  vocab.yaml         # shared vocabulary (audio + translations, CNT-02)
  units/NN-slug.yaml # one file per unit, lessons inline
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
```

Word banks are auto-generated (answer words + `extra_words`, deterministic
shuffle) unless you provide `word_bank` explicitly.

## Audio

1. **Recordings win (AUD-01):** drop `<ref>.mp3` into `audio/en-tl/`.
2. **TTS fallback (AUD-02):** `node scripts/generate-audio.mjs --model <piper-voice.onnx>`
   generates any refs that have no recording, at build time, offline.

Bumping content: edit YAML, increment `version` in `course.yaml`, rebuild.
Clients compare versions via the manifest and re-download (CNT-03).
