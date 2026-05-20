module.exports = {
  appId: 'com.zoomguru.app',
  productName: 'ZoomGuru',
  asar: true,
  asarUnpack: ['**/node_modules/**/*.node'],
  directories: { output: 'release' },
  files: [
    'dist/**/*',
    'dist-electron/**/*',
    'assets/**/*',
  ],
  publish: [
    {
      provider: 'github',
      owner: 'hasbiyallahujafaru',
      repo: 'zoomguru',
      private: false,
    },
  ],
  mac: {
    target: [{ target: 'dmg', arch: ['x64', 'arm64'] }],
    category: 'public.app-category.productivity',
    // Create assets/icon.icns before building on macOS
    icon: 'assets/tray-icon.png',
  },
  win: {
    target: [{ target: 'nsis', arch: ['x64'] }],
    // electron-builder accepts PNG ≥256×256 for Windows
    icon: 'assets/tray-icon.png',
  },
  nsis: {
    oneClick: false,
    allowToChangeInstallationDirectory: true,
    createDesktopShortcut: true,
    createStartMenuShortcut: true,
  },
};
