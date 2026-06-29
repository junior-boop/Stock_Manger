import type { ForgeConfig } from '@electron-forge/shared-types';
import { MakerSquirrel } from '@electron-forge/maker-squirrel';
import { MakerZIP } from '@electron-forge/maker-zip';
import { MakerDeb } from '@electron-forge/maker-deb';
import { MakerRpm } from '@electron-forge/maker-rpm';
import { MakerDMG } from '@electron-forge/maker-dmg';
import { PublisherGithub } from '@electron-forge/publisher-github';
import { VitePlugin } from '@electron-forge/plugin-vite';
import { AutoUnpackNativesPlugin } from '@electron-forge/plugin-auto-unpack-natives';
import { FusesPlugin } from '@electron-forge/plugin-fuses';
import { FuseV1Options, FuseVersion } from '@electron/fuses';

const config: ForgeConfig = {

  packagerConfig: {
    asar: true,
    name: 'Kataleya - Plateforme',
    executableName: 'kataleya-plateforme',
    icon: 'src/assets/app-icon',
    ignore: [
      /node_modules\/(?!(better-sqlite3|bindings|file-uri-to-path)\/)/,
    ]
  },
  rebuildConfig: {
    force: false,
  },
  makers: [
    new MakerSquirrel({
      name: 'kataleya-plateforme',
      setupIcon: 'src/assets/app-icon.ico',
    }),
    new MakerZIP({}, ['darwin', 'win32']),
    new MakerRpm({ options: { icon: 'src/assets/app-icon.png' } }),
    new MakerDeb({ options: { icon: 'src/assets/app-icon.png' } }),
    new MakerDMG({ icon: 'src/assets/app-icon.icns' }),
  ],
  publishers: [
    new PublisherGithub({
      repository: {
        owner: 'junior-boop',
        name: 'Stock_Manger',
      },
      prerelease: false,
      draft: false,
    }),
  ],
  plugins: [
    new AutoUnpackNativesPlugin({}),
    new VitePlugin({
      // `build` can specify multiple entry builds, which can be Main process, Preload scripts, Worker process, etc.
      // If you are familiar with Vite configuration, it will look really familiar.
      build: [
        {
          // `entry` is just an alias for `build.lib.entry` in the corresponding file of `config`.
          entry: 'src/main.ts',
          config: 'vite.main.config.mjs',
          target: 'main',
        },
        {
          entry: 'src/preload.ts',
          config: 'vite.preload.config.mjs',
          target: 'preload',
        },
      ],
      renderer: [
        {
          name: 'main_window',
          config: 'vite.renderer.config.mjs',
        },
      ],
    }),
    // Fuses are used to enable/disable various Electron functionality
    // at package time, before code signing the application
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true,
    }),
  ],
};

export default config;
