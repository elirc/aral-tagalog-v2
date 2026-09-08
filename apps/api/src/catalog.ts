import { readFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { lessonXp } from "@aral/core";
import { env } from "./env";
import type { CatalogLesson, LessonCatalog } from "./sync-validation";

// Sync only needs authored XP and exercise counts. The compiler validates the
// complete course and emits this small projection so API cold starts do not
// parse or retain every exercise, translation, vocabulary entry and audio path.
const manifestSchema = z.object({
  courseId: z.literal("en-tl"),
  version: z.number().int().positive(),
  bundle: z.string().regex(/^course_en_tl_v\d+\.json$/),
});
const catalogSchema = z.object({
  id: z.literal("en-tl"),
  version: z.number().int().positive(),
  lessons: z.array(z.object({
    id: z.string().min(1),
    xp: z.number().finite().nonnegative().default(0),
    exerciseCount: z.number().int().positive(),
  })).min(1),
});

export function readCatalog(contentDir: string): LessonCatalog {
  const manifest = manifestSchema.parse(JSON.parse(readFileSync(join(contentDir, "manifest.json"), "utf8")));
  const compact = catalogSchema.parse(JSON.parse(readFileSync(join(contentDir, "sync_catalog.json"), "utf8")));
  if (compact.version !== manifest.version || manifest.bundle !== `course_en_tl_v${manifest.version}.json`) {
    throw new Error("content manifest and catalog versions differ");
  }
  const lessonById = new Map<string, CatalogLesson>();
  let maxAuthoredXp = 0;
  for (const lesson of compact.lessons) {
    if (lessonById.has(lesson.id)) throw new Error("content contains duplicate lesson ids");
    lessonById.set(lesson.id, lesson);
    maxAuthoredXp = Math.max(maxAuthoredXp, lessonXp(lesson, true));
  }
  return { lessonById, maxAuthoredXp };
}

function loadCatalog(): LessonCatalog | null {
  try {
    return readCatalog(env.contentDir);
  } catch (error) {
    if (!env.isDevelopment) throw new Error("Compiled content is missing or invalid; run pnpm content:build before starting the API", { cause: error });
    console.warn("Compiled content is unavailable; run pnpm content:build. Readiness will return 503.");
    return null;
  }
}

export const catalog = loadCatalog();
