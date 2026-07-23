import { Audio } from "expo-av";
import * as FileSystem from "expo-file-system";
import * as Speech from "expo-speech";
import { audioUrl } from "./api";
import { getBundle } from "./content";

// expo-av is deprecated in favor of expo-audio; swap this module when
// upgrading past SDK 53 — the rest of the app only calls playAudio/cacheAllAudio.

const audioDir = `${FileSystem.documentDirectory}audio/`;

function localPath(file: string): string {
  return audioDir + file.split("/").pop()!;
}

/**
 * Play a clip by audio ref: local cache first, then network. Silent on failure.
 *
 * While a recording is missing, falls back to device TTS speaking the bundle's
 * audioTexts entry (or `fallbackText`). Recorded clips always win (AUD-01).
 */
export async function playAudio(ref: string | undefined, fallbackText?: string): Promise<void> {
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
  } catch {
    // clip not recorded yet or no network — non-fatal (AUD-02)
    speak(text);
  }
}

/** Speak Tagalog text with the device voice; no-op when we have no text. */
function speak(text: string | null | undefined): void {
  if (!text) return;
  Speech.stop(); // don't stack utterances from rapid taps
  Speech.speak(text, { language: "fil-PH", rate: 0.85 }); // learners need slower speech
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
      // downloadAsync writes whatever the server returns — a 404 body saved as
      // .mp3 would permanently shadow the network/TTS fallback, so discard it
      const res = await FileSystem.downloadAsync(audioUrl(file), local).catch(() => null);
      if (res && res.status !== 200) {
        await FileSystem.deleteAsync(local, { idempotent: true }).catch(() => {});
      }
    }
    done += 1;
    onProgress?.(done, files.length);
  }
}
