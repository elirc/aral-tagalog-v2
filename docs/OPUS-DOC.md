# Opus session record — app hardening + 3× content expansion

Written for a reviewer who was not present. Every change is stated with the
**defect**, the **fix**, **why it was done that way**, and **how it was
verified**. Where something is uncertain, unverified, or deliberately left
undone, it says so — those parts are flagged **⚠ REVIEW** and are the places
worth your attention first.

Scope of this session: review the whole app and fix what's real, review all
existing course content, and roughly triple the course with an emphasis on
reinforcing foundational material.

**Result:** 51 units / 201 lessons / **1,788 exercises** (from 584 — 3.06×),
576 vocabulary entries, 147 unit tests + 33 live end-to-end checks, all green.

---

## 0. How the work was done (and where it went wrong)

Work ran as multi-agent workflows: independent finder/reviewer agents, then
*separate* adversarial judges that had to confirm a finding before it was
acted on. Two things went wrong mid-session and both affected results:

1. **Three background jobs were orphaned** when the process restarted (model
   switch). They died silently with no completion record. I recovered their
   partial output from the workflow journals rather than re-running: 26 of 33
   generated units and 7 of 8 review lenses were salvaged, and the generation
   workflow was resumed from its run id so completed agents replayed from
   cache instead of re-running.

2. **⚠ REVIEW — The account hit its monthly spend limit** during the final
   content review. 192 of 253 agents in that workflow failed. This matters for
   a specific reason described in §3.2: my acceptance logic was
   `votes.every(v => v.accept)`, and `[].every()` returns **true**, so edits
   whose judges both died were auto-accepted with **zero** approvals. I could
   not re-run the judges. See §3.2 for exactly what I did about it.

---

## 1. Security and correctness fixes (app)

Findings came from 8 parallel review lenses (40 findings), then the 22
medium/high ones went through 3 independent skeptics each — a professional
skeptic told to refute it, an exploit author who had to produce a concrete
trigger, and a maintainer judging whether it's actually wrong versus a
deliberate trade-off. **16 confirmed by 2-of-3 vote, 6 rejected.** The
rejected ones were dropped, not fixed — see §1.9.

### 1.1 Unlimited XP farming (exploit) — `packages/core/src/events.ts`

**Defect.** The server clamped XP *per event* but nothing capped *repetition*.
A client could re-send completions of one easy lesson with fresh UUIDs and
`practice` omitted; each event passed the clamp at full authored value. A
single request of 500 events was worth ~7,500 XP, loopable within the rate
limit. It also inflated `perfectLessons`, which drives achievements.

**Fix.** A completion of a lesson that is **already completed** is now treated
as a replay regardless of what the event claims: XP clamped to `PRACTICE_XP`,
no perfect-lesson credit, no double completion.

**Why in the reducer and not the API.** `reduceEvents` is the single fold both
clients and the server run, so fixing it there closes the hole everywhere at
once and keeps the two in agreement (they must derive identical state). The
API alternative would have required `sanitizeEvents` — a pure function — to
learn the user's prior progress. The raw client claim is still what gets
stored, so the event log stays an honest record and the *derivation* applies
policy, which is the correct split for event sourcing.

**Verified.** Two new unit tests (including the case where the prior
completion lives in the server baseline rather than the current batch) plus a
live smoke check that farms 3 events at `xp: 100` and asserts +15 total.
Notably, **no existing test needed changing**, which is evidence the change
doesn't disturb legitimate practice flows.

### 1.2 Refresh-token reuse detection logged users out (regression I introduced)

**Defect.** Earlier in this session I added refresh-token families with reuse
detection: replaying a rotated token revokes the whole family. That is correct
against theft but wrong against *benign* races, which are routine — two
browser tabs, or the mobile app's launch-sync racing its foreground-sync.
Both present the same token, one loses, and the user gets silently logged out
of a perfectly good session. Confirmed independently by four separate finders.

A second, subtler bug rode along (finding 0, confirmed 2/3): the losing
request's family `DELETE` could land *after* the winner's successor `INSERT`,
leaving a live token in a family that was supposed to be revoked — the exact
opposite of the security property intended.

