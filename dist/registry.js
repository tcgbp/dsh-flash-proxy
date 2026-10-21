// dsh-flash-proxy — system proxy reader and mapper (Windows + macOS).
//
// The plugin's "use system proxy" source reads the *active network interface's*
// system proxy configuration and turns it into the same { http, https, all } +
// NO_PROXY shape the rest of the plugin already consumes, so a system-derived
// proxy can be fed through the exact same undici routing path as an
// environment-variable proxy.
//
// Two backends, one normalized shape:
//
// - Windows — `reg query` of the WinINet Internet Settings key
//   (HKCU\Software\Microsoft\Windows\CurrentVersion\Internet Settings).
// - macOS   — `scutil --proxy` of the active network service (System Settings
//   → Network → Proxies). macOS does NOT export the proxy as an environment
//   variable by default, which is exactly why DSH on macOS never sees it — this
//   reader is the equivalent of the Windows registry read.
//
// Everything here is OCI: pure functions plus one thin command runner that is
// injected, so tests can supply a fake without touching the real system and
// unsupported hosts never execute a single child process.
//
// The module must NEVER throw into the plugin apply path. Every read is
// wrapped so a missing binary, a permission denial, or a timeout yields a
// degraded snapshot instead of failing the plugin's Cordis fiber.
import { execFile } from 'node:child_process';
export const WININET_KEY = 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings';
/** True only on Windows — the WinINet registry semantics apply only there. */
export function isWindows() {
    return typeof process !== 'undefined' && process.platform === 'win32';
}
/** True only on macOS — system proxy lived in the active network service. */
export function isMacOS() {
    return typeof process !== 'undefined' && process.platform === 'darwin';
}
/** True where the plugin can read the system proxy (Windows and macOS). */
export function systemProxySupported() {
    return isWindows() || isMacOS();
}
/** Default runner: `reg query` with stdio hidden and a bounded timeout. */
export function regQueryRunner(command, args, timeoutMs) {
    return new Promise((resolve, reject) => {
        execFile(command, args, {
            windowsHide: true,
            timeout: timeoutMs,
            maxBuffer: 1024 * 1024,
        }, (err, stdout) => {
            if (err)
                reject(err);
            else
                resolve(String(stdout || ''));
        });
    });
}
/**
 * Read the WinINet Internet Settings key and parse the values we care about.
 *
 * @param runner   command runner (injectable; defaults to regQueryRunner)
 * @param timeoutMs per-reg-query timeout
 */
export async function readWinINetRegistry(runner = regQueryRunner, timeoutMs = 4000) {
    const degraded = {
        proxyEnable: false,
        proxyServer: '',
        proxyOverride: '',
        autoConfigUrl: null,
        autoDetect: false,
    };
    if (!isWindows()) {
        return { ...degraded, error: 'registry-unsupported-platform' };
    }
    let out;
    try {
        out = await runner('reg', ['query', WININET_KEY], timeoutMs);
    }
    catch (e) {
        return { ...degraded, error: e?.code || (e?.message ? `reg: ${e.message}` : 'reg-query-failed') };
    }
    try {
        return parseWinINetOutput(out);
    }
    catch (e) {
        return { ...degraded, error: e?.message ? `parse: ${e.message}` : 'reg-parse-failed' };
    }
}
/**
 * Read the macOS active network service's proxy settings and normalize them.
 *
 * Runs `scutil --proxy --json` (the JSON form is available since macOS 10.13
 * and is far easier to parse than the legacy text `scutil --proxy` output).
 * If the JSON variant is not available the call fails and we fall back to the
 * legacy output parsed by parseMacOSProxyText().
 *
 * The normalized proxyServer is synthesized from the per-protocol
 * HTTPProxy/HTTPPort and HTTPSProxy/HTTPSPort values into the same segmented
 * `http=…;https=…` string the Windows mapper understands, so the shared
 * proxyServerToEnv() handles the rest. MacOS's system proxy lives solely in
 * System Settings / scutil — it is NOT exported as an environment variable,
 * which is exactly the gap this reader fills for DSH on macOS.
 *
 * @param runner   command runner (injectable; same child-process runner as reg)
 * @param timeoutMs per-`scutil` timeout
 */
