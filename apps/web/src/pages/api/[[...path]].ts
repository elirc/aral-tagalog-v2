import { waitUntil } from "@vercel/functions";
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import type { NextApiRequest, NextApiResponse } from "next";
import type { buildApp } from "@aral/api";

export const config = {
  api: { bodyParser: false, externalResolver: true },
  maxDuration: 30,
};

let appPromise: Promise<Awaited<ReturnType<typeof buildApp>>> | undefined;

function contentDirectory() {
  const candidates = [resolve(process.cwd(), "public/_course"), resolve(process.cwd(), "apps/web/public/_course")];
  return candidates.find((candidate) => existsSync(join(candidate, "manifest.json"))) ?? candidates[0]!;
}

async function application() {
  if (!appPromise) {
    // These paths remain correct after Next bundles the API source. Initialization
    // is lazy so a production build never opens a database connection.
    process.env.CONTENT_DIR ??= contentDirectory();
    process.env.AUDIO_DIR ??= join(process.env.CONTENT_DIR, "audio");
    if (process.env.VERCEL === "1") process.env.TRUST_PROXY ??= "true";
    appPromise = import("@aral/api").then(async ({ buildApp }) => {
      const app = buildApp();
      try { await app.ready(); return app; }
      catch (error) { await app.close(); throw error; }
    }).catch((error) => { appPromise = undefined; throw error; });
  }
  return appPromise;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const path = (req.url ?? "/api").replace(/^\/api(?=\/|\?|$)/, "") || "/";
  const pathname = path.split("?")[0]!;
  res.setHeader("Cache-Control", "no-store");
  // Course files can exceed a Vercel Function's response limit. Redirect them
  // to static deployment assets, which are served directly by Vercel's CDN.
  if (req.method === "GET" || req.method === "HEAD") {
    if (pathname === "/content/courses/en-tl/manifest") {
      return res.redirect(307, "/_course/manifest.json");
    }
    const bundle = pathname.match(/^\/content\/bundles\/(course_en_tl(?:_v\d+)?\.json)$/)?.[1];
    if (bundle) {
      const manifest = JSON.parse(readFileSync(join(contentDirectory(), "manifest.json"), "utf8"));
      return res.redirect(307, `/_course/${bundle === "course_en_tl.json" ? manifest.bundle : bundle}`);
    }
    const audio = pathname.match(/^\/content\/audio\/([a-z0-9_]+\.(?:mp3|wav|m4a|ogg))$/)?.[1];
    if (audio) return res.redirect(307, `/_course/audio/${audio}`);
  }
  try {
    const app = await application();
    req.url = path;
    // Pass the original stream to Fastify so its body limits, errors, auth,
    // rate limiting and transactional handlers remain identical on both hosts.
    await new Promise<void>((done, reject) => {
      res.once("finish", done);
      res.once("close", done);
      res.once("error", reject);
      app.server.emit("request", req, res);
    });
    // postgres.js closes idle sockets after 5s. Keep Fluid Compute alive long
    // enough to drain them before suspension; concurrent requests may share it.
    if (process.env.VERCEL === "1") waitUntil(new Promise((resolve) => setTimeout(resolve, 6500)));
  } catch (error) {
    console.error("API initialization or request failed", error instanceof Error ? error.message : "unknown error");
    if (!res.headersSent) res.status(503).json({ error: "The service is temporarily unavailable. Please try again." });
  }
}
