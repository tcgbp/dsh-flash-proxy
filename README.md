# dsh-flash-proxy

System proxy control for DeepSeek Harness — NO_PROXY policy management,
connection diagnostics, and proxy environment inventory.

## Features

- **Proxy Mode Selector** — Choose between All Proxy, API Bypass, All Bypass, or Custom NO_PROXY
- **Connection Test** — Diagnose outbound connectivity with redirect chain analysis
- **Proxy Environment** — Read-only inventory of HTTP_PROXY / HTTPS_PROXY / ALL_PROXY / NO_PROXY
- **Diagnostics Log** — Detailed test results with timing and error codes

## Installation

```bash
dsh plugin --profile <name> add dsh-flash-proxy
```

Requires [dock-flash](https://github.com/tcgbp/dock-flash) for the QuickControl panel UI.

## Repository Mirrors

Development happens on Gitee; GitHub is a read-only mirror kept in sync by
[`.github/workflows/sync-from-gitee.yml`](.github/workflows/sync-from-gitee.yml)
(every 6 hours, or on demand from the Actions tab).

| Host | Role | URL |
|---|---|---|
| Gitee | source of truth | https://gitee.com/lenin.guo/dsh-flash-proxy |
| GitHub | mirror | https://github.com/lenin-guo/dsh-flash-proxy |

Open issues and pull requests on Gitee — a merge made on GitHub is overwritten by
the next sync.

## Settings

| Field | Default | Description |
|---|---|---|
| `proxyMode` | `all-proxy` | NO_PROXY policy: `all-proxy` / `api-bypass` / `all-bypass` / `custom` |
| `customNoProxy` | `''` | Custom NO_PROXY value (only when `proxyMode` is `custom`) |
| `testUrl` | `https://www.google.com/generate_204` | URL the connection test probes |

## Migration from dock-flash

If you previously used dock-flash's built-in proxy controls, `dsh-flash-proxy` will
automatically migrate your settings on first launch.
