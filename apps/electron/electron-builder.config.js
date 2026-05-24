module.exports = {
  appId: 'com.zoomguru.app',
  productName: 'ZoomGuru',
  electronVersion: '42.1.0',
  asar: true,
  asarUnpack: ['**/node_modules/**/*.node'],
  directories: { output: 'release' },
  files: [
    'dist/**/*',
    '!dist/**/*.map',
    'dist-electron/**/*',
    '!dist-electron/**/*.map',
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
    target: [
      { target: 'portable', arch: ['x64'] },
      { target: 'zip', arch: ['x64'] },
    ],
    icon: 'assets/icon.png',
    forceCodeSigning: false,
  },
  nsis: {
    oneClick: false,
    allowToChangeInstallationDirectory: true,
    createDesktopShortcut: true,
    createStartMenuShortcut: true,
  },
};
