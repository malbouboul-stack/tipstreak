import { ConfigContext, ExpoConfig } from 'expo/config';

// La build "preview" (APK pour le jury) a son propre identifiant Android : elle s'installe
// à côté de la development build au lieu de la remplacer. APP_VARIANT est défini dans eas.json.
const IS_PREVIEW = process.env.APP_VARIANT === 'preview';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: IS_PREVIEW ? 'TipStreak (preview)' : config.name!,
  slug: config.slug!,
  android: {
    ...config.android,
    package: IS_PREVIEW ? 'com.ibmd.tipstreak.preview' : config.android?.package,
  },
});
