import { isLessonUnlocked as coreIsLessonUnlocked, type CourseBundle, type Lesson } from "@aral/core";
import { api } from "./api";
import { kvGet, kvSet } from "./storage";

// The compiled bundle ships inside the app binary, so lessons work on first
// launch with no network (OFF-01). Newer bundles downloaded later win.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const shippedBundle = require("@aral/content/bundle") as CourseBundle;

let active: CourseBundle = kvGet<CourseBundle>("bundle") ?? shippedBundle;
if (active.version < shippedBundle.version) active = shippedBundle;

export function getBundle(): CourseBundle {
  return active;
}

/**
 * OFF-04: on launch (online) compare versions and swap in a newer bundle in
 * the background. Never blocks play.
 */
export async function refreshBundleIfNewer(): Promise<boolean> {
  try {
    const manifest = await api.manifest();
    if (manifest.version <= active.version) return false;
    const fresh = (await api.bundle(manifest.bundle)) as CourseBundle;
    kvSet("bundle", fresh);
    active = fresh;
    return true;
  } catch {
    return false; // offline — keep playing the cached bundle
  }
}

export function findLesson(lessonId: string): { lesson: Lesson; unitTitle: string } | null {
  for (const unit of active.units) {
    const lesson = unit.lessons.find((l) => l.id === lessonId);
    if (lesson) return { lesson, unitTitle: unit.title };
  }
  return null;
}

export function isLessonUnlocked(lessonId: string, completed: string[]): boolean {
  return coreIsLessonUnlocked(active.units, lessonId, completed);
}
