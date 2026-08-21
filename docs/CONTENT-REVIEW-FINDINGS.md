# Content review — outstanding findings

Ten parallel reviews were run over the 57 units added when the course was
doubled (114 units / 453 lessons / 4,054 exercises). Every reviewer read
`packages/content/src/schema.ts` and `validate.ts` first, so schema and
validator findings reflect the real build rules.

**Nothing here blocks the build.** All ten reviews reported the mechanical
layer clean: no unknown keys, no `grading` on `choice`/`match`, every
`translate` with exactly one direction pair, every dialogue's `___` count
matching its `blanks`, every `options` list containing its answer, no duplicate
ids, no comma-split flow sequences, tier contiguity intact. The items below are
Tagalog accuracy and item-design defects found by reading the content.

> Not yet verified by a compile — Node was unavailable in the authoring
> session. Run `pnpm content:build` before trusting any of this.

## Already fixed

- `18h-hygiene.yaml` — `ng alas-sais` → `nang alas-sais` (clock time takes *nang*).
- `18j-manners.yaml` — `Paki…abot/sara po **ng**` → `**ang**` (paki- takes a definite *ang*-patient, matching `34-commands.yaml`); `Pakihintay po sandali` demoted, `Sandali lang po` promoted.
- `18k-telling-time.yaml` — `bago mag-___` + `hatinggabi` → `bago ___` + `maghatinggabi` (`mag-` is solid before a consonant); `Huli ka` → `Huli ka na`.
- `18l-seasons.yaml` — `tag-lamig`/`tag-gutom` → `taglamig`/`taggutom` (hyphen only before a vowel-initial root); `Napakaaraw` → `Maaraw na maaraw`; weather accept reworded.

## Outstanding — foundation tier

