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