**Fix.** A grace window (`REFRESH_REUSE_GRACE_MS`, default 60s, env-tunable).
Replaying a token rotated within the window returns **409** and revokes
nothing; the loser simply retries later. Replaying it *after* the window still
revokes the family. The claim-loser branch now never revokes at all — losing
the atomic claim means someone rotated milliseconds ago, which is by
definition the benign case — which also removes the delete-after-insert race.
Reuse detection now runs *before* the expiry check, so replaying a rotated
token that has since expired still revokes (previously it returned a plain 401
and let the leak stand).

**Why 409 and not 401.** Both clients treat 401-on-refresh as "session dead"
and surface a re-login prompt. 409 flows through their existing
"non-401 → transient error, retry later" path with no code change and no user
disruption.

**Verified.** Smoke asserts the full sequence: rotate → replay old token gets
409 → **the new token still works** (family alive) → logout → refresh 401.
⚠ REVIEW: the post-grace *revocation* path is not covered by smoke, because
covering it means waiting 60s or manipulating `rotated_at` in the database.
The window is env-tunable (`REFRESH_REUSE_GRACE_MS=0`) specifically so this
can be exercised; I did not add that run.

### 1.3 Concurrent syncs (clients)

**Defect.** Nothing prevented two `/sync` calls in flight at once. On mobile,
three separate triggers (launch, debounce, foreground) can fire together. Two
consequences: both hit 401 on an expired access token and double-present the
same refresh token (§1.2), and an older server snapshot could be applied last,
reverting progress that the other response had already banked.

**Fix.** A single-flight guard on both clients: `syncNow` returns immediately
if a sync is already running.

**Why this instead of response sequencing.** With one request in flight there
is no out-of-order response to sequence, so the same guard fixes both symptoms
with materially less state. Events are never lost by skipping a sync — they
stay in the outbox and the next sync sends them.

⚠ REVIEW: this does **not** fix the cross-*tab* case on web (two tabs are two
JS contexts sharing one localStorage token). The server-side grace window is
what makes that survivable now. A full fix needs `BroadcastChannel` or a
storage-event lock; I judged that out of proportion given the grace window
already prevents the user-visible harm.

### 1.4 Malformed timestamp could wedge a client forever

**Defect.** `occurredAt` was a bare `z.number()`. Zod accepts `1.5` and `1e30`;
`occurred_at` is a `bigint` column, so Postgres rejects them on INSERT. Because
`/sync` inserts the batch in one statement, one malformed event 500s the entire
request — and clients only clear their outbox on a 200, so that single event
would poison the outbox and retry forever. This is precisely the poison-message
failure the per-event `rejected` list exists to prevent.

**Fix.** `z.number().int().min(0).max(Number.MAX_SAFE_INTEGER)` on every
event's timestamp, so a bad value is rejected individually and its healthy
siblings still land.

**Verified.** A unit test sweeping `1.5`, `-1`, `MAX_SAFE_INTEGER + 2`,
`Infinity`, and `NaN`, each asserting the sibling event survives; plus a live
smoke check that a fractional timestamp returns 200 with `accepted: 1`.

### 1.5 Rate limiting collapsed to one global bucket behind a proxy

**Defect.** (Confirmed 3/3.) Fastify was built without `trustProxy`, so
`req.ip` is the TCP peer. Behind any reverse proxy — and the README
specifically recommends Fly.io/Railway, which always proxy — every user shares
one rate-limit key. The auth limit of 10/minute then applies to the *entire
user base*: ten bad login attempts lock out everyone.

**Fix.** `trustProxy` wired to a new `TRUST_PROXY` env var, documented in
`.env.example` and the README with the reason it must stay **off** for a
directly-exposed server (otherwise clients spoof `X-Forwarded-For` to get their
own bucket).

### 1.6 Completion screen rewrote itself after a first-time completion

