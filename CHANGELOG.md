# Changelog — dsh-flash-proxy

Release-by-release history: what changed and, where it matters, why.
`git log` remains the authoritative record of individual commits — the entries
below summarise releases.

The **system proxy subsystem** (once part of the single `dock-flash` package)
that this companion owns: the global proxy toggle, the proxy-mode selector
(All/API-bypass/All-bypass/Custom NO_PROXY), the connection test with redirect
chain analysis, the read-only proxy-environment inventory, and the diagnostics
log. It registers its switches and its log through the core `dsh-flash`
`quickControl` registry.

## 0.2.2

**Release engineering only — no runtime behaviour change.** The publish workflow is
corrected: `pnpm run --if-present build` (the flag belongs to pnpm, not the run script)
instead of the mis-ordered `pnpm run build --if-present`, pnpm pinned to `11.5.3`, and
the npm upgrade step pinned to `npm@11` for trusted publishing — no `registry-url`, so
OIDC/provenance applies on publish.

## 0.2.1

**Internal refactor only — no user-visible behaviour change.** Consolidates the
proxy handling so the boot path and the live-edit path cannot drift, and removes
repetition across the quick-control registrations:

- `registry.ts` — one `degradedSnapshot()` factory replaces six inlined
  all-defaults snapshots (single source of truth for the fallback shape).
- `index.ts` — a shared `applyCurrentProxyState()` is used by both the startup
  apply and the `loader/volatile-update` handler.
- `client.js` — a data-driven `defSwitch()` collapses the repeated
  `ctx.effect`/`registerSwitch`/`return dispose` wrapper across all seven
  quick-control switches; the startup host-sync and `settings/updated` listener
  share one `applyHostState()` reconciler; the read-only proxy-env panel is
  rendered by a pure `_proxyEnvLines()` projection.

## 0.2.0

**The system-proxy toggle is now functional, and it works on both Windows and
macOS.** The switch used to be cosmetic — it flipped the UI but never actually
read or changed the operating system's proxy settings. This release wires it to
the real OS:

- **Windows** — reads and applies the per-user proxy via the Windows registry
  (`\HKCU\...\Internet Settings`), covering HTTP, HTTPS, and the NO_PROXY /
  bypass list (`ProxyOverride`).
- **macOS** (new platform) — reads and applies proxy settings through
  `scutil --proxy`, covering HTTP/HTTPS and the by-host exclusion list (SOCKS
  ignored).
- A plain `host:port` value applies to all protocols; segmented
  `http=…;https=…` values apply per-protocol. The client toggle carries the OS
  state and applies it through the host, and the control is only shown on
  Windows/macOS hosts.
- Non-Windows/macOS hosts are untouched (the toggle stays hidden and the
  subsystem remains environment-only).

## 0.1.6

**Client i18n now reuses the official `@deepseek-ai/dsh-client-locale` framework**
instead of the hand-rolled locale system. The client populates its dictionaries
through `locale.register('dsh-flash-proxy', { zh, en })` and reads text through
the bound translator (`locale.bind`), so active-locale resolution, host-backed
language preference, and `locale/change` re-rendering all come from the platform
instead of a local `MutationObserver` / `<html lang>`/`navigator.language` hack.
No strings changed, and the zh/en tables are unchanged. Internally the locale
package is now declared as both a runtime peer and a local dev dependency.

## 0.1.5

**First release after the core/adapter split peer move.** The `dsh-flash` peer
range is the one the combined package now demands (`>=1.0.0-0 <2.0.0-0`), so this
companion pairs with the standalone core the same way the other companions do.
Nothing else changed on screen.

## 0.1.4

**Market + repository identity.** A `dsh-market` entry and the `repository`
field pointing at this repository, so the market resolves this plugin's npm name
correctly and the card names it. (The installer that reached users has been
consistent since 0.1.2; this is the metadata that let the storefront show it.)

## 0.1.3

**Peer declaration fix.** The `dock-flash` peer this plugin always needed is now
declared, so a resolver that checks peers stops misreporting the install as
invalid. Behavior unchanged.

## 0.1.2

**First tagged release** — the extracted companion, standing up on its own as a
package instead of living inside the combined `dock-flash` plugin. Carries the
initial proxy feature set that the extraction moved out: global proxy toggle,
proxy-mode selector, connection test, proxy-environment inventory and the
diagnostics log. Also the first-pass fixes that made it safe to run standalone —
a client factory signature that matches what `__ModuleLoader__` actually passes
(`require` only, not `exports`), the `group: 'system'`-based tab routing for its
switches, and a non-fatal `apply()` so a failed first run cannot leave the plugin
registered but silent.