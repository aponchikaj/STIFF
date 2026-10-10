import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import staticAssetsIncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/static-assets-incremental-cache";

// Read-only cache served from the Worker's own static assets — no R2 bucket.
//
// It is not optional. The opal pages (`/play/001`–`003`) are prerendered with
// `dynamicParams = false`, and with no incremental cache at all the prerender
// is never found, so Next answers every one of them with its 404. Nothing
// here revalidates, which is the case this cache is for: every game screen
// still renders on the client from the API.
export default defineCloudflareConfig({
  incrementalCache: staticAssetsIncrementalCache,
  enableCacheInterception: true,
});
