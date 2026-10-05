// dsh-flash-proxy — HOST half of the system proxy control plugin.
//
// Registers the 'dsh-flash-proxy' settings namespace (proxyMode, customNoProxy,
// testUrl) and re-installs the undici global dispatcher via
// @deepseek-ai/dsh-http-proxy so outbound requests respect the user's NO_PROXY
// choice. Exposes HTTP routes for the client to query proxy status and test
// the connection.
import type { Context } from '@deepseek-ai/cordis'
import type { IncomingMessage, ServerResponse } from 'node:http'
import type {} from '@deepseek-ai/dsh-settings'

import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import type { Volatile } from '@deepseek-ai/cordis'
import Schema from '@deepseek-ai/schemastery'

export const name = 'dsh-flash-proxy'

// No host-side hard dependencies; all services are injected lazily.
export const inject: string[] = []

// ── Constants ─────────────────────────────────────────────────────────────
const DEFAULT_MODE = 'all-proxy'
const DEFAULT_CUSTOM = ''
const DEFAULT_TEST_URL = 'https://www.google.com/generate_204'
const TEST_TIMEOUT_MS = 10000
const MAX_REDIRECTS = 5
const BODY_SNIPPET_LIMIT = 200
const API_BYPASS_DOMAINS = 'api.deepseek.com,chat.deepseek.com'

const LAUNCH_ENVIRONMENT_SERVICE = 'launchEnvironment'

// ── Config ────────────────────────────────────────────────────────────────
export interface ProxyConfig {
  proxyMode: Volatile<string>
  customNoProxy: Volatile<string>
  testUrl: Volatile<string>
  useProxy?: Volatile<boolean>
}

export const Config = Schema.object({
  proxyMode: Schema.string().default(DEFAULT_MODE).volatile(),
  customNoProxy: Schema.string().default(DEFAULT_CUSTOM).volatile(),
  testUrl: Schema.string().default(DEFAULT_TEST_URL).volatile(),
  useProxy: Schema.boolean().default(true).volatile(),
})

export function apply(ctx: Context, config: ProxyConfig) {
  // TODO: Task 2 fills in the proxy policy and routes
  console.log('[dsh-flash-proxy] apply() — skeleton loaded')
}
