import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  create: vi.fn(), info: vi.fn(), stop: vi.fn(), speak: vi.fn(),
}));
vi.mock("expo-av", () => ({ Audio: { Sound: { createAsync: mocks.create } } }));
vi.mock("expo-file-system", () => ({ documentDirectory: "file:///test/", getInfoAsync: mocks.info }));
vi.mock("expo-speech", () => ({ stop: mocks.stop, speak: mocks.speak }));
vi.mock("./api", () => ({ audioUrl: (file: string) => "https://example.test/" + file }));
vi.mock("./content", () => ({ getBundle: () => ({ audio: { recorded: "audio/hello.mp3" }, audioTexts: { recorded: "Kumusta" } }) }));
import { playAudio } from "./audio";

beforeEach(() => {
  vi.resetAllMocks();
  mocks.stop.mockResolvedValue(undefined);
  mocks.info.mockResolvedValue({ exists: false });
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
