/**
 * Content types shared by the compiler, API, and both clients.
 * A CourseBundle is the compiled, immutable artifact clients download.
 */

export type LangCode = string; // BCP-47-ish: "en", "tl", "es"

export interface CourseBundle {
  /** e.g. "en-tl" (base-target) — the CON-04 extensibility key */
  id: string;
  baseLang: LangCode;
  targetLang: LangCode;
  version: number;
  title: string;
  units: Unit[];
  /** vocabId -> entry; exercises reference these for audio/translations */
  vocab: Record<string, VocabEntry>;
  /** audioRef -> relative file path within the bundle (e.g. "audio/kumusta_ka.mp3") */
  audio: Record<string, string>;
  /**
   * audioRef -> target-language text spoken in that clip (null when unknown).
   * Lets clients fall back to device TTS while a recording is missing (AUD-02).
   */
  audioTexts?: Record<string, string | null>;
}

export interface VocabEntry {
  id: string;
  lemma: string; // target-language word/phrase
  translation: string; // base-language meaning
  audio?: string; // audioRef
  notes?: string;
}

export interface Unit {
  id: string;
  title: string;
  description?: string;
  /** short grammar/culture note shown on the course map */
  tip?: string;
  lessons: Lesson[];
}

export interface Lesson {
  id: string;
  title: string;
  xp: number;
  exercises: Exercise[];
}

export interface ExerciseBase {
  id: string;
  /** audioRef played with the prompt (target-language audio) */
  audio?: string;
  hint?: string;
}

/** Pick the right answer among distractors. */
export interface ChoiceExercise extends ExerciseBase {
  type: "choice";
  prompt: string;
  answer: string;
  distractors: string[];
}

/** Translate a sentence by tapping words from a bank. */
export interface TranslateTapsExercise extends ExerciseBase {
  type: "translate_taps";
  /** which way we translate; prompt is shown, answer is built from the bank */
  direction: "target_to_base" | "base_to_target";
  prompt: string;
  answer: string;
  /** additional accepted answers */
  accept?: string[];
  wordBank: string[];
  grading?: GradingFlags;
}

/** "Tap what you hear" — audio prompt, build the target-language sentence. */
export interface ListenExercise extends ExerciseBase {
  type: "listen";
  audio: string; // required for this type
  answer: string;
  accept?: string[];
  wordBank: string[];
  grading?: GradingFlags;
}

/** Match target-language words to base-language translations. */
export interface MatchPairsExercise extends ExerciseBase {
  type: "match_pairs";
  pairs: Array<{ left: string; right: string }>;
}

/** Sentence with a blank; pick or type the missing word. */
export interface FillBlankExercise extends ExerciseBase {
  type: "fill_blank";
  /** sentence containing "___" where the answer goes */
  sentence: string;
  translation?: string;
  answer: string;
  /** if present, render as buttons; otherwise free text input */
  options?: string[];
  accept?: string[];
  grading?: GradingFlags;
}

export interface GradingFlags {
  /** accept ng/nang interchangeably (CNT-04) */
  ngNang?: boolean;
  /** tolerate missing hyphens in reduplication: "araw-araw" vs "araw araw" */
  hyphens?: boolean;
}

export type Exercise =
  | ChoiceExercise
  | TranslateTapsExercise
  | ListenExercise
  | MatchPairsExercise
  | FillBlankExercise;

export type ExerciseType = Exercise["type"];
