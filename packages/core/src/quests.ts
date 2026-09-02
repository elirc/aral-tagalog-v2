/**
 * Daily quests (GAM). Three quests rotate every local day; finishing one
 * awards bonus XP.
 *
 * Quests are **derived, not stored** — the same trick achievements use. There
 * is no `quest_claimed` event to forge: `reduceEvents` keeps per-day counters
 * while folding the stream, checks the day's quest targets after every lesson
 * completion, and credits the reward itself. Client and server run that same
 * reducer, so they always agree on what was earned and a client cannot claim
 * a quest it didn't finish.
 *
 * Quest *metrics* only ever read `DayStats.lessonXp`, never `questXp`, so a
 * reward can never feed back into the target that produced it.
 */

/** What a quest counts. All are per-local-day. */
export type QuestMetric =
  /** XP earned from lessons that day (quest rewards excluded) */
  | "xp"
  /** lesson completions, practice replays included */
  | "lessons"
  /** first-time lessons finished without a mistake */
  | "perfect"
  /** practice replays of finished lessons */
  | "practice"
  /** weak exercises cleared by mastering them in a later session */
  | "review"
  /** longest consecutive-correct run reached in a single session */
  | "combo";

export interface QuestDef {
  id: string;
  title: string;
  description: string;
  emoji: string;
  metric: QuestMetric;
  target: number;
  rewardXp: number;
}

/**
 * The pool the daily set is drawn from. Keep ids stable: past days replay
 * their quests from the day key, so renaming an id silently changes history.
 */
export const QUEST_POOL: readonly QuestDef[] = [
  { id: "xp_20", title: "Warm-up", description: "Earn 20 XP today.", emoji: "⚡", metric: "xp", target: 20, rewardXp: 5 },
  { id: "xp_50", title: "Sipag", description: "Earn 50 XP today.", emoji: "🔥", metric: "xp", target: 50, rewardXp: 10 },
  { id: "xp_100", title: "Bumbero", description: "Earn 100 XP today.", emoji: "🚀", metric: "xp", target: 100, rewardXp: 20 },
  { id: "lessons_2", title: "Dalawa Lang", description: "Finish 2 lessons today.", emoji: "📗", metric: "lessons", target: 2, rewardXp: 8 },
  { id: "lessons_4", title: "Marathon", description: "Finish 4 lessons today.", emoji: "📚", metric: "lessons", target: 4, rewardXp: 15 },
  { id: "perfect_1", title: "Walang Bahid", description: "Finish a lesson with no mistakes.", emoji: "✨", metric: "perfect", target: 1, rewardXp: 10 },
  { id: "perfect_2", title: "Doble Perpekto", description: "Finish 2 perfect lessons.", emoji: "💎", metric: "perfect", target: 2, rewardXp: 18 },
  { id: "practice_1", title: "Balik-aral", description: "Replay a finished lesson to practice.", emoji: "🔁", metric: "practice", target: 1, rewardXp: 6 },
  { id: "review_3", title: "Linis", description: "Clear 3 past mistakes in review.", emoji: "🧹", metric: "review", target: 3, rewardXp: 10 },
  { id: "review_6", title: "Walis Tingting", description: "Clear 6 past mistakes in review.", emoji: "🪣", metric: "review", target: 6, rewardXp: 18 },
  { id: "combo_5", title: "Sunod-sunod", description: "Answer 5 in a row correctly.", emoji: "🎯", metric: "combo", target: 5, rewardXp: 8 },
  { id: "combo_10", title: "Hindi Mapigilan", description: "Answer 10 in a row correctly.", emoji: "☄️", metric: "combo", target: 10, rewardXp: 15 },
];

export const DAILY_QUEST_COUNT = 3;

/** Per-local-day counters the reducer keeps so quests can be evaluated. */
export interface DayStats {
  /** XP from lesson completions — the number quest targets are measured against */
  lessonXp: number;
  /** XP credited by completed quests that day */
  questXp: number;
  lessons: number;
  perfect: number;
  practice: number;
  mistakesCleared: number;
  maxCombo: number;
  /** ids of quests already credited that day (idempotency across re-folds) */
  questIds: string[];
}