**Defect.** The `practice` flag was derived live from
`progress.completedLessonIds`. Finishing a lesson adds it to that list, so the
summary screen the player was *already showing* flipped to "+5 XP · +1 ❤️ for
practicing" over what was actually a first-time completion.

**Fix.** `practice` is frozen at entry via a ref on both clients.

### 1.7 Logging in as a different account inherited the previous user's data

**Defect.** After a session expired, logging in as a *different* account
pushed the previous user's unsynced outbox into the new account and kept its
baseline.

**Fix.** `adoptAuth` compares user ids; on a genuine switch it drops the outbox
and baseline first. Coming from guest (`auth === null`) still carries over —
that's the point of guest mode and is preserved deliberately.

### 1.8 Smaller confirmed fixes

- **Partial audio downloads** (mobile): an interrupted download left a
  truncated file that looked like a finished recording and permanently
  shadowed both the network URL and the TTS fallback. Now anything that isn't
  a clean 200 — including a throw mid-write — is deleted.
- **Audio button gave away the answer**: `translate` exercises in the
  `base_to_target` direction (English prompt → build the Tagalog) shipped a
  play button whose clip *is* the answer. The compiler now attaches audio only
  to the `target_to_base` direction; the ref stays registered so the
  phrasebook and TTS still have it.

### 1.9 Findings deliberately NOT fixed (rejected by verification)

Recorded so nobody re-litigates them:

| Finding | Why rejected |
| --- | --- |
| Lesson catalog cached at startup goes stale | 0/3. Version skew is already handled (unknown ids clamp to catalog max) and nothing hot-swaps content under a running API. Documented in the README instead. |
| `missed/masteredExerciseIds` not validated against the catalog | 1/3. Abuse only affects the attacker's own account, and any client can already post 500 arbitrary events, so the check closes nothing. |
| Mobile `check()` missing a phase guard | Rejected — the guard exists via other state. |
| `fill_blank` allows multiple blanks | Rejected as theoretical; no authored content does it. |
| `regAudio` drops conflicting audio texts | Rejected; first-registration-wins is intentional and documented in-code. |

---

## 2. Scale and quality work caused by 3× content

### 2.1 Mobile course map was not viable at 51 units

It rendered every unit and all 200+ lesson rows eagerly in a `ScrollView`.
Now a virtualized `FlatList`.

This also fixed a **latent correctness bug**: the "next lesson" marker used a
mutable flag (`let nextFound = false`) mutated during a sequential `.map()`.
Under virtualization `renderItem` is not called in order — or at all until
scrolled to — so the marker would have landed on the wrong lesson. It is now
computed up front with `useMemo`.

Mobile also gained the **"Continue" hero card** that web already had, which
matters far more at 51 units: without it a learner 30 units deep must scroll
the entire map to find where they left off.

### 2.2 Content pipeline hardening

- **Duplicate unit ids** were never checked (lessons, exercises, and vocab
  were). Two units sharing an id render as separate course-map cards whose
  progress is computed from the wrong lesson set. Now a build error, with a test.
- **Un-speakable audio refs**: the compiler now warns when a ref has *neither*
  a recording nor spoken text, i.e. TTS cannot voice it either. Currently zero.
- **Bundle minified.** It was pretty-printed at 930 KB even though `dist/` is
  gitignored — the indentation bought nothing and doubled every mobile
  download. Now 628 KB at 51 units, i.e. **smaller than the old 18-unit file**
  despite 3× the content.

### 2.3 Achievement end-game

Every badge was tuned for 69 lessons; at 201 a learner would max the entire set
around 25% completion with 150 lessons left. Added three tier-3 badges sized to
the real course: 150 lessons, a 100-day streak, and *Tagumpay!* for completing
every lesson.

### 2.4 Web bundle size — measured, not assumed

Tripling the content risked bloating the web app, since it imports the bundle
at build time. Measured instead of guessing: **First Load JS is 228 kB gzipped**
at 44 units (~245 kB projected at 51), against a 102 kB shared baseline. That is
within budget, so the build-time import stays and the app keeps working fully
offline. No code-split was needed. Numbers are in the session log if you want
to re-derive them; re-check if the course grows again.

