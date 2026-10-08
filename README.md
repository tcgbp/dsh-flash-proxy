# dsh-flash-proxy

> **[简体中文说明文档](README.zh-CN.md)**

System proxy control for DeepSeek Harness — NO_PROXY policy management,
connection diagnostics, and proxy environment inventory.

## Features

- **System Proxy Toggle** — Global on/off master switch (like System Alerts); turns the entire proxy feature on or off
- **Proxy Mode Selector** — Choose between All Proxy, API Bypass, All Bypass, or Custom NO_PROXY (nested under the master switch)
- **Connection Test** — Diagnose outbound connectivity with redirect chain analysis
- **Proxy Environment** — Read-only inventory of HTTP_PROXY / HTTPS_PROXY / ALL_PROXY / NO_PROXY
- **Diagnostics Log** — Detailed test results with timing and error codes

## Installation

```bash
dsh plugin --profile <name> add dsh-flash-proxy
```

Requires the core [`dsh-flash`](https://www.npmjs.com/package/dsh-flash) `>=1.0.0-0 <2.0.0-0` for the QuickControl registry; the dock-base workbench UI comes from the [`dock-flash` v3 adapter](https://github.com/tcgbp/dock-flash).

## Repository Mirrors

Development happens on Gitee; GitHub is a read-only mirror kept in sync by
[`.github/workflows/sync-from-gitee.yml`](.github/workflows/sync-from-gitee.yml)
(every 6 hours, or on demand from the Actions tab).

| Host | Role | URL |
|---|---|---|
| Gitee | source of truth | https://gitee.com/lenin.guo/dsh-flash-proxy |
| GitHub | mirror | https://github.com/tcgbp/dsh-flash-proxy |

Open issues and pull requests on Gitee — a merge made on GitHub is overwritten by
the next sync.

## Settings

| Field | Default | Description |
|---|---|---|
| `proxyEnabled` | `true` | Global master switch — when `false`, all requests go direct regardless of `proxyMode` |
| `proxyMode` | `all-proxy` | NO_PROXY policy: `all-proxy` / `api-bypass` / `all-bypass` / `custom` |
| `customNoProxy` | `''` | Custom NO_PROXY value (only when `proxyMode` is `custom`) |
| `testUrl` | `https://www.google.com/generate_204` | URL the connection test probes |

## Migration from dock-flash

If you previously used dock-flash's built-in proxy controls, `dsh-flash-proxy` will
automatically migrate your settings on first launch.
