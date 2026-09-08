import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  create: vi.fn(), info: vi.fn(), stop: vi.fn(), speak: vi.fn(),
  mkdir: vi.fn(), download: vi.fn(), move: vi.fn(), remove: vi.fn(),
}));
vi.mock("expo-av", () => ({ Audio: { Sound: { createAsync: mocks.create } } }));
vi.mock("expo-file-system", () => ({ documentDirectory: "file:///test/", getInfoAsync: mocks.info,
  makeDirectoryAsync: mocks.mkdir, downloadAsync: mocks.download,
  moveAsync: mocks.move, deleteAsync: mocks.remove }));
vi.mock("expo-speech", () => ({ stop: mocks.stop, speak: mocks.speak }));
vi.mock("./api", () => ({ audioUrl: (file: string) => "https://example.test/" + file }));
vi.mock("./content", () => ({ getBundle: () => ({ audio: { recorded: "audio/hello.mp3" }, audioTexts: { recorded: "Kumusta" } }) }));
import { cacheAllAudio, playAudio } from "./audio";

beforeEach(() => {
  vi.resetAllMocks();
  mocks.stop.mockResolvedValue(undefined);
  mocks.info.mockResolvedValue({ exists: false });
  mocks.mkdir.mockResolvedValue(undefined);
  mocks.download.mockResolvedValue({ status: 200, headers: { "Content-Type": "audio/mpeg" } });
  mocks.move.mockResolvedValue(undefined);
  mocks.remove.mockResolvedValue(undefined);
  mocks.speak.mockImplementation((_text, options) => options.onDone());
});

describe("audio availability", () => {
  it("reports missing audio and text without starting speech", async () => {
    expect(await playAudio(undefined)).toBe(false);
    expect(mocks.speak).not.toHaveBeenCalled();
  });
  it("speaks fallback text with the Tagalog voice", async () => {
    expect(await playAudio(undefined, "Salamat")).toBe(true);
    expect(mocks.speak).toHaveBeenCalledWith("Salamat", expect.objectContaining({ language: "fil-PH", rate: 0.85 }));
  });
  it("reports a device speech failure", async () => {
    mocks.speak.mockImplementation((_text, options) => options.onError());
    expect(await playAudio(undefined, "Salamat")).toBe(false);
  });
  it("handles a rejected native speech call", async () => {
    mocks.stop.mockRejectedValue(new Error("Speech unavailable"));
    expect(await playAudio(undefined, "Salamat")).toBe(false);
  });
  it("falls back to speech when the recording cannot load", async () => {
    mocks.create.mockRejectedValue(new Error("Offline"));
    expect(await playAudio("recorded")).toBe(true);
    expect(mocks.speak).toHaveBeenCalledWith("Kumusta", expect.anything());
  });
  it("plays a cached recording and releases it after completion", async () => {
    mocks.info.mockResolvedValue({ exists: true });
    const unloadAsync = vi.fn().mockResolvedValue(undefined);
    const setOnPlaybackStatusUpdate = vi.fn();
    mocks.create.mockResolvedValue({ sound: { setOnPlaybackStatusUpdate, unloadAsync } });
    expect(await playAudio("recorded")).toBe(true);
    expect(mocks.create).toHaveBeenCalledWith({ uri: "file:///test/audio/hello.mp3" }, { shouldPlay: true });
    setOnPlaybackStatusUpdate.mock.calls[0]![0]({ isLoaded: true, didJustFinish: true });
    expect(unloadAsync).toHaveBeenCalledOnce();
    expect(mocks.speak).not.toHaveBeenCalled();
  });
});


describe("recording cache", () => {
  it("starts remote playback without waiting for the background download", async () => {
    let finish!: (result: { status: number; headers: Record<string, string> }) => void;
    mocks.download.mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
    mocks.create.mockResolvedValue({ sound: { setOnPlaybackStatusUpdate: vi.fn() } });
    expect(await playAudio("recorded")).toBe(true);
    expect(mocks.create).toHaveBeenCalledWith({ uri: "https://example.test/audio/hello.mp3" }, { shouldPlay: true });
    const sweep = cacheAllAudio();
    await vi.waitFor(() => expect(mocks.download).toHaveBeenCalledOnce());
    expect(mocks.move).not.toHaveBeenCalled();
    finish({ status: 200, headers: { "content-type": "audio/mpeg" } });
    await sweep;
    expect(mocks.move).toHaveBeenCalledWith({ from: "file:///test/audio/hello.mp3.download", to: "file:///test/audio/hello.mp3" });
  });

  it("deduplicates simultaneous requests and reports each caller's progress", async () => {
    const first = vi.fn();
    const second = vi.fn();
    await Promise.all([cacheAllAudio(first), cacheAllAudio(second)]);
    expect(mocks.download).toHaveBeenCalledOnce();
    expect(first).toHaveBeenCalledWith(1, 1);
    expect(second).toHaveBeenCalledWith(1, 1);
  });

  it("keeps HTTP error bodies out of the playable cache", async () => {
    mocks.download.mockResolvedValue({ status: 404 });
    await cacheAllAudio();
    expect(mocks.move).not.toHaveBeenCalled();
    expect(mocks.remove).toHaveBeenCalledWith("file:///test/audio/hello.mp3.download", { idempotent: true });
  });

  it("rejects a successful HTTP response that contains a non-audio error page", async () => {
    mocks.download.mockResolvedValue({ status: 200, headers: { "Content-Type": "text/html" } });
    await cacheAllAudio();
    expect(mocks.move).not.toHaveBeenCalled();
    expect(mocks.remove).toHaveBeenCalledWith("file:///test/audio/hello.mp3.download", { idempotent: true });
  });

  it("cleans interrupted writes and permits a later retry", async () => {
    mocks.download.mockRejectedValueOnce(new Error("Offline"));
    await cacheAllAudio();
    expect(mocks.move).not.toHaveBeenCalled();
    expect(mocks.remove).toHaveBeenCalledOnce();
    await cacheAllAudio();
    expect(mocks.download).toHaveBeenCalledTimes(2);
    expect(mocks.move).toHaveBeenCalledOnce();
  });

  it("skips downloading recordings already available offline", async () => {
    mocks.info.mockResolvedValue({ exists: true });
    await cacheAllAudio();
    expect(mocks.download).not.toHaveBeenCalled();
    expect(mocks.mkdir).not.toHaveBeenCalled();
  });

  it("does not start another recording request when playback falls back to speech", async () => {
    mocks.create.mockRejectedValue(new Error("Recording unavailable"));
    expect(await playAudio("recorded")).toBe(true);
    expect(mocks.download).not.toHaveBeenCalled();
  });
});