export async function readMacOSProxy(runner = regQueryRunner, timeoutMs = 4000) {
    const degraded = {
        proxyEnable: false,
        proxyServer: '',
        proxyOverride: '',
        autoConfigUrl: null,
        autoDetect: false,
    };
    if (!isMacOS()) {
        return { ...degraded, error: 'macos-unsupported-platform' };
    }
    // Prefer the JSON form of `scutil --proxy`; fall back to the legacy text.
    try {
        const json = await runner('scutil', ['--proxy', '--json'], timeoutMs);
        const parsed = parseMacOSProxyJson(json);
        if (!parsed.error)
            return parsed;
        // JSON parsing failed — try the legacy text form below.
    }
    catch (_) {
        // `scutil --proxy --json` is not supported here; try the legacy form.
    }
    try {
        const text = await runner('scutil', ['--proxy'], timeoutMs);
        return parseMacOSProxyText(text);
    }
    catch (e) {
        return { ...degraded, error: e?.code || (e?.message ? `scutil: ${e.message}` : 'scutil-query-failed') };
    }
}
/**
 * Parse `scutil --proxy --json` output into a normalized snapshot.
 *
 * The dictionary contains, when enabled:
 *   HTTPEnable: 1, HTTPProxy: "127.0.0.1", HTTPPort: 7890
 *   HTTPSEnable: 1, HTTPSProxy: "127.0.0.1", HTTPSPort: 7890
 *   ProxyAutoConfigEnable: 1, ProxyAutoConfigURLString: "http://…/proxy.pac"
 *   ExceptionsList: ["localhost", "127.0.0.1", "*.local"]
 *
 * Exported so tests can feed a fixture without a real `scutil`.
 */
export function parseMacOSProxyJson(jsonText) {
    const degraded = {
        proxyEnable: false,
        proxyServer: '',
        proxyOverride: '',
        autoConfigUrl: null,
        autoDetect: false,
    };
    let data;
    try {
        data = JSON.parse(String(jsonText || ''));
    }
    catch (_) {
        return { ...degraded, error: 'scutil-json-parse-failed' };
    }
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
        return { ...degraded, error: 'scutil-json-parse-failed' };
    }
    const httpEnabled = dwordish(data.HTTPEnable);
    const httpsEnabled = dwordish(data.HTTPSEnable);
    const http = httpEnabled ? macEndpoint(data.HTTPProxy, data.HTTPPort) : null;
    const https = httpsEnabled ? macEndpoint(data.HTTPSProxy, data.HTTPSPort) : null;
    const serverParts = [];
    if (http)
        serverParts.push('http=' + http);
    if (https)
        serverParts.push('https=' + https);
    const exceptions = Array.isArray(data.ExceptionsList)
        ? data.ExceptionsList
            .map((x) => String(x ?? '').trim())
            .filter((x) => x !== '')
        : [];
    const autoConfigUrl = strOrNull(data.ProxyAutoConfigURLString);
    return {
        proxyEnable: httpEnabled || httpsEnabled,
        proxyServer: serverParts.join(';'),
        // Keep the ;-separated form so the shared NO_PROXY parser understands it.
        proxyOverride: exceptions.join(';'),
        autoConfigUrl,
        autoDetect: dwordish(data.ProxyAutoConfigEnable),
    };
}
/**
 * Fallback for older macOS builds where `scutil --proxy --json` is absent:
 * parse the legacy `scutil --proxy` text dictionary, e.g.
 *   HTTPEnable : 1
 *   HTTPProxy : 127.0.0.1
 *   HTTPPort : 7890
 *   HTTPSEnable : 1
 *   ExceptionsList : <array> { 0 : "localhost" 1 : "*.local" }
 *   ProxyAutoConfigEnable : 0
 *   ProxyAutoConfigURLString : http://…/proxy.pac
 * Accepts the same keys, in both `name : value` and `name = value` forms.
 */
