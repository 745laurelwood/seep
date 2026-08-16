import { sounds as shared, seq } from '@laurelwood/card-class';

/**
 * The shared cue set plus Seep's two moments. `build` is the package's rising
 * dyad under a name that matches what it marks here; `seep` is the ascending
 * triad the package calls `fanfare`.
 */
export const sounds = {
  ...shared,
  build: shared.reveal,
  seep: shared.fanfare,
};

export { setMuted, isMuted } from '@laurelwood/card-class';
