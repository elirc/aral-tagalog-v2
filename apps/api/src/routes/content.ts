import { createReadStream, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { FastifyInstance } from "fastify";
import { env } from "../env";

/**
 * Content is served straight from the compiled bundle files (packages/content/dist).
 * Bundles are immutable and versioned (CNT-03), so there's no content in the DB —
 * one less thing to keep in sync.
 */
export function contentRoutes(app: FastifyInstance) {
  app.get<{ Params: { courseId: string } }>("/content/courses/:courseId/manifest", async (req, reply) => {
    if (req.params.courseId !== "en-tl") return reply.code(404).send({ error: "unknown course" });
    const path = join(env.contentDir, "manifest.json");
    if (!existsSync(path)) return reply.code(503).send({ error: "content not built" });
    return reply.type("application/json").send(readFileSync(path, "utf8"));
  });

  app.get<{ Params: { name: string } }>("/content/bundles/:name", async (req, reply) => {
    // strict allowlist pattern — no path traversal
    if (!/^course_[a-z]+_[a-z]+(_v\d+)?\.json$/.test(req.params.name))
      return reply.code(400).send({ error: "bad bundle name" });
    const path = join(env.contentDir, req.params.name);
    if (!existsSync(path)) return reply.code(404).send({ error: "no such bundle" });
    reply.header("cache-control", /_v\d+\.json$/.test(req.params.name)
      ? "public, max-age=31536000, immutable"
      : "public, max-age=0, must-revalidate");
    return reply.type("application/json").send(createReadStream(path));
  });

  app.get<{ Params: { file: string } }>("/content/audio/:file", async (req, reply) => {
    if (!/^[a-z0-9_]+\.(mp3|wav|m4a|ogg)$/.test(req.params.file))
      return reply.code(400).send({ error: "bad audio name" });
    const path = join(env.audioDir, req.params.file);
    if (!existsSync(path)) return reply.code(404).send({ error: "no such clip" });
    reply.header("cache-control", "public, max-age=31536000, immutable");
    const types: Record<string, string> = {
      mp3: "audio/mpeg",
      wav: "audio/wav",
      m4a: "audio/mp4",
      ogg: "audio/ogg",
    };
    const ext = req.params.file.split(".").pop()!;
    return reply.type(types[ext] ?? "application/octet-stream").send(createReadStream(path));
  });
}
