import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// No incremental cache. Every game screen renders on the client from the
// API, so there is nothing server-side worth caching — and leaving it out
// means the deploy needs no R2 bucket.
export default defineCloudflareConfig({});
