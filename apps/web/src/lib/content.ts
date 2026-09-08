import { isLessonUnlocked as unlockedInUnits, type WebCourseIndex } from "@aral/core";
import courseIndex from "@aral/content/web-index";
import { CourseContentLoader } from "./content-loader";

/** Browsing needs only titles and ordering; exercise bodies arrive per unit on demand. */
export const bundle = courseIndex as WebCourseIndex;
export const contentLoader = new CourseContentLoader(bundle);
export const findLesson = (lessonId: string) => contentLoader.findLesson(lessonId);
export const loadLesson = (lessonId: string) => contentLoader.loadLesson(lessonId);
export const loadReview = (weakIds: string[]) => contentLoader.loadReview(weakIds);
export const loadVocabulary = () => contentLoader.loadVocabulary();

export function isLessonUnlocked(lessonId: string, completed: string[], unlockedTierIds: string[] = []): boolean {
  return unlockedInUnits(bundle.units, lessonId, completed, { tiers: bundle.tiers, unlockedTierIds });
}
