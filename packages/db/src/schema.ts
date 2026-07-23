import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  index,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  displayName: text("display_name"),
  /** IANA timezone for streak rollover (GAM-02) */
  tz: text("tz").notNull().default("UTC"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Rotating refresh tokens; only a hash is stored. Tokens form *families*:
 * login/register mints a new family, each refresh rotates within it. A
 * rotated token stays as a tombstone (rotated_at set) until it expires —
 * presenting one means the token leaked (or a very late retry), and the
 * whole family is revoked (AUTH reuse detection).
 */
export const refreshTokens = pgTable("refresh_tokens", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull().unique(),
  /** all rotations of one login session share this id */
  familyId: uuid("family_id").notNull().default(sql`gen_random_uuid()`),
  /** set when this token was exchanged for a newer one (single-use rotation) */
  rotatedAt: timestamp("rotated_at", { withTimezone: true }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * All user progress as an append-only event stream (DAT-02) — one table
 * instead of separate xp_events/lesson_completions/user_state. The event id
 * is generated on the client and acts as the sync idempotency key (OFF-03);
 * XP totals, streaks, and hearts are derived with @aral/core reduceEvents.
 */
export const progressEvents = pgTable(
  "progress_events",
  {
    /** client-generated UUID (idempotency key) */
    id: uuid("id").notNull(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(), // lesson_completed | hearts_lost | hearts_refilled | goal_set
    /** full ProgressEvent JSON as defined in @aral/core */
    payload: jsonb("payload").notNull(),
    /** device wall-clock epoch ms — streaks use this, not sync time (GAM-02) */
    occurredAt: bigint("occurred_at", { mode: "number" }).notNull(),
    syncedAt: timestamp("synced_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.id] }),
    index("progress_events_user_time").on(t.userId, t.occurredAt),
  ],
);
