// SmartFeed frontend runtime config
//
// Set `apiBase` to your deployed backend URL.
// Examples:
//   apiBase: 'https://smartfeed-api.onrender.com'
//   apiBase: 'https://smartfeed-api.up.railway.app/api'
//
// Notes:
// - You can provide the origin only; smartfeed-api.js will append `/api`.
// - Local development keeps using localhost automatically.
(function (global) {
  const hostname = global.location && global.location.hostname ? global.location.hostname : '';
  const isLocal =
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '';

  const existing = global.SMARTFEED_CONFIG || {};

  global.SMARTFEED_CONFIG = Object.assign(
    {
      apiBase: isLocal ? 'http://localhost:5000' : '__SMARTFEED_BACKEND_URL__',
    },
    existing
  );

  if (!global.SMARTFEED_API_BASE && global.SMARTFEED_CONFIG.apiBase) {
    global.SMARTFEED_API_BASE = global.SMARTFEED_CONFIG.apiBase;
  }
})(window);
