import type { CourseBundle } from "@aral/core";

// The compiler validates the JSON at build time. Type consumers should not
// infer thousands of lesson literals from the entire generated course bundle.
declare const bundle: CourseBundle;
export default bundle;