`18b-numbers-11-100.yaml`
- Teen orthography is nonstandard throughout. Under KWF *Ortograpiyang Pambansa* the `labing-` hyphen survives only before vowels: **labindalawa, labintatlo, labinlima, labimpito, labingwalo, labinsiyam**; only `labing-isa`, `labing-apat`, `labing-anim` keep it. The unit tip also needs rewording to describe the assimilation. *(Judgment call — textbooks vary; worth a native speaker's ruling before churning ~15 lines.)*
- `:89-91` blank gives away its own answer: `"___ ang presyo, animnapung piso."` + `Animnapu`. Shorten to `"___ ang presyo ng isang kilo."`
- `:159` accept `Apatnapu't walo na piso` — vowel-final `walo` needs `-ng` → `walong piso`.
- `:198`, `:213` age phrasing: `Dalawampu't lima na akong taon` → `Dalawampu't limang taon na ako`.

`18c-drinks.yaml`
- `:8-9` false etymology: `gatas` is native, not Spanish. Drop it from the borrowings list.
- `:72` match pair `{ tl: juice, en: juice }` is an identity freebie.
- `:91` accept `…juice may yelo` is missing the linker (`juice **na** may yelo`).

`18d-breakfast.yaml`
- `:169-172` circular item: `Maalat ang itlog na maalat.` tests nothing.

`18e-classroom.yaml`
- `:165-168` focus mismatch: `isulat` is object-focus so its actor is `mo`, not `ka` → `"___ mo ang pangalan mo sa papel."`
- `:194` `Pakiulit po **ng** ___` → `ang` (same paki- rule as 18j).
- `:226` wrong aspect: `naintindihan` (completed) glossed as present → `naiintindihan`.

`18f-furniture.yaml`
- `:8` `tulugan`/`kainan` are `-an` locative nouns, not verbs.
- `:154` accept strands `ng bahay` so it re-attaches to `mga bata`.

`18m-left-right.yaml`
- `:141` wrong aspect: `Dumaan ba ito` (completed) glossed as habitual → `Dumadaan`; rename the audio ref.
- `:82` `limang minuto na lakad` → `limang minutong lakad`.
- `:90` accept splits the locative phrase.

`18n-insects-sea.yaml`
- `:50` calls `gagamba` an insect.

`18o-fruits-basics.yaml`
- `:41` `juice na pinya` is not idiomatic → `pineapple juice`.
- `:91` accept `mangga na ito` → `manggang ito`.
- `:163` `bihira namin bilhin` → `bihira naming bilhin`.

`18p-vegetables-basics.yaml`
- `:168` template forces `kalabasa na binili` → needs `kalabasang binili`; reword the sentence.

`18q-extended-family.yaml`
- `:97` accept "Ben is my niece" grades a contradictory sentence correct.
- `:143` `biyenan` is gender-neutral but the keyed English says "mother-in-law".
- `:152` accept means "has a gift for me", not "gave me a gift".
- `:109` `galing Amerika` → `galing sa Amerika`.
- `:164` `manugang` gloss mismatch.

`18r-coming-going.yaml`
- `:185` `Sama ka` is clipped slang in a unit that teaches `Sumama ka`.
- `:40` contemplative `Uuwi na ako` glossed "I am going home".

## Outstanding — everyday tier

`35a-making-plans.yaml`
- `:62` accept teaches `ng Sabado`; a weekday takes `sa`.
- `:108-109` translation says "at your house" but the Tagalog says only `sa bahay`.
- `:209` `Kita tayo` is clipped; the unit teaches `magkita`.
- `:52` quote the `no` distractor defensively (safe under YAML 1.2, a boolean under 1.1).

`35b-on-the-phone.yaml`
- `:41` mixes informal `sa tingin ko` with `po`.

`35d-errands.yaml`
- `:195` `sunod` → `susunod` for "next" (plus the four dependent items).
- `:84` clumsy `Deadline na bukas ng bayarin`.
- `:145` accept `Magkano ang padala nito` means "how much is its remittance".

`35e-household-chores.yaml`
- `:71`, `:105-108` `sabon panghugas` → `sabong panghugas` (linker), matching `35f`'s `sabong panlaba`.
- `:193` `tulungan` = "to help someone"; "help one another" is `magtulungan`.
- `:194` `hati` is a noun; the verb drilled is `maghati`.
- `:47` vs `:60` same lesson marks the same verb `ng` then `ang`.

`35f-laundry.yaml`
- `:175-176` contemplative `Maglalaba` glossed "I am doing laundry".
- `:71` `sipit` is primarily tongs; the standard peg word is `ipit`/`pang-ipit`.

`35g-delivery.yaml`
- `:73` bare `tabi ng` is unusable → `katabi ng` (which the unit itself drills).
- `:6-7` tip states the borrowing direction backwards; "mag-cash on delivery" is not a real form.
- `:19` `bilang` is "number/count", not "quantity".

`35h-grocery.yaml`
- `:8` calls `de-lata`/`de-bote` native; both are Spanish. Form is `de-bote`, not `de-boteng`.
- `:172-173` `May natitira **na** ba` → `pa`, and the English contradicts Ben's reply.

`35i-shapes-sizes.yaml`
- `:8` `tatsulok` and `parisukat` are native, not loanwords.
- `:156-157` `huwag mong hawakan nang mabilis` is a non sequitur.

`35j-frequency.yaml`
- `:103` `Araw-araw ako naglalakad` needs the linker → `akong` (correct at `:187`).
- `:6-7` tip's placement rule is contradicted by its own examples.
- `:109` distractor "every week" is a valid gloss of *tuwing linggo*.
- `:214-216` "daily" attributively is `pang-araw-araw`.

`35k-ability-permission.yaml`
- `:123` `paalam` means "goodbye", not "permission" → `pahintulot`.

`35m-positions.yaml`
- `:152-154` distractor `gitna and dulo` is also a defensible opposite pair.

`35n-big-numbers.yaml` — the weakest new file
- `:156-159` and `:178,186-187` double linker: `huling **na** araw`, `dalawang **na** buwan`.
- `:28-31`, `:54-57`, `:60` `daan` after vowel-final `na` must be `raan` — contradicting the rule this unit teaches at `:50-51`.
- `:43` accept `Dalawang daan pong piso` splits the linker.
- `:143` `Ikatlong beses ko na ito dito` — `ko` has no verb.

`35o-birthdays-age.yaml`
- `:122` `kantahan` is a verb ("to sing for someone"), glossed as the noun "singing".

`35p-neighbors.yaml`
- `:176` `"Anong kalye po kayo?"` is elliptical → `"Saang kalye po kayo nakatira?"`

`35q-review-everyday-life.yaml`
- `:54-57` `"Deadline po ang bayarin sa Lunes"` = "the bill is a deadline". Reword.
- `:146` clock time takes `sa`/`nang`, not `ng`.

## Outstanding — conversational tier

`51a-job-interview.yaml`
- `:148` missing linker → `Handa po akong mag-overtime` (correct at `:133`, `:153`).
- `:41` duration takes `nang`, not `ng`.
- `:55` two distractors are ungrammatical for reasons unrelated to the register point.

`51b-renting.yaml`
- `:28-31` double linker: `paupahang **na** kuwarto`. Drop `na` from the sentence.
- `:92-93` prompt says "shared", answer says `hiwalay` ("separate").

`51c-hotel.yaml`
- `:153` `magpagising po kayo sa akin` reverses the causative — it tells staff to have *themselves* woken. Use `Pakigising po ninyo ako`. Also `ng` → `nang` before the clock time.
- `:180-181` blank opens a sentence but the options are lowercase → capitalise `Check`.

`51d-airport.yaml`
- `:74` and `:9` `pumapasok` means "entering", not "arriving" → `dumarating`.
- `:87`, `:105`, `:148` duration takes `nang`.
- `:152` listen answer is a fragment.

`51f-giving-advice.yaml`
- `:189-190` `mag-ingat sa kalusugan` reads "beware of your health"; use `Alagaan`.

`51i-wishes-regrets.yaml`
- `:6-7` the tip's wish-vs-regret contrast is the same string twice, and says *sana* bends with tense (the verb does).
- `:9`, `:105` missing linker → `Dapat sana **akong** nag-aral/pumunta`.
- `:93` accept `tinawagan ko ka` is impossible; must contract to `kita`.
- `:197-199` `natira **na** tiket` → `natirang tiket`.

`51j-conditionals.yaml`
- `:180-181` blank yields a subordinate clause with no main clause, and the English gives no *when* cue in the one unit built on the kung/kapag contrast.
- `:28-31` `Kapag` is a defensible answer for the item keyed to `Kung`.

`51k-causative.yaml`
- `:171,182` `magpagupit ng buhok` is redundant (`magpagupit` already means having one's hair cut).
- `:215-217` "how many things" is ambiguous — `two` is defensible.

`51l-object-focus.yaml`
- `:170` dialogue continuity: Bunso is told to wash vegetables, then asks about the *sliced* ones.

`51m-recent-past.yaml`
- `:170` `"___ lang ako dumating…"` + `kakadating` gives two verbs of arrival.
- `:28` vs `:57-58` same sentence keyed `siya` in one item and `niya` in another; the ka- form takes a genitive actor.
- `:7-8` the tip states "repeat the first syllable after ka-", but only `kakakain`/`katatapos` follow it. Prescriptive forms are `kaaalis`, `kararating`, `kalalabas`, `kabibili`. Either fix the forms or reword the tip to describe the colloquial `kaka-` generalisation. **This decision also governs `51p`.**
- `:4` description advertises "saka lang", which never appears.

`51n-superlatives.yaml`
- `:172` blank fills to a garbled sentence stating the size twice.
- `:126`, `:156` `kasing-` comparand takes `ng`, not `sa`.
- `:139`, `:141`, `:92` `ang isang iyon` is an English calque; `ang Palawan na isla` is ungrammatical.
- `:8` tip says `kasing-` doubles the root; it is a plain prefix.
- `:31`, `:179` distractors `Pinaka`/`Kasing` are bound prefixes, not words.

`51o-church-faith.yaml`
- `:8` `simsimba` is not a word → `magsimba`.
- `:92` praying *for* someone is `ipagdasal`, not `pakidasal`.
- `:6-7` the Bathala etymology for *bahala na* is disputed; soften it.

`51p-review-conversational.yaml`
- `:185,194` none of the three options fits the blank; the translation is past while the verb is imperfective.
- `:179,190` same double-verb bug as `51m:170`.
- carries the `51m` `kaka-` forms — keep consistent with whatever is decided there.

## Cross-cutting

- **Identity match pairs** grade for free (left and right are the same string): `18c:72` juice, `35b:198` appointment, `35c:195` form, `35d:71` deadline, `51a:120` overtime, `51a:197` resume, `51b:122` curfew, `51c:69` elevator, `51d:72` gate.
- **Pre-solved items**: several lessons pair a `translate` and an `arrange` with the same English prompt and the same Tagalog answer, so the second is a freebie — `35d:229`/`35d:208`, `35c:219`/`35c:206`, `35b:234`/`35b:181`, `35e:229`/`35e:197`, `35l:91`/`35l:110`, `35p:142`/`35p:162`.
- **No-op grading flags**: `35a:92`, `35b:217`, `35c:39` set `hyphens: true` on a `translate` whose answer is the English side.
- **Achievement ceiling**: `packages/core/src/achievements.ts` tops out at `lessons_150`, which is now about a third of the way through a 453-lesson course.
