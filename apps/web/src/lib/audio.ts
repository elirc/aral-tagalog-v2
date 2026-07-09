import { bundle } from "./content";
import { audioUrl } from "./api";

/** Play a clip by audio ref. Fails silently if the clip isn't recorded yet. */
export function playAudio(ref: string | undefined): void {
  if (!ref) return;
  const file = bundle.audio[ref];
  if (!file) return;
  const el = new Audio(audioUrl(file));
  void el.play().catch(() => {
    // clip missing or autoplay blocked — non-fatal (AUD-02 fills gaps later)
  });
}
