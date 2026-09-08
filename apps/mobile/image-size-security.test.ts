import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmdirSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const appRequire = createRequire(import.meta.url);
const nativeRequire = createRequire(appRequire.resolve("react-native/package.json"));
const cliRequire = createRequire(nativeRequire.resolve("@react-native/community-cli-plugin/package.json"));
const metroRequire = createRequire(cliRequire.resolve("metro/package.json"));
const imageSizePath = metroRequire.resolve("image-size");
const imageSize = metroRequire("image-size") as {
  (input: Uint8Array | string): { width: number; height: number; type: string };
  (input: string, callback: (error: Error | null, result: { width: number; height: number }) => void): void;
  imageSize: unknown;
};

function box(type: string, payload: Buffer = Buffer.alloc(0), declaredLength = 8 + payload.length): Buffer {
  const header = Buffer.alloc(8);
  header.writeUInt32BE(declaredLength, 0);
  header.write(type, 4, "ascii");
  return Buffer.concat([header, payload]);
}
function icns(entryLengths: number[]): Buffer {
  const bytes = Buffer.alloc(8 + entryLengths.length * 8);
  bytes.write("icns");
  bytes.writeUInt32BE(bytes.length, 4);
  entryLengths.forEach((length, index) => {
    bytes.write("is32", 8 + index * 8);
    bytes.writeUInt32BE(length, 12 + index * 8);
  });
  return bytes;
}
const badJxl = Buffer.concat([
  box("JXL ", Buffer.from([13, 10, 135, 10])),
  box("ftyp", Buffer.from("jxl \0\0\0\0")),
  box("jxlp", Buffer.alloc(4), 0),
]);
const badHeif = Buffer.concat([
  box("ftyp", Buffer.from("avif\0\0\0\0")),
  box("meta", Buffer.concat([Buffer.alloc(4), box("iprp", box("ipco", box("ispe", Buffer.alloc(16), 0)))])),
]);
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aW1sAAAAASUVORK5CYII=", "base64");

describe("Metro image parser security and compatibility", () => {
  it("loads the reviewed local replacement through Metro's dependency", () => {
    expect(metroRequire("image-size/package.json")).toMatchObject({ name: "@aral/image-size", version: "1.2.1-aral.1" });
    expect(imageSize.imageSize).toBe(imageSize);
  });

  // Child processes impose a real wall-clock bound: a parser regression cannot
  // hang Vitest's event loop and silently bypass its ordinary test timeout.
  it.each([
    ["ICNS zero first entry", icns([0])],
    ["ICNS zero later entry", icns([8, 0])],
    ["ICNS undersized entry", icns([1])],
    ["JXL zero partial-stream box", badJxl],
    ["HEIF zero image-property box", badHeif],
  ])("rejects %s without hanging", (_name, payload) => {
    const result = spawnSync(process.execPath, ["-e", `
      const imageSize = require(process.argv[1]);
      try {
        imageSize(Buffer.from(process.argv[2], 'base64'));
        process.stdout.write('accepted');
      } catch {
        process.stdout.write('rejected');
      }
    `, imageSizePath, (payload as Buffer).toString("base64")], { encoding: "utf8", timeout: 2000, windowsHide: true });
    expect(result.error).toBeUndefined();
    expect(result.status).toBe(0);
    expect(result.stdout).toBe("rejected");
  });

  it("still reads PNG and SVG buffers and ordinary ICNS entries", () => {
    expect(imageSize(png)).toMatchObject({ width: 1, height: 1, type: "png" });
    expect(imageSize(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="7" height="9"></svg>')))
      .toMatchObject({ width: 7, height: 9, type: "svg" });
    expect(imageSize(icns([8]))).toMatchObject({ width: 16, height: 16 });
  });

  it("still reads dimensions from a valid nested HEIF container", () => {
    const properties = Buffer.alloc(12);
    properties.writeUInt32BE(7, 4);
    properties.writeUInt32BE(9, 8);
    const valid = Buffer.concat([
      box("ftyp", Buffer.from("avif\0\0\0\0")),
      box("meta", Buffer.concat([Buffer.alloc(4), box("iprp", box("ipco", box("ispe", properties)))])),
    ]);
    expect(imageSize(valid)).toMatchObject({ width: 7, height: 9, type: "avif" });
  });

  it("preserves synchronous and callback filename support used by tooling", async () => {
    const directory = mkdtempSync(join(tmpdir(), "aral-image-parser-"));
    const filename = join(directory, "pixel.png");
    try {
      writeFileSync(filename, png);
      expect(imageSize(filename)).toMatchObject({ width: 1, height: 1 });
      const result = await new Promise((resolve, reject) => {
        imageSize(filename, (error, dimensions) => error ? reject(error) : resolve(dimensions));
      });
      expect(result).toMatchObject({ width: 1, height: 1 });
    } finally {
      unlinkSync(filename);
      rmdirSync(directory);
    }
  });
});
