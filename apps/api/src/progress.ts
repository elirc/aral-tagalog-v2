import { eq } from "drizzle-orm";
import { progressEvents, users, type Db } from "@aral/db";
import { reduceEvents, type ProgressEvent, type UserProgress } from "@aral/core";

/** Derive a user's progress by replaying their event stream (OFF-03). */
export async function getUserProgress(db: Db, userId: string, tz: string): Promise<UserProgress> {
  const rows = await db
    .select({ payload: progressEvents.payload })
    .from(progressEvents)
    .where(eq(progressEvents.userId, userId));
  const events = rows.map((r) => r.payload as ProgressEvent);
  return reduceEvents(events, tz, Date.now());
}

export async function getUser(db: Db, userId: string) {
  const [user] = await db.select().from(users).where(eq(users.id, userId));
  return user ?? null;
}
