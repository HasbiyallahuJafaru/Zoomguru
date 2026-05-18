module.exports = {
  appId: 'com.zoomguru.app',
  publish: [
    {
      provider: 'github',
      owner: 'hasbiyallahujafaru',
      repo: 'zoomguru',
      private: false,
    }
  ],
  asar: true,
  asarUnpack: ["**/node_modules/**/*.node"],
  productName: 'ZoomGuru',
  directories: { output: 'release' },
  files: ['dist/**/*', 'dist-electron/**/*'],
  mac: {
    target: [{ target: 'dmg', arch: ['x64', 'arm64'] }],
    category: 'public.app-category.productivity',
    icon: 'assets/icon.icns',
  },
  win: {
    target: [{ target: 'nsis', arch: ['x64'] }],
    icon: 'assets/icon.ico',
  },
  nsis: {
    oneClick: false,
    allowToChangeInstallationDirectory: true,
    createDesktopShortcut: true,
    createStartMenuShortcut: true,
  },
};
