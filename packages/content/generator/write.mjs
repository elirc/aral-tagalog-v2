import { writeFileSync, renameSync } from "node:fs";

/** Keep the previous complete file if generation is interrupted. */
export function writeTextAtomically(path, text, encoding = "utf8") {
  const temporary = path + ".tmp";
  writeFileSync(temporary, text, encoding);
  for (let attempt = 0; ; attempt++) {
    try { renameSync(temporary, path); return; }
    catch (error) {
      if (process.platform !== "win32" || !["EPERM", "EACCES", "EBUSY"].includes(error.code) || attempt >= 7) throw error;
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 50 * (attempt + 1));
    }
  }
}
