import { Audio } from "expo-av";
import * as FileSystem from "expo-file-system";
import * as Speech from "expo-speech";
import { audioUrl } from "./api";
import { getBundle } from "./content";

// expo-av is deprecated in favor of expo-audio; swap this module when
// upgrading past SDK 53. Callers only use playAudio/cacheAllAudio.
const audioDir = `${FileSystem.documentDirectory}audio/`;
const downloads = new Map<string, Promise<boolean>>();

function localPath(file: string): string {
  return audioDir + file.split("/").pop()!;
}

/** Publish complete recordings only, sharing concurrent requests for one file. */
function cacheRecording(file: string): Promise<boolean> {
  const local = localPath(file);
  const pending = downloads.get(local);
  if (pending) return pending;

  const task = (async () => {
    const partial = `${local}.download`;
    try {
      if ((await FileSystem.getInfoAsync(local)).exists) return true;
      await FileSystem.makeDirectoryAsync(audioDir, { intermediates: true });
      const result = await FileSystem.downloadAsync(audioUrl(file), partial);
      const contentType = Object.entries(result.headers ?? {})
        .find(([name]) => name.toLowerCase() === "content-type")?.[1];
      if (result.status !== 200 || !contentType?.toLowerCase().startsWith("audio/")) return false;
      await FileSystem.moveAsync({ from: partial, to: local });
      return true;
    } catch {
      return false;
    } finally {
      // Interrupted writes and HTTP error bodies must never shadow a recording.
      try { await FileSystem.deleteAsync(partial, { idempotent: true }); } catch { /* best effort */ }
    }
  })();
  downloads.set(local, task);
  void task.then(() => downloads.delete(local), () => downloads.delete(local));
  return task;
}

/**
 * Play a cached clip first, otherwise stream it and cache successful recordings
 * in the background. Starting playback never waits for the cache write. Missing
 * recordings use the bundle text (or fallbackText) through device speech.
 */
export async function playAudio(ref: string | undefined, fallbackText?: string): Promise<boolean> {
  const bundle = getBundle();
  const text = (ref && bundle.audioTexts?.[ref]) || fallbackText;
  const file = ref ? bundle.audio[ref] : undefined;
  if (!file) return speak(text);
  try {
    const local = localPath(file);
    const info = await FileSystem.getInfoAsync(local);
    const uri = info.exists ? local : audioUrl(file);
    const { sound } = await Audio.Sound.createAsync({ uri }, { shouldPlay: true });
    sound.setOnPlaybackStatusUpdate((status) => {
      if (status.isLoaded && status.didJustFinish) void sound.unloadAsync();
    });
    if (!info.exists) void cacheRecording(file);
    return true;
  } catch {
    return speak(text);
  }
}

/** Resolve false when speech is missing or the device rejects playback. */
async function speak(text: string | null | undefined): Promise<boolean> {
  if (!text) return false;
  try {
    await Speech.stop();
    return await new Promise<boolean>((resolve) => {
      Speech.speak(text, {
        language: "fil-PH", rate: 0.85,
        onDone: () => resolve(true),
        onStopped: () => resolve(true),
        onError: () => resolve(false),
      });
    });
  } catch { return false; }
}

/** Explicit full-catalog download; never run this expensive sweep on startup. */
export async function cacheAllAudio(onProgress?: (done: number, total: number) => void): Promise<void> {
  const files = [...new Set(Object.values(getBundle().audio))];
  let done = 0;
  for (const file of files) {
    await cacheRecording(file);
    done += 1;
    onProgress?.(done, files.length);
  }
}
