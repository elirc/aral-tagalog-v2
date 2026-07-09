import { noopAds, type AdsProvider } from "@aral/core";

/**
 * GAM-04: the AdMob SDK stays behind this seam. v1 ships the no-op provider;
 * when ads land (M5), add react-native-google-mobile-ads and implement
 * AdsProvider here — nothing else in the app changes. Personal builds keep
 * the noop by env flag.
 */
export const ads: AdsProvider = noopAds;
