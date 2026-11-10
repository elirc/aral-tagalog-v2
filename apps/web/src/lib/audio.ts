import { bundle } from "./content";
import { audioUrl } from "./api";

/**
 * Play a clip by audio ref. Resolves false when the clip is missing or
 * playback fails, so exercises that *depend* on audio (listen) can surface
 * an "audio unavailable" state instead of being silently unanswerable.
 * Decorative callers can ignore the result (AUD-02 fills gaps later).
 *
 * While a recording is missing, falls back to browser TTS speaking the
 * bundle's audioTexts entry (or `fallbackText`) with a Filipino voice when
 * the device has one. Recorded clips always win once they exist.
 */
let current: HTMLAudioElement | null = null;

export function playAudio(ref: string | undefined, fallbackText?: string): Promise<boolean> {
  stopAudio(); // rapid taps replace the playing clip instead of layering over it
  const text = (ref && bundle.audioTexts?.[ref]) || fallbackText;
  if (!ref) return text ? speak(text) : Promise.resolve(false);
  const file = bundle.audio[ref];
  if (!file) return text ? speak(text) : Promise.resolve(false);
  const el = new Audio(audioUrl(file));
  current = el;
  return el.play().then(
    () => true,
    // clip not recorded yet or autoplay blocked — but a pause() from a newer
    // tap rejects this pending play() with AbortError, and that must not
    // speak the OLD clip's text over the newer clip
    (err) =>
      current === el && (err as DOMException | undefined)?.name !== "AbortError" && text
        ? speak(text)
        : false,
  );
}

function stopAudio() {
  if (current) {
    current.pause();
    current = null;
  }
  // a new clip should also cut short a TTS fallback still speaking
  if (typeof window !== "undefined" && "speechSynthesis" in window) speechSynthesis.cancel();
}

function pickVoice(): SpeechSynthesisVoice | null {
  // "fil"/"tl" voices exist on most phones; desktop coverage varies
  const voices = speechSynthesis.getVoices();
  return voices.find((v) => /^(fil|tl)\b|-PH/i.test(v.lang)) ?? null;
}

function speak(text: string): Promise<boolean> {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    return Promise.resolve(false);
  }
  return new Promise((resolve) => {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "fil-PH";
    const voice = pickVoice();
    if (voice) u.voice = voice;
    u.rate = 0.85; // learners need slower-than-native speech
    u.onend = () => resolve(true);
    u.onerror = () => resolve(false);
    speechSynthesis.cancel(); // don't stack utterances from rapid taps
    speechSynthesis.speak(u);
  });
}
