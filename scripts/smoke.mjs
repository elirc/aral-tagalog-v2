/**
 * End-to-end smoke test against a RUNNING stack (API + Postgres):
 *
 *   docker compose up -d && pnpm db:migrate && pnpm api:dev   # then:
 *   pnpm smoke
 *
 * Covers the DB-backed flows unit tests can't: registration, event sync with
 * server-side XP clamping, review-queue derivation, refresh-token rotation
 * with reuse detection and family revocation, and logout. Stays under the
 * auth rate limit (10/min) — 9 auth-route hits total.
 *
 * Exits 0 when every check passes, 1 with a failure list otherwise.
 */

const API = process.env.SMOKE_API_URL ?? "http://localhost:3001";

const failures = [];
let checks = 0;

function ok(name, cond, detail = "") {
  checks++;
  if (cond) console.log(`  ✓ ${name}`);
  else {
    console.error(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`);
    failures.push(name);
  }
}

async function req(path, { method = "GET", token, body } = {}) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let json = null;
  try {
    json = await res.json();
  } catch {
    /* 204s and friends */
  }
  return { status: res.status, json };
}

const uuid = () => crypto.randomUUID();
const email = `smoke-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.test`;
const password = "smoke-test-password";

console.log(`smoke: ${API}`);

// --- content ---------------------------------------------------------------
console.log("content");
const manifest = await req("/content/courses/en-tl/manifest");
ok("manifest 200", manifest.status === 200, `got ${manifest.status}`);
const bundleRes = await req(`/content/bundles/${manifest.json?.bundle}`);
ok("bundle 200", bundleRes.status === 200, `got ${bundleRes.status}`);
const bundle = bundleRes.json;
const lesson = bundle?.units?.[0]?.lessons?.[0];
ok("bundle has lessons", Boolean(lesson?.id && lesson?.exercises?.length));
ok("unknown course 404", (await req("/content/courses/nope/manifest")).status === 404);
ok("bad audio name 400", (await req("/content/audio/..%2Fsecrets.mp3")).status === 400);

// --- auth: register + login (auth hits 1-2) --------------------------------
console.log("auth");
const reg = await req("/auth/register", {
  method: "POST",
  body: { email, password, tz: "Asia/Manila" },
});
ok("register 201", reg.status === 201, `got ${reg.status} ${JSON.stringify(reg.json)}`);
ok("register returns tz", reg.json?.user?.tz === "Asia/Manila");

const login = await req("/auth/login", { method: "POST", body: { email, password } });
ok("login 200", login.status === 200, `got ${login.status}`);
let { accessToken, refreshToken } = login.json ?? {};

// --- profile ---------------------------------------------------------------
console.log("profile");
ok("PATCH /me rejects bad tz", (await req("/me", { method: "PATCH", token: accessToken, body: { tz: "Mars/Phobos" } })).status === 400);
ok("PATCH /me accepts real tz", (await req("/me", { method: "PATCH", token: accessToken, body: { tz: "UTC", displayName: "Smoke" } })).status === 200);
ok("/me without token 401", (await req("/me")).status === 401);

// --- sync: clamping + review queue ----------------------------------------
console.log("sync");
const exId = lesson.exercises[0].id;
const authoredXp = lesson.xp || 10;

// first-time completion, inflated xp -> clamped to authored (perfect=false)
const s1 = await req("/sync", {
  method: "POST",
  token: accessToken,
  body: {
    events: [
      {
        id: uuid(),
        type: "lesson_completed",
        lessonId: lesson.id,
        occurredAt: Date.now(),
        perfect: false,
        xp: 100,
        missedExerciseIds: [exId],
      },
      { id: "not-a-uuid", type: "lesson_completed" }, // must be rejected, not wedge the batch
    ],
  },
});
ok("sync 200", s1.status === 200, `got ${s1.status} ${JSON.stringify(s1.json)}`);
ok("valid event accepted", s1.json?.accepted === 1);
ok("invalid event rejected by id", s1.json?.rejected?.[0] === "not-a-uuid");
ok("xp clamped to authored value", s1.json?.progress?.xpTotal === authoredXp, `xpTotal=${s1.json?.progress?.xpTotal}, authored=${authoredXp}`);
ok("missed exercise entered review queue", s1.json?.progress?.weakExerciseIds?.includes(exId));
ok("lesson marked completed", s1.json?.progress?.completedLessonIds?.includes(lesson.id));

// practice replay, inflated xp -> clamped to flat practice award (5)
const s2 = await req("/sync", {
  method: "POST",
  token: accessToken,
  body: {
    events: [
      {
        id: uuid(),
        type: "lesson_completed",
        lessonId: "review",
        occurredAt: Date.now(),
        perfect: true,
        xp: 100,
        practice: true,
        masteredExerciseIds: [exId],
      },
    ],
  },
});
ok("practice xp clamped to 5", s2.json?.progress?.xpTotal === authoredXp + 5, `xpTotal=${s2.json?.progress?.xpTotal}`);
ok("mastering cleared the review queue", s2.json?.progress?.weakExerciseIds?.length === 0);
ok("mistakesCleared counted", s2.json?.progress?.mistakesCleared === 1);
ok("perfect practice not counted as perfect lesson", s2.json?.progress?.perfectLessons === 0);

// idempotency: replaying the same event id must not double-count
const replayId = uuid();
const mkReplay = () => ({
  events: [
    { id: replayId, type: "lesson_completed", lessonId: lesson.id, occurredAt: Date.now(), perfect: false, xp: 5, practice: true },
  ],
});
const r1 = await req("/sync", { method: "POST", token: accessToken, body: mkReplay() });
const r2 = await req("/sync", { method: "POST", token: accessToken, body: mkReplay() });
ok("duplicate event id counts once", r1.json?.progress?.xpTotal === r2.json?.progress?.xpTotal, `${r1.json?.progress?.xpTotal} vs ${r2.json?.progress?.xpTotal}`);

const me = await req("/me", { token: accessToken });
ok("/me matches sync-derived progress", me.json?.progress?.xpTotal === r2.json?.progress?.xpTotal);

// --- refresh rotation + reuse detection (auth hits 3-5) --------------------
console.log("token rotation");
const rot = await req("/auth/refresh", { method: "POST", body: { refreshToken } });
ok("refresh rotates 200", rot.status === 200, `got ${rot.status}`);
const rotated = rot.json ?? {};

const reuse = await req("/auth/refresh", { method: "POST", body: { refreshToken } });
ok("reusing rotated token 401", reuse.status === 401, `got ${reuse.status}`);

// reuse must revoke the WHOLE family: the freshly-minted token dies too
const familyDead = await req("/auth/refresh", { method: "POST", body: { refreshToken: rotated.refreshToken } });
ok("reuse revoked the whole family", familyDead.status === 401, `got ${familyDead.status}`);

// --- logout (auth hits 6-8) ------------------------------------------------
console.log("logout");
const relogin = await req("/auth/login", { method: "POST", body: { email, password } });
ok("re-login 200", relogin.status === 200);
const out = await req("/auth/logout", { method: "POST", body: { refreshToken: relogin.json?.refreshToken } });
ok("logout 204", out.status === 204, `got ${out.status}`);
const afterLogout = await req("/auth/refresh", { method: "POST", body: { refreshToken: relogin.json?.refreshToken } });
ok("refresh after logout 401", afterLogout.status === 401, `got ${afterLogout.status}`);

// ---------------------------------------------------------------------------
console.log(`\n${checks - failures.length}/${checks} checks passed`);
if (failures.length > 0) {
  console.error(`FAILED: ${failures.join(", ")}`);
  process.exit(1);
}
