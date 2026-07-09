import { Audio } from "expo-av";
import * as FileSystem from "expo-file-system";
import { audioUrl } from "./api";
import { getBundle } from "./content";

// expo-av is deprecated in favor of expo-audio; swap this module when
// upgrading past SDK 53 — the rest of the app only calls playAudio/cacheAllAudio.

const audioDir = `${FileSystem.documentDirectory}audio/`;

function localPath(file: string): string {
  return audioDir + file.split("/").pop()!;
}

/** Play a clip by audio ref: local cache first, then network. Silent on failure. */
export async function playAudio(ref: string | undefined): Promise<void> {
  if (!ref) return;
  const file = getBundle().audio[ref];
  if (!file) return;
  try {
    const local = localPath(file);
    const info = await FileSystem.getInfoAsync(local);
    const uri = info.exists ? local : audioUrl(file);
    const { sound } = await Audio.Sound.createAsync({ uri }, { shouldPlay: true });
    sound.setOnPlaybackStatusUpdate((status) => {
      if (status.isLoaded && status.didJustFinish) void sound.unloadAsync();
    });
  } catch {
    // clip not recorded yet or no network — non-fatal (AUD-02)
  }
}

/** OFF-01: pull every audio clip to device storage for offline lessons. */
export async function cacheAllAudio(onProgress?: (done: number, total: number) => void): Promise<void> {
  const files = Object.values(getBundle().audio);
  await FileSystem.makeDirectoryAsync(audioDir, { intermediates: true }).catch(() => {});
  let done = 0;
  for (const file of files) {
    const local = localPath(file);
    const info = await FileSystem.getInfoAsync(local);
    if (!info.exists) {
      await FileSystem.downloadAsync(audioUrl(file), local).catch(() => {});
    }
    done += 1;
    onProgress?.(done, files.length);
  }
}
