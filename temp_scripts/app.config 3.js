export default {
  expo: {
    name: "Ultimate Team",
    slug: "ultimateteam",
    owner: "p.florin",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/icon.png",
    userInterfaceStyle: "light",
    assetBundlePatterns: [
      "**/*"
    ],
    splash: {
      image: "./assets/splash.png",
      resizeMode: "contain",
      backgroundColor: "#ffffff"
    },
    updates: {
      fallbackToCacheTimeout: 0,
      url: "https://u.expo.dev/f43e8b35-5e2a-4e5d-92bb-9cdc051ca72a"
    },
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.ultimateteam.app",
      backgroundColor: "#ffffff"
    },
    android: {
      adaptiveIcon: {
        foregroundImage: "./assets/adaptive-icon.png",
        backgroundColor: "#ffffff"
      },
      package: "com.ultimateteam.app"
    },
    web: {
      favicon: "./assets/favicon.png"
    },
    extra: {
      supabaseUrl: process.env.SUPABASE_URL || "https://ulltpjezntzgiawchmaj.supabase.co",
      supabaseAnonKey: process.env.SUPABASE_ANON_KEY || "REMOVED_FOR_SECURITY",
      eas: {
        projectId: "f43e8b35-5e2a-4e5d-92bb-9cdc051ca72a"
      }
    },
    plugins: [],
    experiments: {
      tsconfigPaths: true
    },
    runtimeVersion: "1.0.0",
    privacy: "unlisted",
    // Enable New Architecture
    newArchEnabled: true
  }
}; 