---

## 3. Course content

### 3.1 Existing 18 units — reviewed and corrected

19 reviewers (one per unit file + vocab), each proposed edit audited by **two
independent linguists**, and only unanimous ones applied: **42 edits**.

The recurring theme was *correct answers being marked wrong*: missing `po`
variants, missing he/she alternates for `siya`, and the predicate-initial word
order (`Nanay ko siya` alongside `Siya ang nanay ko`) that the course teaches
elsewhere but didn't accept.

Genuine errors fixed included a **factually wrong grammar note** (numbers were
documented as always taking the `-ng` linker; consonant-final numbers take
separate `na` — as written it taught learners to say *apatng itlog*), a
mistranslation (`pumunta sa bahay` glossed as "went home", which is `umuwi`),
and enclitic-pronoun placement after a fronted adverbial.

**Follow-on defects I found and fixed beyond the accepted list**, because the
applier agent reported them:

- **Three exercises that could not be failed.** Units 05, 08, and 10 each had a
  fill-blank whose entire purpose is choosing `nang` vs `ng`, while carrying
  `grading: { ng_nang: true }` — the flag that normalizes the two into each
  other. Both options graded correct. (The reviewers had caught exactly this in
  unit 07; it simply existed in three more places.) I left the fourth instance
  in `03-food` alone: its hint explicitly says "we'll accept both", so there
  the leniency is disclosed and intentional.
- The fronted-adverbial fix was accepted for unit 05 but its **identical twins
  in units 04 and 07** weren't in the list; both now match, including renaming
  unit 04's audio ref to track its new sentence.
- Unit 16 glossed `damit` as "dress" in two places while its own vocab entry,
  unit tip, and match pairs all say "clothes" — and the unit already uses the
  correct word `bestida` for dress. Fixed, keeping the old wordings as
  *accepted* answers so nobody who learned the earlier phrasing is punished.
- For `magulang` I took an **additive** route rather than overriding a judged
  decision: the reviewed gloss ("parent") stays and a note explains that
  `mga magulang` is how you say parents, which makes unit 06's plural usage
  correct rather than contradictory.

### 3.2 ⚠ REVIEW — the 33 new units' review is only partly judged

This is the weakest link in the session and deserves your scrutiny.

33 reviewers proposed edits; each should have been audited by two linguists.
**The spend limit killed 192 of 253 agents**, and because my acceptance check
was `votes.every(v => v.accept)` — which is vacuously `true` for an empty vote
array — edits whose judges both died were marked accepted with **zero**
approvals. 105 edits came back "accepted" against only 5 rejected, which is
itself a signal that most judging never happened. **I cannot tell you which of
the 105 were genuinely judged.**

What I did instead of blindly trusting or blindly discarding them:

1. **Applied them deterministically, not by model.** `scripts/apply-content-edits.mjs`
   does literal `current` → `proposed` replacement, requires the target to
   appear **exactly once** (ambiguous matches are skipped, not guessed),
   re-indents the replacement to match, and is idempotent. 101 of 105 applied;
   4 skipped safely.
2. **Used the compiler's semantic validator as the mechanical backstop.** Any
   edit that broke word-bank solvability, duplicated a distractor, or removed
   an option's answer would fail the build. None did.
3. **Caught a real failure this way.** One reviewer's `proposed` field
   contained *prose instructions* ("delete the line `accept: [...]`") rather
   than YAML; the script pasted it in and the build broke immediately. I read
   the intent (a `listen` exercise's transcription must match its audio, so
   accepting a different sentence teaches mishearing), applied it properly to
   both affected exercises, and then swept every unit for other injected prose
   — one hit, which turned out to be a legitimate unit tip.

**What is still unverified:** an edit that is linguistically wrong but
structurally valid would have shipped. The categories at risk are the ones that
change answers — `wrong-translation` (9), `grammar-error` (5),
`unnatural-phrasing` (6), `bad-distractor` (5). The other 76 are
`missing-accept` (40, which can only make grading *more* lenient and can never
mark a correct learner wrong), `factual-note` (27, prose in tips), and
`grading-flag` (13, the same defect class I hand-verified in §3.1).

