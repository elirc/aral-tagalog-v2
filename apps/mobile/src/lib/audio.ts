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
 * Play a clip by audio ref: local cache first, then network. Never throws.
 *
 * Resolves true once something is audible (the recording started, or the TTS
 * fallback began speaking) and false when nothing could be played — no
 * recording and no text to speak, or the device's speech engine failed. A
 * listen exercise uses that to show its sentence instead of leaving the
 * learner to guess (see TapsView). A call superseded by a newer one resolves
 * true: it says nothing about whether audio works.
 *
 * While a recording is missing, falls back to device TTS speaking the bundle's
 * audioTexts entry (or `fallbackText`). Recorded clips always win (AUD-01).
 *
 * Replaying restarts the clip rather than layering a second copy over it; a
 * repeat of the same clip within DOUBLE_TAP_MS is ignored.
 */
export async function playAudio(ref: string | undefined, fallbackText?: string): Promise<boolean> {
  const key = ref ?? fallbackText;
  const now = Date.now();
  if (key !== undefined && key === lastKey && playing && now - lastStartedAt < DOUBLE_TAP_MS) return true;
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
      return true;
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
    return true;
  } catch {
    if (sound && current === sound) current = null;
    if (sound) void sound.unloadAsync().catch(() => {});
    if (gen !== generation) return true;
    // clip not recorded yet or no network — non-fatal (AUD-02)
    return speak(text, gen);
  }
}

/** how long to wait for the speech engine to report anything before calling
 *  it unavailable (a cold Android TTS engine can take a second or two) */
const SPEECH_START_TIMEOUT_MS = 4000;

/**
 * Speak Tagalog text with the device voice. Resolves true once the utterance
 * starts (or was cut off by a newer tap), false when there is no text, the
 * engine errors, or it never reports back.
 */
function speak(text: string | null | undefined, gen: number): Promise<boolean> {
  if (!text) {
    if (gen === generation) setPlaying(false);
    return Promise.resolve(false);
  }
  Speech.stop(); // don't stack utterances from rapid taps
  setPlaying(true);
  return new Promise<boolean>((resolve) => {
    let settled = false;
    const settle = (ok: boolean) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(ok);
    };
    // stale callbacks (an utterance cut off by a newer tap) must not clear the
    // newer one's playing state
    const done = () => {
      if (gen === generation) setPlaying(false);
    };
    const timer = setTimeout(() => {
      // superseded calls are not evidence that speech is broken
      settle(gen !== generation);
      done();
    }, SPEECH_START_TIMEOUT_MS);
    try {
      Speech.speak(text, {
        language: "fil-PH",
        rate: 0.85, // learners need slower speech
        onStart: () => settle(true),
        onDone: () => {
          settle(true);
          done();
        },
        onStopped: () => {
          settle(true);
          done();
        },
        onError: () => {
          settle(false);
          done();
        },
      });
    } catch {
      settle(false);
      done();
    }
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
        // network failure (offline / server unreachable / interrupted
        // mid-write): drop the partial file and end this pass rather than
        // firing one doomed request per clip; the next launch resumes, since
        // finished files are skipped
        await FileSystem.deleteAsync(local, { idempotent: true }).catch(() => {});
        return;
      }
      if (!ok) await FileSystem.deleteAsync(local, { idempotent: true }).catch(() => {});
    }
    done += 1;
    onProgress?.(done, files.length);
  }
}
