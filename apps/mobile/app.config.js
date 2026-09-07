/** Expo embeds this public URL in the native binary at build time. */
module.exports = ({ config }) => {
  const release = process.env.NODE_ENV === "production" ||
    (!!process.env.EAS_BUILD_PROFILE && process.env.EAS_BUILD_PROFILE !== "development");
  const configured = process.env.EXPO_PUBLIC_API_URL?.trim() || config.extra?.apiUrl;
  if (release && !configured) {
    throw new Error("Set EXPO_PUBLIC_API_URL to your HTTPS API before building a release.");
  }
  const apiUrl = (configured || "http://localhost:3001").replace(/\/+$/, "");
  let parsed;
  try {
    parsed = new URL(apiUrl);
  } catch {
    throw new Error("EXPO_PUBLIC_API_URL must be a valid HTTP(S) URL.");
  }
  if (!["http:", "https:"].includes(parsed.protocol) || parsed.username || parsed.password ||
      parsed.search || parsed.hash) {
    throw new Error("EXPO_PUBLIC_API_URL must be an HTTP(S) URL without credentials, query, or fragment.");
  }
  const loopback = ["localhost", "0.0.0.0", "[::1]"].includes(parsed.hostname) ||
    parsed.hostname.startsWith("127.") || parsed.hostname.endsWith(".localhost");
  if (release && (parsed.protocol !== "https:" || loopback)) {
    throw new Error("Release builds require a deployed HTTPS EXPO_PUBLIC_API_URL.");
  }
  return { ...config, extra: { ...config.extra, apiUrl } };
};