**Recommended follow-up:** re-run the judge pass over those 25 answer-changing
edits when budget allows. The workflow is resumable — completed agents replay
from cache, so only the failed judges re-run.

### 3.3 The new curriculum (33 units)

Sized deliberately: 24 topic units + **9 reinforcement units**, because the
brief emphasized reinforcing foundations.

**Foundational grammar the original course never taught** — this was the real
gap, since the first 18 units taught vocabulary and set phrases but not the
machinery to generate sentences:

`verbs-um-mag` (UM/MAG actor-focus families, completed vs incompleted aspect),
`future-aspect` (contemplated aspect via syllable reduplication),
`past-stories` (narrative chaining), `pronouns-possession` (possessive and
sa-pronouns), `linkers` (the na/-ng system), `particles` (na, pa, lang,
din/rin, ba, naman, daw/raw and second-position placement), `comparisons`
(mas/pinaka-/kasing-), `commands` (imperatives and paki- requests), and
`questions`.

**Reinforcement units** recycle earlier vocabulary in longer recombinations
with hard caps on new words (`review-basics`, `review-food-market`,
`review-actions-time`, `review-home-town`, `review-descriptions`,
`review-questions-particles`, `review-verb-forms`, `review-social`, and a
capstone `grand-review` that introduces **zero** new vocabulary).

Remaining topical units cover transportation (jeepney etiquette), restaurants,
money and bargaining, days/months, describing people, the doctor, technology,
kitchen/cooking, fruits and vegetables, love and relationships, jobs, sports,
beach and islands, city vs province, and emergencies.

**Vocabulary merge.** 335 entries were proposed; 292 added, **43 correctly
rejected as duplicates** — several units independently proposed common words
(`sino`, `na`, `rin`). That collision is exactly what would previously have
silently dropped entries, since the bundle builds vocab as a keyed map.
`scripts/merge-vocab.mjs` dedupes on both id and lemma and is idempotent.

---

## 4. Verification

| Layer | Result |
| --- | --- |
| Unit tests | **147 passing** — core 93, API 29, content 25 |
| Turbo pipeline | 13/13 tasks green (typecheck + test + build, all packages) |
| End-to-end smoke | **33/33** against real Postgres + a live API |
| Content compile | 51 units / 201 lessons / 1,788 exercises, zero validation failures |
| Web production build | builds and serves; all routes verified earlier in session |

New tests added this session cover: the XP-farming clamp (2), timestamp
poison-pill rejection (1), duplicate unit ids (1), course-completion achievement
(2), and the new smoke checks for farming, poison batches, and the refresh
grace window (7).

`docs/TESTING.md` explains what each test guards and why — worth reading
alongside this document, since several tests encode bugs that would otherwise
look like arbitrary assertions.

⚠ REVIEW — **not verified:** the mobile app was type-checked but never run.
There is no mobile test suite, and I did not launch Expo. The dark-mode
refactor, the `FlatList` rewrite, and the review-mistakes flow are all
unexercised at runtime on that platform.

---

## 5. Known gaps and honest caveats

1. **§3.2 is the big one** — 25 answer-changing content edits shipped without
   confirmed linguistic judging.
2. **No audio recordings exist.** All 1,207 refs fall back to device TTS by
   design (AUD-02). Every ref does have spoken text, so nothing is silent.
3. **Mobile is untested at runtime** (§4).
4. **Cross-tab refresh on web** is mitigated server-side, not fixed
   client-side (§1.3).
5. **Post-grace token revocation** is not covered by an automated test (§1.2).
6. **The API caches the lesson catalog at startup**, so content deploys need an
   API restart. Verification judged this acceptable and it is documented in the
   README, but it is a real operational footgun.
7. **Content is still machine-authored.** It has been reviewed by native-level
   agents, not a human fluent speaker. For a shipping product I would still
   want one pass by a real Tagalog speaker, particularly over the 33 new units.
