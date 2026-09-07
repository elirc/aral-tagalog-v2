import { readFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { lessonXp, type Lesson } from "@aral/core";
import { env } from "./env";
import type { LessonCatalog } from "./sync-validation";

// Verify the fields used by sync before accepting any progress. The content
// compiler validates the full authored course; these checks catch an absent,
// truncated, or mismatched deployment artifact.
const manifestSchema = z.object({
  courseId: z.literal("en-tl"),
  version: z.number().int().positive(),
  bundle: z.string().regex(/^course_en_tl_v\d+\.json$/),
});
const bundleSchema = z.object({
  id: z.literal("en-tl"),
  version: z.number().int().positive(),
  units: z.array(z.object({
    lessons: z.array(z.object({
      id: z.string().min(1),
      xp: z.number().finite().nonnegative().optional(),
      exercises: z.array(z.unknown()).min(1),
    }).passthrough()).min(1),
  })).min(1),
});

export function readCatalog(contentDir: string): LessonCatalog {
  const manifest = manifestSchema.parse(JSON.parse(readFileSync(join(contentDir, "manifest.json"), "utf8")));
  const bundle = bundleSchema.parse(JSON.parse(readFileSync(join(contentDir, manifest.bundle), "utf8")));
  if (bundle.version !== manifest.version || manifest.bundle !== `course_en_tl_v${manifest.version}.json`) {
    throw new Error("content manifest and bundle versions differ");
  }
  const lessonById = new Map<string, Lesson>();
  for (const unit of bundle.units) {
    for (const lesson of unit.lessons) {
      if (lessonById.has(lesson.id)) throw new Error("content contains duplicate lesson ids");
      lessonById.set(lesson.id, lesson as unknown as Lesson);
    }
  }
  return { lessonById, maxAuthoredXp: Math.max(...[...lessonById.values()].map((lesson) => lessonXp(lesson, true))) };
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
