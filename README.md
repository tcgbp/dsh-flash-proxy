# dsh-flash-proxy

> **[简体中文说明文档](README.zh-CN.md)**

System proxy control for DeepSeek Harness — NO_PROXY policy management,
connection diagnostics, and proxy environment inventory.

## Features

- **System Proxy Toggle** — Global on/off master switch (like System Alerts); turns the entire proxy feature on or off
- **Proxy Mode Selector** — Choose between All Proxy, API Bypass, All Bypass, or Custom NO_PROXY (nested under the master switch)
- **Use System Proxy** — On Windows and macOS, read the system proxy (Windows WinINet `Internet Settings` registry, or macOS active network service via `scutil`) and optionally use it for this process instead of the launch-environment proxy
- **Connection Test** — Diagnose outbound connectivity with redirect chain analysis
- **Proxy Environment** — Read-only inventory of HTTP_PROXY / HTTPS_PROXY / ALL_PROXY / NO_PROXY, plus the system-proxy snapshot
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
| `useSystemProxy` | `false` | Windows/macOS: use the OS system proxy instead of the launch environment (ignored on other platforms) |

## System Proxy (Windows WinINet registry / macOS scutil)

On Windows, `dsh-flash-proxy` reads the system proxy stored in the
`HKCU\Software\Microsoft\Windows\CurrentVersion\Internet Settings` registry keys.
On macOS it reads the current network service's proxy settings via
`scutil --proxy` (JSON form when available, with a legacy text fallback). The
QuickControl panel shows a read-only snapshot (`proxyEnable`, `proxyServer`,
`proxyOverride`, `autoConfigUrl`, `autoDetect`) and derives the equivalent proxy
environment from it for display.

- A plain `host:port` proxy is mapped to both `HTTP_PROXY` and `HTTPS_PROXY`
  (surfaced as `ALL_PROXY`).
- A segmented value (`http=…;https=…;ftp=…`; the macOS reader produces
  `http=…;https=…` from the per-protocol HTTP(S) proxy) is parsed per protocol.
- The bypass list (`ProxyOverride` on Windows, `ExceptionsList` on macOS) is
  translated into `NO_PROXY`; the `<local>` token is dropped (the plugin grammar
  does not accept it).

When the **Use System Proxy** toggle is ON, the host is Windows or macOS, and the
master switch is enabled, the effective `HTTP_PROXY` / `HTTPS_PROXY` /
`ALL_PROXY` and `NO_PROXY` are taken from the system-proxy snapshot instead of
the launch environment. All other platforms ignore this toggle and keep the
default (localStorage) behaviour unchanged.

## Migration from dock-flash

If you previously used dock-flash's built-in proxy controls, `dsh-flash-proxy` will
automatically migrate your settings on first launch.
