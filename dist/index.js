import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import Schema from '@deepseek-ai/schemastery';
export const name = 'dsh-flash-proxy';
// No host-side hard dependencies; all services are injected lazily.
export const inject = [];
// ── Constants ─────────────────────────────────────────────────────────────
const DEFAULT_MODE = 'all-proxy';
const DEFAULT_CUSTOM = '';
const DEFAULT_TEST_URL = 'https://www.google.com/generate_204';
const TEST_TIMEOUT_MS = 10000;
const MAX_REDIRECTS = 5;
const BODY_SNIPPET_LIMIT = 200;
const API_BYPASS_DOMAINS = 'api.deepseek.com,chat.deepseek.com';
const LAUNCH_ENVIRONMENT_SERVICE = 'launchEnvironment';
export const Config = Schema.object({
    proxyMode: Schema.string().default(DEFAULT_MODE).volatile(),
    customNoProxy: Schema.string().default(DEFAULT_CUSTOM).volatile(),
    testUrl: Schema.string().default(DEFAULT_TEST_URL).volatile(),
    useProxy: Schema.boolean().default(true).volatile(),
});
export function apply(ctx, config) {
    // TODO: Task 2 fills in the proxy policy and routes
    console.log('[dsh-flash-proxy] apply() — skeleton loaded');
}
