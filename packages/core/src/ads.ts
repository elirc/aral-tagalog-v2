/**
 * Ads are isolated behind this interface (GAM-04) so the AdMob SDK only ever
 * touches the mobile app, and personal/dev builds can swap in noopAds.
 */
export interface AdsProvider {
  isRewardedAvailable(): Promise<boolean>;
  /** resolves true if the user earned the reward (watched the ad) */
  showRewarded(): Promise<boolean>;
  showInterstitial(): Promise<void>;
}

export const noopAds: AdsProvider = {
  isRewardedAvailable: async () => false,
  showRewarded: async () => false,
  showInterstitial: async () => {},
};

/** show an interstitial after every N lesson completions (mobile only) */
export const INTERSTITIAL_EVERY_N_LESSONS = 3;
