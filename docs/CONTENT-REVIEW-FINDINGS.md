# Content review — findings and resolution

Ten parallel reviews were run over the 57 units added when the course was
doubled (114 units / 453 lessons / 4,054 exercises). Every reviewer read
`packages/content/src/schema.ts` and `validate.ts` first, so schema and
validator findings reflect the real build rules. All ten reported the
mechanical layer clean: no unknown keys, no `grading` on `choice`/`match`,
every `translate` with exactly one direction pair, every dialogue's `___`
count matching its `blanks`, every `options` list containing its answer, no
duplicate ids, tier contiguity intact.

**Status: all confirmed defects have been applied and the course recompiles
clean** (`pnpm content:build` → 4 tiers, 114 units, 453 lessons, 4,054
exercises). The sections below record what was changed and why, so a fluent
reviewer can audit the calls.

## Grammar and orthography fixes applied

- **`ng`/`nang` before durations and clock times** — `nang alas-sais`,
  `nang tatlong taon`, `nang dalawang oras/linggo` (18h, 35a, 35q, 51a, 51c,
  51d).
- **`paki-` requests take a definite `ang`-patient**, matching
  `34-commands.yaml`: `Pakiabot po ang asin`, `Pakisara po ang pinto`,
  `Pakiulit po ang aralin`, `Pakiwalis po ang sahig`, `Pakihugas po ang
  pinggan` (18e, 18j, 35e, 35q). Indefinite patients keep `ng`
  (`pahingi po ng tubig`, `pahiram po ng asin`).
- **Missing/wrong linkers** — `limang minutong lakad`, `manggang ito`,
  `bihira naming bilhin`, `kalabasang binili` (restructured), `sabong
  panghugas`, `natirang tiket`, `Handa po akong mag-overtime`, `Dapat sana
  akong nag-aral/pumunta`, `Araw-araw akong naglalakad`, `Minsan lang akong
  pumupunta`, `Apatnapu't walong piso` (bad accept dropped),
  `Dalawampu't limang taon na ako`.
- **Double linkers removed** — `paupahang (na) kuwarto`, `huling (na) araw`,
  `dalawang (na) buwan` (51b, 35n).
- **`daan` → `raan` after vowel-final `na`** (`apat na raan`, `anim na
  raan`), matching the rule 35n itself teaches.
- **Solid vs hyphenated prefixes** — `maghatinggabi` (mag- is solid before a
  consonant), `taglamig`/`taggutom` (tag- hyphenates only before vowels), and
  the KWF teen forms: `labindalawa`, `labintatlo`, `labinlima`, `labimpito`,
  `labingwalo`, `labinsiyam` — the hyphen surviving only before vowels
  (`labing-isa`, `labing-apat`, `labing-anim`). The 18b tip now states the
  assimilation rule.
- **Aspect corrections** — `Dumadaan ba ito?` (habitual, not completed),
  `naiintindihan` (present, not `naintindihan`), `Uuwi na ako` glossed as
  "I will go home now", dialogue gloss "I will do laundry today" for
  contemplative `Maglalaba`.
- **Focus/case fixes** — `Isulat mo ang pangalan mo` (object-focus verb takes
  `mo`, not `ka`); `tinawagan ko ka` accept replaced with the obligatory
  `kita` contraction; `Kakaalis lang niya` (recent-past takes a genitive
  actor, resolving the 51m self-contradiction).
- **`kasing-` comparand takes `ng`** — `Kasinglaki ng bag ko ang bag mo`;
  English calques (`ang isang iyon`, `ang Palawan na isla`) removed (51n).
- **Causative corrections** — the reversed `Magpagising po kayo sa akin`
  replaced with `Pakigising po ninyo ako`; redundant `magpagupit ng buhok`
  trimmed (51c, 51k).
- **Wrong glosses fixed** — `paalam` ≠ permission (→ `pahintulot`),
  `pumapasok` ≠ arriving (→ `dumarating`), `simsimba` (not a word, →
  `magsimba`), `tulungan` = help someone (not "one another"), `hati` →
  `maghati`, `kantahan` = to sing for someone, `sunod` → `susunod`,
  `bilang` ≠ quantity (→ `dami`), `biyenan`/`manugang` glossed
  gender-neutrally, "Ben is my niece" accept dropped, `mag-ingat sa
  kalusugan` ("beware of your health") → `Alagaan mo ang kalusugan mo`,
  praying *for* someone is `ipagdasal` (not `pakidasal`).
