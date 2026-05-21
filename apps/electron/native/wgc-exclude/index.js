// Graceful fallback if native addon not built
try {
  module.exports = require('./build/Release/wgc_exclude.node');
} catch (e) {
  module.exports = {
    excludeFromCapture: () => ({ success: false, error: 'native addon not built', method: null }),
    getWindowsVersion: () => ({ major: 0, minor: 0, build: 0 }),
  };
}
