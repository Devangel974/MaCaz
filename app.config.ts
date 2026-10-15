/// <reference types="node" />
import { existsSync } from 'node:fs';

import type { ConfigContext, ExpoConfig } from 'expo/config';

// À personnaliser : identifiant unique de l'appli Android (doit correspondre à celui déclaré dans Firebase).
const ANDROID_PACKAGE = 'com.famille.macaz';

// Identifiant du projet EAS : affiché par `npx eas-cli@latest init` — colle-le ici.
const EAS_PROJECT_ID = '';

// Fichier Firebase nécessaire au push Android (FCM). En build EAS, on le passe en variable
// d'environnement de type "fichier" (GOOGLE_SERVICES_JSON) pour ne pas le committer.
const googleServicesFile =
  process.env.GOOGLE_SERVICES_JSON ?? (existsSync('./google-services.json') ? './google-services.json' : undefined);

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'MaCaz',
  slug: 'macaz',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/images/icon.png',
  scheme: 'macaz',
  userInterfaceStyle: 'light',
  backgroundColor: '#F3F4F1',
  ios: {
    bundleIdentifier: ANDROID_PACKAGE,
  },
  android: {
    package: ANDROID_PACKAGE,
    googleServicesFile,
    adaptiveIcon: {
      backgroundColor: '#1F6B57',
      foregroundImage: './assets/images/android-icon-foreground.png',
      backgroundImage: './assets/images/android-icon-background.png',
      monochromeImage: './assets/images/android-icon-monochrome.png',
    },
    softwareKeyboardLayoutMode: 'resize',
    predictiveBackGestureEnabled: false,
  },
  plugins: [
    'expo-router',
    [
      'expo-splash-screen',
      {
        backgroundColor: '#F3F4F1',
        image: './assets/images/splash-icon.png',
        imageWidth: 76,
      },
    ],
    [
      'expo-notifications',
      {
        color: '#1F6B57',
        defaultChannel: 'messages',
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
  extra: {
    ...config.extra,
    eas: {
      projectId: EAS_PROJECT_ID || undefined,
    },
  },
});
