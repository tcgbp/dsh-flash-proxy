# dsh-flash-proxy

> **[English](README.md)** · **简体中文**

面向 DeepSeek Harness（DSH）的系统代理控制插件——负责 NO_PROXY 策略管理、出站连接诊断，以及代理环境变量的只读盘点。

插件分为 Host 端（Node 侧）与 Client 端（dock-flash QuickControl 面板）两部分：Host 端注册设置命名空间并通过 `@deepseek-ai/dsh-http-proxy` 重装 undici 全局调度器，使进程内的出站请求遵循用户选择的 NO_PROXY 策略；Client 端在 dock-flash 的 QuickControl 面板上提供 6 个开关，用于切换代理模式、指定测试地址、执行连接测试并查看诊断日志与代理环境。

## 特性

- **代理模式选择器（系统代理）** —— 在「全部代理 / 仅 API 绕过 / 全部绕过 / 自定义」四种模式间切换
- **连接测试** —— 诊断出站连通性，手动跟踪重定向链并逐跳分析
- **代理环境** —— HTTP_PROXY / HTTPS_PROXY / ALL_PROXY / NO_PROXY 的只读盘点，逐类如实展示
- **诊断日志** —— 详细的测试结果，含分阶段耗时（响应头 / 响应体）、重定向链与底层套接字错误码

### 代理模式（NO_PROXY 策略）

| 模式 | 效果 |
|---|---|
| `all-proxy`（全部代理） | 清空 NO_PROXY → 所有流量经代理发出 |
| `api-bypass`（仅 API 绕过） | NO_PROXY = `api.deepseek.com,chat.deepseek.com` → API/聊天域名直连，其余走代理 |
| `all-bypass`（全部绕过） | NO_PROXY = `*` → 所有请求直连，不经代理 |
| `custom`（自定义） | NO_PROXY = 自定义列表，按用户填写的值绕过 |

> **注意**：这些设置只影响 **DSH 进程内**的 `fetch()` 请求（经 undici 全局调度器路由），不会改变系统或其它进程的代理行为。若未检测到任何 HTTP_PROXY，代理设置暂无实际效果。

### 自定义 NO_PROXY 语法

接受主机名、域名后缀、IP 或 `主机:端口`，用逗号或空格分隔。域名条目同时匹配其子域（`example.com` 也匹配 `api.example.com`）；端口需在 1–65535 之间。**不支持** CIDR（`10.0.0.0/8` 请改写成 `10.0.0.0`），也不要在此填代理地址本身（`http://…`）。

## 安装

```bash
dsh plugin --profile <name> add dsh-flash-proxy
```

QuickControl 面板 UI 依赖 [dock-flash](https://github.com/tcgbp/dock-flash)，请确保其已安装启用。

## 仓库镜像

开发在 Gitee 上进行；GitHub 是只读镜像，由 [`.github/workflows/sync-from-gitee.yml`](.github/workflows/sync-from-gitee.yml)（每 6 小时，或从 Actions 选项卡手动触发）保持同步。

| 平台 | 角色 | 地址 |
|---|---|---|
| Gitee | 源仓库（source of truth） | https://gitee.com/lenin.guo/dsh-flash-proxy |
| GitHub | 镜像 | https://github.com/tcgbp/dsh-flash-proxy |

请在 Gitee 上提交 Issue 与 Pull Request——在 GitHub 上的合并会被下一次同步覆盖。

## 设置项

| 字段 | 默认值 | 说明 |
|---|---|---|
| `proxyMode` | `all-proxy` | NO_PROXY 策略：`all-proxy` / `api-bypass` / `all-bypass` / `custom` |
| `customNoProxy` | `''` | 自定义 NO_PROXY 值（仅当 `proxyMode` 为 `custom` 时生效） |
| `testUrl` | `https://www.google.com/generate_204` | 连接测试所探测的 URL |

所有设置均为 volatile（运行时热更新，无需重启插件）。`testUrl` 刻意设计为可配置项而非写死常量：维护者的真实目标地址是内部主机，写死会把内部基础设施信息泄露到本公开仓库；用户可将其指向任何能真正证明代理生效的地址。

> 遗留字段 `useProxy`（布尔）：首次加载时自动迁移为 `proxyMode`，保留它以确保旧客户端不因配置缺字段而报错。

## 从 dock-flash 迁移

如果你之前使用过 dock-flash 内置的代理控制，`dsh-flash-proxy` 会在首次启动时自动读取 `dock-flash` 命名空间中的设置并迁移到自身命名空间（`proxyMode`、`customNoProxy`、`testUrl`）。

## HTTP 接口

Host 端向 Client 端暴露两个 HTTP 路由（经 webServer 注册，回环访问）：

- `GET /plugins/dsh-flash-proxy/proxy-status` —— 返回当前 `proxyMode`、`customNoProxy`、`testUrl` 及实际生效的 NO_PROXY 环境变量值；并以当前配置的测试目标为探针回报 `proxyAvailable`（代理是否可用）与逐类代理变量（HTTP / HTTPS / ALL）。
- `POST /plugins/dsh-flash-proxy/test-connection` —— 执行连接测试并返回诊断结果：手写重定向链遍历（区分「302 去往不可达地址」与「连接被拒」）、分别测量响应头与响应体耗时、返回代理路由决策（`proxied`）与底层错误码（`cause.code`，如 `ENOTFOUND`、`UND_ERR_CONNECT_TIMEOUT`、`DEPTH_ZERO_SELF_SIGNED_CERT`）。请求体可带可选 `{ url }` 覆盖测试目标，缺省时回落到存储的 `testUrl` 设置。

## 构建

```bash
pnpm install
pnpm build      # 或 pnpm typecheck
```

`src/` 为 TS 源码，编译产物输出到 `dist/`；`lib/` 下的 client 端按 bundle 约定直接分发。

## 许可

Apache-2.0（见 `package.json` 中的 `license` 字段）
