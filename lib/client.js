// dsh-flash-proxy — CLIENT half of the system proxy control plugin.
//
// Registers 5 QuickControl switches via the dock-flash registry:
//   system-proxy, test-url, test-connection, proxy-log, proxy-env
//
// Dual-discovery pattern: listens for ‘dock-flash:ready’ event AND
// checks ‘ctx.get('quickControl')’ for immediate availability.

window.__ModuleLoader__ = window.__ModuleLoader__ || {}
window.__ModuleLoader__.load({
  id: 'dsh-flash-proxy',
  factory: function (require) {
    var module = { exports: {} }
    var exports = module.exports

    var React = require('react')
    var h = React.createElement

    exports.name = 'dsh-flash-proxy'
    exports.inject = ['remote', 'remote.settings']
    exports.apply = function (ctx) {
        console.log('[dsh-flash-proxy] client apply() — loaded')

        // Track whether we already registered to avoid double-registration
        // when both ctx.inject(['quickControl']) and dock-flash:ready fire.
        var _registered = false

        // ── i18n tables ─────────────────────────────────────────
        var zh = {
          systemProxy: '系统代理',
          proxyEnabledOn: '已开启',
          proxyEnabledOff: '已关闭',
          proxyMode: '代理模式',
          noProxyHint: 'NO_PROXY',
          noProxyNotSet: '未设置',
          proxyAllProxy: '全部代理',
          proxyApiBypass: '仅 API 绕过',
          proxyAllBypass: '全部绕过',
          proxyCustom: '自定义',
          proxyModeDescAllProxy: '所有请求都经代理发出',
          proxyModeDescApiBypass: '仅 API/聊天域名直连，其余走代理',
          proxyModeDescAllBypass: '所有请求都直连，不经代理',
          proxyModeDescCustom: '按自定义 NO_PROXY 列表绕过',
          proxyCustomPrompt: '输入自定义 NO_PROXY 值',
          proxyCustomEmpty: '自定义 NO_PROXY 不能为空：要全部走代理请选「全部代理」，要全部绕过请选「全部绕过」或填 *。',
          proxyCustomInvalid: '自定义 NO_PROXY 中有无效条目：',
          proxyCustomSyntax: '只接受主机名、域名后缀、IP 或「主机:端口」，用逗号或空格分隔；域名条目同时匹配其子域（example.com 也匹配 api.example.com）；端口需在 1-65535。不支持 CIDR（10.0.0.0/8 请改写成 10.0.0.0），也不要填代理地址本身（http://…）。',
          proxyScopeHint: '仅影响 DSH 进程内的 fetch 请求',
          proxyNoProxyEnv: '未检测到 HTTP_PROXY，代理设置暂无效果',
          proxyEnvRefreshing: '刷新中…',
          testConnection: '测试连接',
          testRunning: '测试中…',
          testSuccess: '连接成功',
          testFailed: '连接失败',
          testUrl: '测试 URL',
          testUrlPrompt: '输入用于测试连接的 URL（http:// 或 https://）',
          testUrlInvalid: 'URL 无效：必须以 http:// 或 https:// 开头',
          proxyLog: '连接诊断日志',
          proxyEnv: '代理环境',
          proxyLogClear: '清空日志',
          logRoute: '链路',
          logProxied: '经代理',
          logDirect: '直连',
          logNoHttpProxy: '未设置 HTTP_PROXY',
          logRedirects: '重定向',
          logRedirectLimit: '已达重定向上限，未继续跟随',
          logFinalUrl: '最终 URL',
          logResponse: '响应',
          logHeaders: '响应头',
          logBody: '主体',
          logTotal: '总计',
          logCause: '原因',
          logFailed: '失败',
        }

        var en = {
          systemProxy: 'System Proxy',
          proxyEnabledOn: 'Enabled',
          proxyEnabledOff: 'Disabled',
          proxyMode: 'Proxy Mode',
          noProxyHint: 'NO_PROXY',
          noProxyNotSet: 'not set',
          proxyAllProxy: 'All Proxy',
          proxyApiBypass: 'API Bypass',
          proxyAllBypass: 'All Bypass',
          proxyCustom: 'Custom',
          proxyModeDescAllProxy: 'All requests route through the proxy',
          proxyModeDescApiBypass: 'Only API/chat domains bypass; everything else uses the proxy',
          proxyModeDescAllBypass: 'All requests go direct, bypassing the proxy',
          proxyModeDescCustom: 'Bypass per the custom NO_PROXY list',
          proxyCustomPrompt: 'Enter custom NO_PROXY value',
          proxyCustomEmpty: 'Custom NO_PROXY cannot be empty — choose "All Proxy" to bypass nothing, or "All Bypass" / * to bypass everything.',
          proxyCustomInvalid: 'Invalid entry in custom NO_PROXY:',
          proxyCustomSyntax: 'Accepted: host names, domain suffixes, IPs, or host:port, separated by commas or spaces. A domain also matches its subdomains (example.com also matches api.example.com); ports must be 1-65535. CIDR is not supported (rewrite 10.0.0.0/8 as 10.0.0.0), and the proxy address itself (http://…) does not belong here.',
          proxyScopeHint: 'Only affects fetch() requests within DSH process',
          proxyNoProxyEnv: 'No HTTP_PROXY detected — proxy setting has no effect',
          proxyEnvRefreshing: 'Refreshing…',
          testConnection: 'Test Connection',
          testRunning: 'Testing…',
          testSuccess: 'Connected',
          testFailed: 'Failed',
          testUrl: 'Test URL',
          testUrlPrompt: 'URL to test connectivity against (http:// or https://)',
          testUrlInvalid: 'Invalid URL: must start with http:// or https://',
          proxyLog: 'Diagnostics Log',
          proxyEnv: 'Proxy Environment',
          proxyLogClear: 'Clear log',
          logRoute: 'Route',
          logProxied: 'proxied',
          logDirect: 'direct',
          logNoHttpProxy: 'no HTTP_PROXY',
          logRedirects: 'Redirects',
          logRedirectLimit: 'redirect limit reached, stopped following',
          logFinalUrl: 'Final URL',
          logResponse: 'Response',
          logHeaders: 'headers',
          logBody: 'Body',
          logTotal: 'Total',
          logCause: 'Cause',
          logFailed: 'Failed',
        }

        // ── i18n: reactive locale system ────────────────────────────────
        var LOCALES = { zh: zh, en: en }
        var localeListeners = new Set()

        function detectLocaleTag() {
          try {
            var tag = document.documentElement.lang
            if (tag) return tag
          } catch (_) {}
          try { return navigator.language || 'en' } catch (_) { return 'en' }
        }

        function resolveLocaleKey(tag) {
          var lower = (tag || '').toLowerCase()
          if (lower.startsWith('zh')) return 'zh'
          return 'en'
        }

        var _currentLocaleKey = resolveLocaleKey(detectLocaleTag())

        if (typeof document !== 'undefined' && typeof MutationObserver !== 'undefined') {
          var _observer = new MutationObserver(function (mutations) {
            for (var i = 0; i < mutations.length; i++) {
              var m = mutations[i]
              if (m.attributeName === 'lang') {
                var newKey = resolveLocaleKey(detectLocaleTag())
                if (newKey !== _currentLocaleKey) {
                  _currentLocaleKey = newKey
                  localeListeners.forEach(function (fn) { try { fn() } catch (_) {} })
                }
                return
              }
            }
          })
          _observer.observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] })
        }

        function t(k) {
          var dict = LOCALES[_currentLocaleKey] || LOCALES.en
          return dict[k] || LOCALES.en[k] || k
        }

        // ── localStorage keys ────────────────────────────────────
        var _proxyEnabledKey = 'dsh-flash-proxy:enabled'
        var _proxyModeKey = 'dsh-flash-proxy:proxy-mode'
        var _customNoProxyKey = 'dsh-flash-proxy:custom-no-proxy'
        var _testUrlKey = 'dsh-flash-proxy:test-url'

        var _PROXY_MODES = ['all-proxy', 'api-bypass', 'all-bypass', 'custom']
        var _DEFAULT_MODE = 'all-proxy'

        // Global master switch state — ON by default (mirrors dock-flash's
        // System Alerts toggle). When OFF the whole proxy feature is disabled
        // and every outbound request goes direct; the mode selector and other
        // controls are hidden until it is turned back on.
        var _getProxyEnabled = function () {
          try {
            var v = localStorage.getItem(_proxyEnabledKey)
            if (v === '0') return false
            return true
          } catch (_) { return true }
        }
        var _setProxyEnabled = function (v) {
          try { localStorage.setItem(_proxyEnabledKey, v ? '1' : '0') } catch (_) {}
        }

        var _getProxyMode = function () {
          try {
            var v = localStorage.getItem(_proxyModeKey)
            if (v && _PROXY_MODES.indexOf(v) >= 0) return v
            return _DEFAULT_MODE
          } catch (_) { return _DEFAULT_MODE }
        }
        var _setProxyMode = function (v) {
          try { localStorage.setItem(_proxyModeKey, String(v)) } catch (_) {}
        }
        var _getCustomNoProxy = function () {
          try { return localStorage.getItem(_customNoProxyKey) || '' } catch (_) { return '' }
        }
        var _setCustomNoProxy = function (v) {
          try { localStorage.setItem(_customNoProxyKey, String(v)) } catch (_) {}
        }

        // ── Custom NO_PROXY validation ──────────────────────────
        var _NO_PROXY_HOST_RE = /^[a-z0-9]([a-z0-9_-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9_-]*[a-z0-9])?)*\.?$/i
        var _NO_PROXY_IPV4_RE = /^\d{1,3}(\.\d{1,3}){3}$/
        var _NO_PROXY_IPV6_RE = /^[0-9a-f:]+$/i

        function _normalizeNoProxyList(raw) {
          var entries = String(raw == null ? '' : raw).split(/[,\s]+/).filter(function (e) { return e !== '' })
          if (entries.length === 0) return { ok: false, entry: '', reason: 'empty' }
          var out = []
          for (var i = 0; i < entries.length; i++) {
            var entry = entries[i]
            if (entry === '*') { out.push('*'); continue }
            if (/[/?#@\\]/.test(entry)) return { ok: false, entry: entry, reason: 'chars' }
            var body = entry.replace(/^\*\./, '').replace(/^\./, '')
            var host = body
            var port = null
            if (body.charAt(0) === '[') {
              var bracketed = /^\[([^\]]+)\](?::(\d+))?$/.exec(body)
              if (!bracketed) return { ok: false, entry: entry, reason: 'host' }
              host = bracketed[1]
              port = bracketed[2] === undefined ? null : bracketed[2]
            } else {
              var first = body.indexOf(':')
              if (first !== -1 && first === body.lastIndexOf(':')) {
                host = body.slice(0, first)
                port = body.slice(first + 1)
              }
            }
            if (port !== null) {
              var portNum = /^\d+$/.test(port) ? Number(port) : NaN
              if (!(portNum >= 1 && portNum <= 65535)) return { ok: false, entry: entry, reason: 'port' }
            }
            if (host === '') return { ok: false, entry: entry, reason: 'host' }
            if (host.indexOf(':') !== -1) {
              if (!_NO_PROXY_IPV6_RE.test(host)) return { ok: false, entry: entry, reason: 'host' }
            } else if (_NO_PROXY_IPV4_RE.test(host)) {
              var octets = host.split('.')
              for (var o = 0; o < octets.length; o++) {
                if (Number(octets[o]) > 255) return { ok: false, entry: entry, reason: 'host' }
              }
            } else if (!_NO_PROXY_HOST_RE.test(host)) {
              return { ok: false, entry: entry, reason: 'host' }
            }
            out.push(entry)
          }
          return { ok: true, value: out.join(',') }
        }

        function _noProxyErrorText(result) {
          if (result.reason === 'empty') return t('proxyCustomEmpty')
          return t('proxyCustomInvalid') + ' "' + result.entry + '"\n' + t('proxyCustomSyntax')
        }

        // ── Test target presets ────────────────────────────────
        var TEST_URL_PRESETS = [
          { value: 'google',   url: 'https://www.google.com/generate_204', label: 'Google 204' },
          { value: 'github',   url: 'https://github.com',                  label: 'GitHub' },
          { value: 'deepseek', url: 'https://api.deepseek.com',            label: 'DeepSeek API' },
        ]
        var _getTestUrl = function () {
          try { return localStorage.getItem(_testUrlKey) || '' } catch (_) { return '' }
        }
        var _setTestUrl = function (v) {
          try {
            if (v) localStorage.setItem(_testUrlKey, String(v))
            else localStorage.removeItem(_testUrlKey)
          } catch (_) {}
        }
        var _resolveTestUrl = function () { return _getTestUrl() || TEST_URL_PRESETS[0].url }
        var _testUrlPresetValue = function (url) {
          for (var i = 0; i < TEST_URL_PRESETS.length; i++) {
            if (TEST_URL_PRESETS[i].url === url) return TEST_URL_PRESETS[i].value
          }
          return url ? 'custom' : TEST_URL_PRESETS[0].value
        }

        // ── Diagnostics log formatting ───────────────────────────
        var _proxyLog = []
        var _proxyLogMeta = ''
        function _setLog(lines) {
          _proxyLog = lines.slice()
        }
        function _logStamp() {
          var d = new Date()
          var p = function (n) { return (n < 10 ? '0' : '') + n }
          return p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds())
        }
        function _fmtBytes(n) {
          if (typeof n !== 'number') return '?'
          if (n < 1024) return n + ' B'
          if (n < 1048576) return (n / 1024).toFixed(1) + ' KB'
          return (n / 1048576).toFixed(2) + ' MB'
        }
        function _oneLine(v, max) {
          var s = (v === null || v === undefined) ? '' : String(v)
          s = s.replace(/\s+/g, ' ').trim()
          return (max && s.length > max) ? s.slice(0, max) + '…' : s
        }
        function _describeTest(data) {
          var out = []
          var proxy = (data && data.proxy) || {}
          out.push('[' + _logStamp() + '] ▶ ' + _oneLine((data && data.url) || '?', 300))
          var bits = [proxy.proxied ? t('logProxied') : t('logDirect')]
          bits.push(proxy.httpProxy
            ? 'HTTP_PROXY=' + _oneLine(proxy.httpProxy, 120)
            : t('logNoHttpProxy'))
          bits.push(t('noProxyHint') + '=' + _oneLine(proxy.noProxy || '(' + t('noProxyNotSet') + ')', 200))
          if (proxy.mode) bits.push(t('systemProxy') + '=' + _oneLine(proxy.mode, 40))
          out.push('  ' + t('logRoute') + ': ' + bits.join(' · '))
          if (proxy.routeError) {
            out.push('  ' + t('logCause') + ': proxyRouteFor — ' + _oneLine(proxy.routeError, 300))
          }

          var hops = (data && data.redirects) || []
          if (hops.length) {
            out.push('  ' + t('logRedirects') + ': ' + hops.length)
            for (var i = 0; i < hops.length; i++) {
              out.push('    ↳ ' + hops[i].hop + ') ' + hops[i].status + ' → ' + _oneLine(hops[i].to, 300))
            }
            if (data.redirectLimitHit) out.push('    ↳ ' + t('logRedirectLimit'))
          }

          if (data && data.ok) {
            out.push('  ' + t('logResponse') + ': ' + data.status +
              (data.statusText ? ' ' + _oneLine(data.statusText, 60) : '') +
              ' · ' + t('logHeaders') + ' ' + data.headersMs + 'ms')
            if (data.contentType) out.push('    content-type: ' + _oneLine(data.contentType, 120))
            if (data.contentLength) out.push('    content-length: ' + _oneLine(data.contentLength, 40))
            out.push('  ' + t('logBody') + ': ' + _fmtBytes(data.bodyBytes) + ' · ' + data.bodyMs + 'ms')
            if (data.bodySnippet) {
              out.push('    ⤴ ' + _oneLine(data.bodySnippet, 200))
            }
            out.push('  ' + t('logTotal') + ': ' + data.elapsedMs + 'ms · ' + t('testSuccess'))
          } else {
            var err = (data && data.error) || {}
            out.push('  ' + t('logFailed') + ': ' + _oneLine(err.name || 'Error', 60) +
              ' — ' + _oneLine(err.message || 'unknown', 300))
            var cause = [err.causeCode, err.causeMessage].filter(Boolean).join(' — ')
            if (cause) out.push('  ' + t('logCause') + ': ' + _oneLine(cause, 300))
            else if (err.causeName) out.push('  ' + t('logCause') + ': ' + _oneLine(err.causeName, 120))
            if (err.code) out.push('  code: ' + _oneLine(err.code, 80))
            if (data && data.finalUrl && data.finalUrl !== data.url) {
              out.push('  ' + t('logFinalUrl') + ': ' + _oneLine(data.finalUrl, 300))
            }
            out.push('  ' + t('logTotal') + ': ' + ((data && data.elapsedMs) || 0) + 'ms · ' + t('testFailed'))
          }
          return out
        }

        // ── Proxy status tracking ──────────────────────────────
        var _noProxyValue = null
        var _hostProxyMode = null
        var _proxyAvailable = null
        var _httpProxyValue = null
        var _proxyEnvValue = null
        var _proxyEnvStale = false
        var _suppressHostSync = false
        var _hostProxyEnabled = null

        function _fetchProxyStatus() {
          try {
            fetch('/plugins/dsh-flash-proxy/proxy-status')
              .then(function (r) { return r.json() })
              .then(function (data) {
                if (data) {
                  var changed = false
                  // Sync the global master switch from the host. Compare
                  // against the host-reported value (not local, which could be
                  // stale after a host-side edit) and avoid an echo loop while a
                  // local toggle write is in flight.
                  if (typeof data.proxyEnabled === 'boolean' && data.proxyEnabled !== _hostProxyEnabled) {
                    _hostProxyEnabled = data.proxyEnabled
                    changed = true
                  }
                  if (typeof data.proxyEnabled === 'boolean' &&
                      data.proxyEnabled !== _getProxyEnabled() && !_suppressHostSync) {
                    _setProxyEnabled(data.proxyEnabled)
                    changed = true
                  }
                  if (typeof data.noProxy !== 'undefined' && data.noProxy !== _noProxyValue) {
                    _noProxyValue = data.noProxy
                    changed = true
                  }
                  if (data.proxyMode && data.proxyMode !== _hostProxyMode) {
                    _hostProxyMode = data.proxyMode
                    changed = true
                  }
                  if (data.proxyMode && data.proxyMode !== _getProxyMode() && !_suppressHostSync) {
                    _setProxyMode(data.proxyMode)
                    changed = true
                  }
                  if (typeof data.proxyAvailable === 'boolean' && data.proxyAvailable !== _proxyAvailable) {
                    _proxyAvailable = data.proxyAvailable
                    changed = true
                  }
                  if (data.httpProxy !== undefined && data.httpProxy !== _httpProxyValue) {
                    _httpProxyValue = data.httpProxy
                    changed = true
                  }
                  if (data.proxyEnv && (
                    data.proxyEnv.http !== (_proxyEnvValue && _proxyEnvValue.http) ||
                    data.proxyEnv.https !== (_proxyEnvValue && _proxyEnvValue.https) ||
                    data.proxyEnv.all !== (_proxyEnvValue && _proxyEnvValue.all)
                  )) {
                    _proxyEnvValue = data.proxyEnv
                    changed = true
                  }
                  if (data.proxyEnv) {
                    if (_proxyEnvStale) changed = true
                    _proxyEnvStale = false
                  }
                  if (data.customNoProxy !== undefined && data.customNoProxy !== _getCustomNoProxy()) {
                    _setCustomNoProxy(data.customNoProxy)
                    changed = true
                  }
                  var testUrlChanged = false
                  if (typeof data.testUrl === 'string' && data.testUrl &&
                      data.testUrl !== _getTestUrl() && !_suppressHostSync) {
                    _setTestUrl(data.testUrl)
                    changed = true
                    testUrlChanged = true
                  }
                  if (changed) {
                    registry.notifyChange('dsh-flash-proxy:system-proxy')
                    // Re-render every switch whose visible() is gated on the
                    // global master toggle, so they appear/disappear as soon as
                    // the host state flips rather than waiting for the next
                    // unrelated render.
                    ;['proxy-mode', 'test-url', 'test-connection', 'proxy-log', 'proxy-env']
                      .forEach(function (sid) {
                        try { registry.notifyChange('dsh-flash-proxy:' + sid) } catch (_) {}
                      })
                    if (testUrlChanged) registry.notifyChange('dsh-flash-proxy:test-url')
                  }
                }
              })
              .catch(function () {})
          } catch (_) {}
        }

        // ── Settings write queue ──────────────────────────────
        var _hostRevision = null
        var _prefWriteTail = Promise.resolve()
        var _pendingRevision = null

        function _fenceRevision() {
          if (_pendingRevision !== null) return _pendingRevision
          return _hostRevision === null ? undefined : _hostRevision
        }

        function _remoteSettings(ctx) {
          try {
            if (ctx && ctx.remote && ctx.remote.settings) return ctx.remote.settings
          } catch (_) {}
          try {
            var remote = ctx && ctx.get ? ctx.get('remote') : undefined
            return remote && remote.settings ? remote.settings : undefined
          } catch (_) { return undefined }
        }

        function _queuePrefWrite(ctx, patch, onError, saved) {
          var task = _prefWriteTail.then(function () {
            var settings = _remoteSettings(ctx)
            if (!settings || typeof settings.update !== 'function') {
              if (onError) onError(patch, function () {})
              return false
            }
            return settings.update('dsh-flash-proxy', patch, _fenceRevision())
              .then(function (res) {
                try {
                  if (res && res.ok === false) {
                    _pendingRevision = null
                    console.warn('[dsh-flash-proxy] host rejected the preference write:',
                      (res.error && (res.error.message || res.error.code)) || res.error)
                    if (onError) onError(patch, function () {})
                    try {
                      settings.describe().then(function (desc) {
                        if (desc && desc.ok !== false) {
                          var view2 = desc.value || desc
                          var list2 = view2 && Array.isArray(view2.namespaces)
                            ? view2.namespaces
                            : (Array.isArray(view2) ? view2 : null)
                          var ns2 = list2 && list2.find(function (n) {
                            return (n && (n.ns || n.namespace)) === 'dsh-flash-proxy'
                          })
                          if (ns2 && typeof ns2.revision === 'number') _hostRevision = ns2.revision
                        }
                      }).catch(function () {})
                    } catch (_) {}
                    return false
                  }
                  var v = res && res.value
                  if (v && typeof v.revision === 'number') {
                    _pendingRevision = v.revision
                    _hostRevision = v.revision
                  }
                } catch (_) {}
                return true
              }).catch(function (err) {
                _pendingRevision = null
                console.warn('[dsh-flash-proxy] failed to persist preference to host:', err)
                if (onError) onError(patch, function () {})
                return false
              })
          })
          _prefWriteTail = task.then(function () {}, function () {})
          return task
        }

        // ── Dual-discovery registration ──────────────────────────
        function registerProxySwitches(registry) {
          // Startup host sync
          try {
            var settingsSvc = _remoteSettings(ctx)
            if (settingsSvc && typeof settingsSvc.describe === 'function') {
              settingsSvc.describe().then(function (desc) {
                if (!desc || desc.ok === false) return
                var view = desc.value || desc
                var nsList = view && Array.isArray(view.namespaces)
                  ? view.namespaces
                  : (Array.isArray(view) ? view : [])
                if (!nsList.length) return
                var ns = nsList.find(function (n) {
                  return (n && (n.ns || n.namespace)) === 'dsh-flash-proxy'
                })
                var resolvedNs = ns && (ns.value || ns.resolved)
                if (resolvedNs) {
                  var res = resolvedNs
                  // Sync the global master switch from the host on startup.
                  if (typeof res.proxyEnabled === 'boolean' && res.proxyEnabled !== _getProxyEnabled()) {
                    _setProxyEnabled(res.proxyEnabled)
                    registry.notifyChange('dsh-flash-proxy:system-proxy')
                    console.log('[dsh-flash-proxy] proxyEnabled sync from host: ' + res.proxyEnabled)
                  }
                  if (res.proxyMode) {
                    var hostMode = res.proxyMode
                    var localMode = _getProxyMode()
                    if (hostMode !== localMode) {
                      _setProxyMode(hostMode)
                      registry.notifyChange('dsh-flash-proxy:system-proxy')
                      console.log('[dsh-flash-proxy] proxy-mode sync: host=' + hostMode + ', local was=' + localMode + ' → synced')
                    }
                    if (res.customNoProxy !== undefined && res.customNoProxy !== _getCustomNoProxy()) {
                      _setCustomNoProxy(res.customNoProxy)
                    }
                  }
                  if (typeof res.testUrl === 'string' && res.testUrl && res.testUrl !== _getTestUrl()) {
                    _setTestUrl(res.testUrl)
                    registry.notifyChange('dsh-flash-proxy:test-url')
                    console.log('[dsh-flash-proxy] test-url sync: ' + res.testUrl)
                  }
                }
              }).catch(function () {})
            }
          } catch (_) {}
          _fetchProxyStatus()

          // ── Switch 1: system-proxy — global master toggle ──────────
          //    Modelled on dock-flash's System Alerts switch: a single
          //    on/off that gates the whole feature. When OFF the host treats
          //    every request as direct (all-bypass) and the mode selector
          //    below — plus test / log / env controls — are hidden until it is
          //    turned back on.
          ctx.effect(function () {
            var dispose = registry.registerSwitch({
              id: 'dsh-flash-proxy:system-proxy',
              label: function () { return t('systemProxy') },
              tooltip: function () {
                if (!_getProxyEnabled()) return t('proxyEnabledOff')
                if (!_httpProxyValue) return t('proxyNoProxyEnv')
                return t('proxyScopeHint')
              },
              icon: 'link',
              type: 'toggle',
              cluster: 'system-proxy',
              group: 'system',
              order: 100,
              getValue: _getProxyEnabled,
              setValue: function (v) {
                _setProxyEnabled(v)
                console.log('[dsh-flash-proxy] system proxy ' + (v ? 'enabled' : 'disabled') + ' (global switch)')
                _proxyEnvStale = true
                registry.notifyChange('dsh-flash-proxy:proxy-env')
                _suppressHostSync = true
                try {
                  var proxySettings = _remoteSettings(ctx)
                  if (proxySettings && typeof proxySettings.update === 'function') {
                    _queuePrefWrite(ctx, { proxyEnabled: v }, null, {}).then(function () {
                      _suppressHostSync = false
                      _fetchProxyStatus()
                    }).catch(function (err) {
                      console.warn('[dsh-flash-proxy] failed to sync proxyEnabled to host:', err)
                      _suppressHostSync = false
                    })
                  } else {
                    console.warn('[dsh-flash-proxy] remote settings unavailable, proxyEnabled change may not persist to host')
                    _suppressHostSync = false
                  }
                } catch (_) { _suppressHostSync = false }
                // Re-render every switch gated on the master so they
                // appear/disappear immediately.
                ;['proxy-mode', 'test-url', 'test-connection', 'proxy-log', 'proxy-env']
                  .forEach(function (sid) {
                    try { registry.notifyChange('dsh-flash-proxy:' + sid) } catch (_) {}
                  })
              },
            })
            return dispose
          }, 'dsh-flash-proxy: system-proxy switch')

          // ── Switch 2: proxy-mode — NO_PROXY selector (moved inside) ──
          //    The proxy-mode dropdown, now nested under the global master
          //    toggle: only visible while the system-proxy switch is ON.
          ctx.effect(function () {
            var dispose = registry.registerSwitch({
              id: 'dsh-flash-proxy:proxy-mode',
              label: function () { return t('proxyMode') },
              subtitle: function () {
                var mode = _getProxyMode() || ''
                var desc = t('proxyModeDescAllProxy')
                if (mode === 'api-bypass') desc = t('proxyModeDescApiBypass')
                else if (mode === 'all-bypass') desc = t('proxyModeDescAllBypass')
                else if (mode === 'custom') desc = t('proxyModeDescCustom')
                return desc
              },
              subtitleBlock: true,
              icon: 'filter',
              type: 'select',
              cluster: 'system-proxy',
              group: 'system',
              order: 101,
              visible: function () { return _getProxyEnabled() },
              options: [
                { value: 'all-proxy',  label: function () { return t('proxyAllProxy') } },
                { value: 'api-bypass', label: function () { return t('proxyApiBypass') } },
                { value: 'all-bypass', label: function () { return t('proxyAllBypass') } },
                { value: 'custom',     label: function () { return t('proxyCustom') + (_getCustomNoProxy() ? ': ' + _getCustomNoProxy() : '') } },
              ],
              getValue: _getProxyMode,
              setValue: function (mode) {
                if (mode === 'custom') {
                  var current = _getCustomNoProxy()
                  var entered = prompt(t('proxyCustomPrompt'), current)
                  if (entered === null) {
                    registry.notifyChange('dsh-flash-proxy:proxy-mode')
                    return
                  }
                  var checked = _normalizeNoProxyList(entered)
                  if (!checked.ok) {
                    alert(_noProxyErrorText(checked))
                    registry.notifyChange('dsh-flash-proxy:proxy-mode')
                    return
                  }
                  var typed = String(entered).trim()
                  if (checked.value !== typed) {
                    console.log('[dsh-flash-proxy] custom NO_PROXY normalised: "' + typed + '" → "' + checked.value + '"')
                  }
                  _setCustomNoProxy(checked.value)
                }
                _setProxyMode(mode)
                console.log('[dsh-flash-proxy] proxy mode changed: ' + mode + (_getCustomNoProxy() ? ' (NO_PROXY=' + _getCustomNoProxy() + ')' : ''))
                _proxyEnvStale = true
                registry.notifyChange('dsh-flash-proxy:proxy-env')
                _suppressHostSync = true
                try {
                  var proxySettings = _remoteSettings(ctx)
                  if (proxySettings && typeof proxySettings.update === 'function') {
                    _queuePrefWrite(ctx, {
                      proxyMode: mode,
                      customNoProxy: _getCustomNoProxy(),
                    }, null, {}).then(function () {
                      _suppressHostSync = false
                      _fetchProxyStatus()
                    }).catch(function (err) {
                      console.warn('[dsh-flash-proxy] failed to sync proxy setting to host:', err)
                      _suppressHostSync = false
                      registry.recordChange({
                        id: 'dsh-flash-proxy:system-proxy',
                        label: t('systemProxy'),
                        icon: '⚠️',
                        oldDisplay: '',
                        newDisplay: mode + ' ⚠',
                      })
                    })
                  } else {
                    console.warn('[dsh-flash-proxy] remote settings unavailable, proxy change may not persist to host')
                    _suppressHostSync = false
                  }
                } catch (_) { _suppressHostSync = false }
              },
            })
            return dispose
          }, 'dsh-flash-proxy: proxy-mode switch')

          // ── settings/updated listener ─────────────────────
          ctx.effect(function () {
            var off = ctx.on('settings/updated', function (ns, next) {
              if (ns !== 'dsh-flash-proxy') return
              if (next) {
                var newEnabled = next.proxyEnabled
                var newMode = next.proxyMode
                var newCustom = next.customNoProxy
                if (typeof newEnabled === 'boolean' && newEnabled !== _getProxyEnabled()) {
                  _setProxyEnabled(newEnabled)
                  registry.notifyChange('dsh-flash-proxy:system-proxy')
                  console.log('[dsh-flash-proxy] proxyEnabled sync from settings/updated: ' + newEnabled)
                }
                if (newMode && newMode !== _getProxyMode()) {
                  _setProxyMode(newMode)
                  registry.notifyChange('dsh-flash-proxy:system-proxy')
                  console.log('[dsh-flash-proxy] proxy sync from settings/updated: mode=' + newMode)
                }
                if (newCustom !== undefined && newCustom !== _getCustomNoProxy()) {
                  _setCustomNoProxy(newCustom)
                }
                if (typeof next.testUrl === 'string' && next.testUrl && next.testUrl !== _getTestUrl()) {
                  _setTestUrl(next.testUrl)
                  registry.notifyChange('dsh-flash-proxy:test-url')
                  console.log('[dsh-flash-proxy] test-url sync from settings/updated: ' + next.testUrl)
                }
              }
              _fetchProxyStatus()
            })
            return off
          }, 'dsh-flash-proxy: proxy settings sync')

          // ── Switch 3: test-url ──────────────────────────
          ctx.effect(function () {
            var dispose = registry.registerSwitch({
              id: 'dsh-flash-proxy:test-url',
              label: function () { return t('testUrl') },
              type: 'select',
              cluster: 'system-proxy',
              group: 'system',
              order: 103,
              visible: function () { return _getProxyEnabled() },
              subtitleBlock: true,
              subtitle: function () { return _resolveTestUrl() },
              options: TEST_URL_PRESETS.map(function (p) {
                return { value: p.value, label: p.label }
              }).concat([{ value: 'custom', label: function () { return t('proxyCustom') } }]),
              getValue: function () { return _testUrlPresetValue(_getTestUrl()) },
              setValue: function (v) {
                var url = null
                if (v === 'custom') {
                  var entered = prompt(t('testUrlPrompt'), _resolveTestUrl())
                  if (entered === null) {
                    registry.notifyChange('dsh-flash-proxy:test-url')
                    return
                  }
                  url = String(entered).trim()
                  if (!/^https?:\/\//i.test(url)) {
                    alert(t('testUrlInvalid'))
                    registry.notifyChange('dsh-flash-proxy:test-url')
                    return
                  }
                } else {
                  for (var i = 0; i < TEST_URL_PRESETS.length; i++) {
                    if (TEST_URL_PRESETS[i].value === v) url = TEST_URL_PRESETS[i].url
                  }
                  if (!url) {
                    registry.notifyChange('dsh-flash-proxy:test-url')
                    return
                  }
                }
                _setTestUrl(url)
                console.log('[dsh-flash-proxy] test url changed: ' + url)
                _suppressHostSync = true
                try {
                  var urlSettings = _remoteSettings(ctx)
                  if (urlSettings && typeof urlSettings.update === 'function') {
                    _queuePrefWrite(ctx, { testUrl: url }, null, {})
                      .then(function () {
                        _suppressHostSync = false
                        _fetchProxyStatus()
                      })
                      .catch(function (err) {
                        console.warn('[dsh-flash-proxy] failed to sync test url to host:', err)
                        _suppressHostSync = false
                      })
                  } else {
                    _suppressHostSync = false
                  }
                } catch (_) { _suppressHostSync = false }
              },
            })
            return dispose
          }, 'dsh-flash-proxy: test-url switch')

          // ── Switch 4: test-connection ───────────────────
          ctx.effect(function () {
            var _testing = false
            var dispose = registry.registerSwitch({
              id: 'dsh-flash-proxy:test-connection',
              label: function () { return t('testConnection') },
              hideLabel: true,
              type: 'action',
              cluster: 'system-proxy',
              group: 'system',
              order: 104,
              visible: function () { return _getProxyEnabled() },
              actionLabel: function () { return _testing ? t('testRunning') : t('testConnection') },
              run: function () {
                if (_testing) return
                _testing = true
                var url = _resolveTestUrl()
                _setLog([
                  '[' + _logStamp() + '] ▶ ' + _oneLine(url, 300),
                  '  ' + t('testRunning'),
                ])
                _proxyLogMeta = '⏳ ' + t('testRunning')
                registry.notifyChange('dsh-flash-proxy:proxy-log')
                registry.notifyChange('dsh-flash-proxy:test-connection')
                fetch('/plugins/dsh-flash-proxy/test-connection', {
                  method: 'POST',
                  headers: { 'content-type': 'application/json' },
                  body: JSON.stringify({ url: url }),
                })
                  .then(function (r) { return r.json() })
                  .then(function (data) {
                    _testing = false
                    _setLog(_describeTest(data))
                    if (data && data.ok) {
                      _proxyLogMeta = '✅ ' + data.status + ' · ' + data.elapsedMs + 'ms'
                      registry.recordChange({
                        id: 'dsh-flash-proxy:test-connection',
                        label: t('testConnection'),
                        icon: '✅',
                        oldDisplay: '',
                        newDisplay: t('testSuccess') + ' (' + data.elapsedMs + 'ms)',
                      })
                    } else {
                      var err = (data && data.error) || {}
                      var errMsg = err.causeCode || err.causeMessage || err.message || 'unknown'
                      _proxyLogMeta = '❌ ' + ((data && data.elapsedMs) || 0) + 'ms'
                      registry.recordChange({
                        id: 'dsh-flash-proxy:test-connection',
                        label: t('testConnection'),
                        icon: '❌',
                        oldDisplay: '',
                        newDisplay: t('testFailed') + ': ' + errMsg,
                      })
                    }
                    registry.notifyChange('dsh-flash-proxy:proxy-log')
                    registry.notifyChange('dsh-flash-proxy:test-connection')
                  })
                  .catch(function (e) {
                    _testing = false
                    var msg = _oneLine(e && e.message ? e.message : String(e), 300)
                    _setLog([
                      '[' + _logStamp() + '] ▶ ' + _oneLine(url, 300),
                      '  ' + t('logFailed') + ': ' + msg,
                    ])
                    _proxyLogMeta = '❌ ' + msg.slice(0, 40)
                    registry.recordChange({
                      id: 'dsh-flash-proxy:test-connection',
                      label: t('testConnection'),
                      icon: '❌',
                      oldDisplay: '',
                      newDisplay: t('testFailed') + ': ' + msg,
                    })
                    registry.notifyChange('dsh-flash-proxy:proxy-log')
                    registry.notifyChange('dsh-flash-proxy:test-connection')
                  })
              },
            })
            return dispose
          }, 'dsh-flash-proxy: test-connection switch')

          // ── Switch 5: proxy-log ─────────────────────────
          ctx.effect(function () {
            var dispose = registry.registerSwitch({
              id: 'dsh-flash-proxy:proxy-log',
              label: function () { return t('proxyLog') },
              icon: 'log',
              type: 'log',
              cluster: 'system-proxy',
              group: 'system',
              order: 105,
              visible: function () { return _getProxyEnabled() },
              getLines: function () { return _proxyLog },
              getMeta: function () { return _proxyLogMeta },
              hideWhenEmpty: true,
              clearTitle: function () { return t('proxyLogClear') },
              onClear: function () {
                _proxyLog.length = 0
                _proxyLogMeta = ''
                registry.notifyChange('dsh-flash-proxy:proxy-log')
              },
            })
            return dispose
          }, 'dsh-flash-proxy: proxy-log switch')

          // ── Switch 6: proxy-env ───────────────────────
          ctx.effect(function () {
            var dispose = registry.registerSwitch({
              id: 'dsh-flash-proxy:proxy-env',
              label: function () { return t('proxyEnv') },
              icon: 'queue',
              type: 'log',
              cluster: 'system-proxy',
              group: 'system',
              order: 102,
              visible: function () { return _getProxyEnabled() },
              getLines: function () {
                var env = _proxyEnvValue || {}
                var unset = '(' + t('noProxyNotSet') + ')'
                var lines = []
                if (_proxyEnvStale) lines.push('⟳ ' + t('proxyEnvRefreshing'))
                lines.push('HTTP_PROXY' + '=' + (env.http || unset))
                lines.push('HTTPS_PROXY' + '=' + (env.https || unset))
                lines.push('ALL_PROXY' + '=' + (env.all || unset))
                lines.push('NO_PROXY' + '=' + ((_noProxyValue === null ? null : _noProxyValue) || unset))
                return lines
              },
              getMeta: function () { return _proxyEnvStale ? '⟳' : '' },
            })
            return dispose
          }, 'dsh-flash-proxy: proxy-env switch')
        } // end registerProxySwitches

        // ── Triple-discovery: three paths to the quickControl registry ──
        //
        // 1. ctx.inject(['quickControl']) — the reliable path. Cordis calls
        //    the callback once the service is available, even if it arrives
        //    later (e.g. dock-flash loads after us). This is the primary path.
        //
        // 2. dock-flash:ready event — dock-flash emits this when its
        //    QuickControl registry is ready. Good as a secondary signal.
        //
        // 3. ctx.get('quickControl') sync check — catches the case where the
        //    service is already available *right now* but inject hasn't fired
        //    yet (edge case on warm reload).
        //
        // The _registered flag prevents double-registration across paths.
        function safeRegister(registry) {
          if (_registered) return
          if (!registry || typeof registry.registerSwitch !== 'function') return
          _registered = true
          registerProxySwitches(registry)
        }

        // Path 1: inject-based (primary — guaranteed by Cordis lifecycle)
        ctx.inject(['quickControl'], function (qcCtx) {
          var registry = qcCtx.get('quickControl')
          if (registry) safeRegister(registry)
        })

        // Path 2: event-based (secondary — dock-flash specific)
        // dock-flash:ready payload is { quickControl: registry, alerts: alertRegistry }
        ctx.on('dock-flash:ready', function (payload) {
          var registry = payload && payload.quickControl ? payload.quickControl : payload
          safeRegister(registry)
        })

        // Path 3: sync check (tertiary — warm reload edge case)
        var registryNow = ctx.get('quickControl')
        if (registryNow) safeRegister(registryNow)
      }
      return module.exports
    },
  })
