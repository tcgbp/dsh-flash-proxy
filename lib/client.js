// dsh-flash-proxy — CLIENT half of the system proxy control plugin.
//
// Registers 5 QuickControl switches via the dock-flash registry:
//   system-proxy, test-url, test-connection, proxy-log, proxy-env

;(function (global) {
  'use strict'

  var PLUGIN_ID = 'dsh-flash-proxy'

  // DSH's module loader calls this factory with require.
  global.__ModuleLoader__ = global.__ModuleLoader__ || {}
  global.__ModuleLoader__.load({
    id: PLUGIN_ID,
    factory: function (require, exports) {
      var React = require('react')
      var h = React.createElement

      exports.name = PLUGIN_ID
      exports.inject = ['remote', 'remote.settings']
      exports.apply = function (ctx) {
        console.log('[dsh-flash-proxy] client apply() — skeleton loaded')
        // TODO: Task 3 fills in the switch registrations
      }
    },
  })
})(typeof window !== 'undefined' ? window : this)
