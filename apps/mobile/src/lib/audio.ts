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

// ---- playback state -------------------------------------------------------
// One clip at a time: every playAudio call bumps `generation`, stops whatever
// is playing, and any older call that resolves late discards its result. This
// keeps rapid taps (and the auto-play on a correct answer) from stacking.

let current: Audio.Sound | null = null;
let generation = 0;
let lastKey: string | undefined;
let lastStartedAt = 0;
/** a second tap on the same clip inside this window is an accidental double-tap */
const DOUBLE_TAP_MS = 350;

let playing = false;
const listeners = new Set<() => void>();

function setPlaying(next: boolean): void {
  if (playing === next) return;
  playing = next;
  for (const l of listeners) l();
}

/** For useSyncExternalStore: whether a clip or TTS utterance is playing. */
export function isAudioPlaying(): boolean {
  return playing;
}

export function subscribeAudioPlaying(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function stopCurrent(): void {
  const s = current;
  current = null;
  if (s) void s.unloadAsync().catch(() => {}); // unloading also stops playback
}

let audioModeReady: Promise<void> | null = null;
/** iOS mutes expo-av under the ring/silent switch unless told otherwise; a
 *  tapped 🔊 should always be heard. Best-effort, once. */
function ensureAudioMode(): Promise<void> {
  if (!audioModeReady) {
    audioModeReady = Audio.setAudioModeAsync({ playsInSilentModeIOS: true }).catch(() => {});
  }
  return audioModeReady;
}

/**
 * Play a clip by audio ref: local cache first, then network. Silent on failure.
 *
 * While a recording is missing, falls back to device TTS speaking the bundle's
 * audioTexts entry (or `fallbackText`). Recorded clips always win (AUD-01).
 *
 * Replaying restarts the clip rather than layering a second copy over it; a
 * repeat of the same clip within DOUBLE_TAP_MS is ignored.
 */
export async function playAudio(ref: string | undefined, fallbackText?: string): Promise<void> {
  const key = ref ?? fallbackText;
  const now = Date.now();
  if (key !== undefined && key === lastKey && playing && now - lastStartedAt < DOUBLE_TAP_MS) return;
  lastKey = key;
  lastStartedAt = now;

  const gen = ++generation;
  stopCurrent();
  Speech.stop();

  const bundle = getBundle();
  const text = (ref && bundle.audioTexts?.[ref]) || fallbackText;
  const file = ref ? bundle.audio[ref] : undefined;
  if (!file) return speak(text, gen);
  setPlaying(true);
  let sound: Audio.Sound | null = null;
  try {
    await ensureAudioMode();
    const local = localPath(file);
    const info = await FileSystem.getInfoAsync(local);
    const uri = info.exists ? local : audioUrl(file);
    ({ sound } = await Audio.Sound.createAsync({ uri }, { shouldPlay: false }));
    if (gen !== generation) {
      // a newer tap superseded this one while it was loading
      void sound.unloadAsync().catch(() => {});
      return;
    }
    current = sound;
    const loaded = sound;
    loaded.setOnPlaybackStatusUpdate((status) => {
      const finished = status.isLoaded ? status.didJustFinish : Boolean(status.error);
      if (!finished) return;
      void loaded.unloadAsync().catch(() => {});
      if (current === loaded) {
        current = null;
        setPlaying(false);
      }
    });
    await loaded.playAsync();
  } catch {
    if (sound && current === sound) current = null;
    if (sound) void sound.unloadAsync().catch(() => {});
    if (gen !== generation) return;
    // clip not recorded yet or no network — non-fatal (AUD-02)
    speak(text, gen);
  }
}

/** Speak Tagalog text with the device voice; no-op when we have no text. */
function speak(text: string | null | undefined, gen: number): void {
  if (!text) {
    if (gen === generation) setPlaying(false);
    return;
  }
  Speech.stop(); // don't stack utterances from rapid taps
  setPlaying(true);
  // stale callbacks (an utterance cut off by a newer tap) must not clear the
  // newer one's playing state
  const done = () => {
    if (gen === generation) setPlaying(false);
  };
  Speech.speak(text, {
    language: "fil-PH",
    rate: 0.85, // learners need slower speech
    onDone: done,
    onStopped: done,
    onError: done,
  });
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
      // downloadAsync writes whatever the server returns, and a dropped
      // connection leaves a truncated file behind. Either one would sit in the
      // cache looking like a finished recording and permanently shadow both
      // the network URL and the TTS fallback, so anything that isn't a clean
      // 200 gets deleted.
      let ok = false;
      try {
        const res = await FileSystem.downloadAsync(audioUrl(file), local);
        ok = res.status === 200;
      } catch {
        ok = false; // interrupted mid-write
      }
      if (!ok) await FileSystem.deleteAsync(local, { idempotent: true }).catch(() => {});
    }
    done += 1;
    onProgress?.(done, files.length);
  }
}