// frozen: it is handed out directly by todayStats() as the "nothing yet today"
// value, and a caller mutating it would corrupt every later read
export const emptyDayStats: DayStats = Object.freeze({
  lessonXp: 0,
  questXp: 0,
  lessons: 0,
  perfect: 0,
  practice: 0,
  mistakesCleared: 0,
  maxCombo: 0,
  questIds: Object.freeze([] as string[]) as string[],
});

/** FNV-1a over the day key — a stable seed shared by every client and the server. */
function seedFor(dayKey: string): number {
  let h = 2166136261;
  for (const c of dayKey) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return h >>> 0;
}

/**
 * The quests for a local day, in display order. Deterministic in the day key
 * alone: everyone gets the same three, and a past day always replays the set
 * it was actually played with. At most one quest per metric, so a day never
 * offers "earn 20 XP" and "earn 50 XP" side by side.
 */
export function dailyQuests(dayKey: string, count = DAILY_QUEST_COUNT): QuestDef[] {
  let h = seedFor(dayKey);
  const rand = () => {
    h = Math.imul(h ^ (h >>> 15), h | 1);
    h ^= h + Math.imul(h ^ (h >>> 7), h | 61);
    return ((h ^ (h >>> 14)) >>> 0) / 4294967296;
  };
  const pool = [...QUEST_POOL];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [pool[i], pool[j]] = [pool[j]!, pool[i]!];
  }
  const picked: QuestDef[] = [];
  const usedMetrics = new Set<QuestMetric>();
  for (const q of pool) {
    if (picked.length >= count) break;
    if (usedMetrics.has(q.metric)) continue;
    usedMetrics.add(q.metric);
    picked.push(q);
  }
  // fewer distinct metrics than `count` (only possible if the pool shrinks):
  // top up with whatever is left rather than returning a short list
  for (const q of pool) {
    if (picked.length >= count) break;
    if (!picked.includes(q)) picked.push(q);
  }
  // easiest first, so the panel reads as a ladder
  return picked.sort((a, b) => a.rewardXp - b.rewardXp || (a.id < b.id ? -1 : 1));
}

/** Where a day's counters stand against one metric. */
export function questValue(metric: QuestMetric, day: DayStats): number {
  switch (metric) {
    case "xp":
      return day.lessonXp;
    case "lessons":
      return day.lessons;
    case "perfect":
      return day.perfect;
    case "practice":
      return day.practice;
    case "review":
      return day.mistakesCleared;
    case "combo":
      return day.maxCombo;
  }
}

export interface QuestStatus {
  def: QuestDef;
  value: number;
  complete: boolean;
  /** 0..1, for the progress bar */
  fraction: number;
  /** already credited to xpTotal (false until the reducer sees the completion) */
  claimed: boolean;
}

/** The day's quests with live progress — what the quest panel renders. */
export function questStatuses(dayKey: string, day: DayStats = emptyDayStats): QuestStatus[] {
  const credited = new Set(day.questIds);
  return dailyQuests(dayKey).map((def) => {
    const value = questValue(def.metric, day);
    return {
      def,
      value,
      complete: value >= def.target,
      fraction: def.target > 0 ? Math.min(1, value / def.target) : 1,
      claimed: credited.has(def.id),
    };
  });
}

/**
 * Quests finished on `dayKey` that haven't been credited yet, and the XP they
 * are worth. Called by the reducer after every lesson completion.
 */
export function pendingQuestRewards(dayKey: string, day: DayStats): { ids: string[]; xp: number } {
  const credited = new Set(day.questIds);
  const ids: string[] = [];
  let xp = 0;
  for (const def of dailyQuests(dayKey)) {
    if (credited.has(def.id)) continue;
    if (questValue(def.metric, day) < def.target) continue;
    ids.push(def.id);
    xp += def.rewardXp;
  }
  return { ids, xp };
}

/** Total XP the day's quests are worth — the "up to +N XP" line in the UI. */
export function dailyQuestMaxXp(dayKey: string): number {
  return dailyQuests(dayKey).reduce((n, q) => n + q.rewardXp, 0);
}