export function parseMacOSProxyText(text) {
    const degraded = {
        proxyEnable: false,
        proxyServer: '',
        proxyOverride: '',
        autoConfigUrl: null,
        autoDetect: false,
    };
    const values = {};
    const exceptions = [];
    const lines = String(text || '').split(/\r?\n/);
    for (const raw of lines) {
        const line = raw.trim();
        if (!line)
            continue;
        const m = /^([A-Za-z0-9_]+)\s*[:=]\s*(.*)$/.exec(line);
        if (!m)
            continue;
        const name = m[1];
        const rest = m[2].trim();
        if (name === 'ExceptionsList') {
            // <array> { 0 : "localhost" 1 : "*.local" }
            const items = rest.match(/"([^"]*)"/g) || [];
            for (const it of items)
                exceptions.push(it.replace(/"/g, ''));
            continue;
        }
        values[name] = rest;
    }
    const httpEnabled = dwordish(values.HTTPEnable);
    const httpsEnabled = dwordish(values.HTTPSEnable);
    const http = httpEnabled ? macEndpoint(values.HTTPProxy, values.HTTPPort) : null;
    const https = httpsEnabled ? macEndpoint(values.HTTPSProxy, values.HTTPSPort) : null;
    const serverParts = [];
    if (http)
        serverParts.push('http=' + http);
    if (https)
        serverParts.push('https=' + https);
    return {
        proxyEnable: httpEnabled || httpsEnabled,
        proxyServer: serverParts.join(';'),
        proxyOverride: exceptions.join(';'),
        autoConfigUrl: strOrNull(values.ProxyAutoConfigURLString),
        autoDetect: dwordish(values.ProxyAutoConfigEnable),
    };
}
/**
 * Read the system proxy on the current platform (Windows registry or macOS
 * scutil), returning a normalized snapshot. On any other platform it returns
 * a degraded snapshot with error = 'system-proxy-unsupported-platform' and
 * never touches a child process.
 */
export async function readSystemProxy(runner, timeoutMs) {
    if (isWindows())
        return readWinINetRegistry(runner, timeoutMs);
    if (isMacOS())
        return readMacOSProxy(runner, timeoutMs);
    const degraded = {
        proxyEnable: false,
        proxyServer: '',
        proxyOverride: '',
        autoConfigUrl: null,
        autoDetect: false,
    };
    return { ...degraded, error: 'system-proxy-unsupported-platform' };
}
/**
 * Normalize a macOS proxy host/port pair into `host:port` (scheme-less, so it
 * can be embedded in a segmented http=…;https=… string). Returns null when
 * there is no usable host.
 */
function macEndpoint(proxy, port) {
    const host = String(proxy ?? '').trim();
    if (!host)
        return null;
    const p = Number(port);
    const portStr = Number.isInteger(p) && p >= 1 && p <= 65535 ? String(p) : '';
    return host + (portStr ? ':' + portStr : '');
}
/** Treat a value (0/1, "0"/"1", true/false, or "0xN") as a boolean. */
function dwordish(v) {
    if (typeof v === 'boolean')
        return v;
    if (typeof v === 'number')
        return v !== 0;
    if (typeof v === 'string') {
        const m = /0x([0-9a-fA-F]+)/.exec(v.trim());
        if (m)
            return parseInt(m[1], 16) !== 0;
        const n = Number(v.trim());
        if (Number.isFinite(n))
            return n !== 0;
        return v.toLowerCase() === 'true';
    }
    return false;
}
/** Collapse a value into a trimmed string or null. */
function strOrNull(v) {
    const s = String(v ?? '').trim();
    return s === '' || s === 'null' ? null : s;
}
/**
 * Parse the `reg query` output for the WinINet key into a structured snapshot.
 *
 * `reg query HKCU\...\Internet Settings` prints lines like:
 *   ProxyEnable    REG_DWORD    0x1
 *   ProxyServer    REG_SZ       http=http://127.0.0.1:7890;https=http://127.0.0.1:7890
 *   ProxyOverride  REG_SZ       <local>;*.example.com;10.0.0.0
 *   AutoConfigURL  REG_SZ       http://proxy/pac
 *   AutoDetect     REG_DWORD    0x0
 *
 * DWORD values are read as their final "0x..." token. REG_SZ values are the
 * remainder after the type column. Crucially, we must NOT stop at the first
 * matching value per name in a way that loses later values, and we must not
 * rely on section banners (`\[HKEY...\]`) since we query a single leaf key.
 */
export function parseWinINetOutput(output) {
    const snapshot = {
        proxyEnable: false,
        proxyServer: '',
        proxyOverride: '',
        autoConfigUrl: null,
        autoDetect: false,
    };
    const lines = String(output || '').split(/\r?\n/);
    for (const raw of lines) {
        const line = raw.trim();
        if (!line)
            continue;
        // Skip registry section banners when present.
        if (/^\[[Hh][Kk][A-Za-z0-9_\\]+\]$/.test(line))
            continue;
        const name = line.split(/\s+/)[0];
        // Find the value type (REG_DWORD / REG_SZ / ...) or the raw string.
        const typeMatch = /^\S+\s+(REG_\w+)(?:\s+(.*))?$/.exec(line);
        const after = typeMatch ? (typeMatch[2] || '') : line.slice(name.length).trim();
        switch (name.toUpperCase()) {
            case 'PROXYENABLE':
                snapshot.proxyEnable = dwordToBool(after);
                break;
            case 'PROXYSERVER':
                // Strip surrounding quotes.
                snapshot.proxyServer = stripQuotes(after);
                break;
            case 'PROXYOVERRIDE':
                snapshot.proxyOverride = stripQuotes(after);
                break;
            case 'AUTOCONFIGURL':
                snapshot.autoConfigUrl = stripQuotes(after) || null;
                break;
            case 'AUTODETECT':
                snapshot.autoDetect = dwordToBool(after);
                break;
            default:
                // Ignore other values (MigrateProxy, ProxyHttp1.1, etc.).
                break;
        }
    }
    return snapshot;
}
/** Read a registry DWORD's trailing hex token into a boolean. */
function dwordToBool(text) {
    const m = /0x([0-9a-fA-F]+)/.exec(text);
    if (!m)
        return false;
    return parseInt(m[1], 16) !== 0;
}
function stripQuotes(s) {
    const t = String(s ?? '').trim();
    if (t.length >= 2 && t.startsWith('"') && t.endsWith('"'))
        return t.slice(1, -1);
    return t;
}
/**
 * Convert WinINet's `;`-separated ProxyOverride into NO_PROXY's `,`-separated
 * list. The Windows `<local>` pseudo-token (bypass for local/intranet hosts) is
 * dropped — this plugin's grammar accepts host/domain/IP/port, not `<local>` —
 * and the callers decide whether to append `*` separately.
 */
export function proxyOverrideToNoProxy(override) {
    const raw = String(override ?? '');
    const parts = raw
        .split(';')
        .map((p) => p.trim())
        .filter((p) => p !== '' && p.toLowerCase() !== '<local>');
    if (parts.length === 0)
        return null;
    return parts.join(',');
}
/**
 * Translate a WinINet ProxyServer value into { http, https, all }.
 *
 * Confirmed policy: a plain `host:port` (no `=` segments) is treated as the
 * address for BOTH http and https (and surfaced under `all` for display), which
 * matches how WinINet applies a single endpoint to every protocol. A segmented
 * `http=…;https=…;ftp=…` value is parsed per protocol — each present segment
 * fills its own protocol; a segment may carry its own scheme.
 */
export function proxyServerToEnv(proxyServer) {
    const raw = String(proxyServer ?? '').trim();
    if (!raw)
        return { http: null, https: null, all: null };
    const segmented = /(^|;)\s*(https?|ftp) *=/i.test(raw);
    if (segmented) {
        const httpSeg = extractSegment(raw, 'http');
        const httpsSeg = extractSegment(raw, 'https');
        // Per the confirmed policy, only fill the protocols a segment exists for.
        // When no https segment is present but an http one is, reuse the http
        // endpoint for https as the single-endpoint convenience (same as plain
        // host:port) — this mirrors WinINET applying one address to every protocol.
        const http = httpSeg ? normalizeEndpoint(httpSeg, false) : null;
        const https = httpsSeg
            ? normalizeEndpoint(httpsSeg, true)
            : (http ? normalizeEndpoint(http, true) : null);
        return { http, https: https || null, all: null };
    }
    // Plain host[:port].
    const endpoint = normalizeEndpoint(raw, false);
    return endpoint
        ? { http: endpoint, https: endpoint, all: endpoint }
        : { http: null, https: null, all: null };
}
/** Pull the value following `name=` out of a segmented ProxyServer string. */
function extractSegment(segments, name) {
    const m = new RegExp('(?:^|;)\\s*' + name + '\\s*=\\s*([^;]*)', 'i').exec(segments);
    if (!m)
        return null;
    const v = m[1].trim();
    return v === '' ? null : v;
}
/**
 * Normalize a raw endpoint (which may already carry a scheme) into
 * scheme://host:port. `forHttps` selects the default port when none is given.
 */
function normalizeEndpoint(raw, forHttps) {
    let s = String(raw ?? '').trim();
    if (!s)
        return null;
    if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(s)) {
        s = (forHttps ? 'https://' : 'http://') + s;
    }
    try {
        const u = new URL(s);
        if (u.protocol !== 'http:' && u.protocol !== 'https:')
            return null;
        const host = u.hostname;
        if (!host)
            return null;
        const defaultPort = u.protocol === 'https:' ? 443 : 80;
        const port = u.port ? Number(u.port) : defaultPort;
        if (!(Number.isInteger(port) && port >= 1 && port <= 65535))
            return null;
        return u.protocol + '//' + host + ':' + port;
    }
    catch (_) {
        return null;
    }
}
