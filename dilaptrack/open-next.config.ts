// OpenNext adapter config for Cloudflare Workers.
// Every page renders per signed-in user, so no incremental (ISR) cache is needed.
import { defineCloudflareConfig } from "@opennextjs/cloudflare";

export default defineCloudflareConfig({});