- **False facts corrected** — `gatas` is native, not Spanish (18c);
  `de-lata`/`de-bote` are Spanish, not native, and the form is `de-bote`
  (35h); `tatsulok`/`parisukat` are native, `kuwadrado` is the loanword
  (35i); spiders are not insects (18n); the Bathala etymology for *bahala
  na* is now "popularly traced" rather than asserted (51o).
- **Tips that contradicted their own examples rewritten** — 51i (sana never
  changes; the verb carries the regret: `Sana makapunta ka` vs `Sana
  nakapunta ka`), 51m (the colloquial `kaka-` generalisation is now stated
  alongside the textbook reduplicated form, and the genitive-actor norm is
  noted), 51n (`kasing-` is a prefix, nothing doubles), 35j (frequency-word
  placement), 18f (`-an` place-nouns, not verbs), 35g (Tagalog affixes on
  English roots, not the reverse).
- **Broken or self-answering items reworded** — the 51m/51p double-verb
  blanks (`Kakadating lang ako dumating`), the 51p blank none of whose
  options fit (now `Umuulan ___ hapon` → `tuwing`), the 51j subordinate
  clause with no main clause (now `___ hapon, umuulan ngayong buwan`), the
  51n blank that stated the size twice, 18b's blank that contained its own
  answer, 18d's circular `Maalat ang itlog na maalat`, and 35q's `Deadline
  po ang bayarin` ("the bill is a deadline").
- **Ambiguous items disambiguated** — `Kapag` removed as a defensible answer
  where `Kung` was keyed (51j); `gitna and dulo` removed as a second valid
  opposite pair (35m); "every week" removed as a valid gloss of *tuwing
  Linggo* (35j); the 51k "how many things" count question reworded; bound
  prefixes (`Pinaka`, `Kasing`) no longer appear as standalone options or
  word-bank chips (51n).
- **Register consistency** — `Sumama ka sa akin` (not clipped `Sama ka`) in
  the unit that teaches -um- imperatives; `Magkita tayo` promoted over
  clipped `Kita tayo`; `Mali po yata ang numero` promoted over the
  informal-`po` mix; ungrammatical distractors in the 51a register item
  repaired so only register separates the choices.

## Item-design fixes applied

- **Identity match pairs replaced** (they graded as freebies): juice→katas,
  appointment→tipanan, form→pormularyo, deadline→takdang araw,
  overtime→lagpas sa oras, resume→panayam (interview), curfew→oras ng
  pag-uwi, elevator→hagdanan (staircase), gate→hintayan (waiting area).
- **Pre-solved duplicates varied** — translate/arrange (and listen) pairs
  that shared the exact same sentence within one lesson now differ (35b,
  35c, 35d ×2, 35l, 35p).
- **No-op grading flags dropped** where `hyphens: true` sat on a translate
  whose graded answer is the English side (35a, 35b, 35c).
- **`"no"` distractor quoted** defensively against YAML 1.1 parsers (35a).

## Core change

`packages/core/src/achievements.ts` gained four end-game badges sized for the
453-lesson course — `lessons_300`, `perfects_50`, `xp_10000`, `streak_365` —
with boundary tests. The previous ceiling (`lessons_150`, `xp_2000`) sat
about a third of the way through the doubled course.

## Left as-is, deliberately

- **`sipit`** for clothes-peg (35f): regionally standard; `ipit` noted as an
  alternative but not worth churning.
- **Nominative `ako/kami` with `kaka-` forms** in some 51m/51p items: real
  colloquial variation, now acknowledged in the 51m tip rather than
  flattened.
- **Taglish loans** (`check-in`, `gate`, `boarding`, `load`, `lowbat`,
  `promo`, `resume`): kept — they are how these domains are actually spoken.
- A handful of "lower confidence" reviewer suggestions that were stylistic
  rather than wrong (e.g. `35g` "Saan po ang tirahan ninyo?" vs "Ano po…" —
  both occur).

> A fluent speaker's pass is still recommended; these reviews were
> model-driven, and judgment calls (teen orthography, `kaka-` policy,
> `paki-` case marking) are documented above precisely so they can be
> revisited in one place.
