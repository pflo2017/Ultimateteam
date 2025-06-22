require('dotenv').config();

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
      supabaseUrl: process.env.SUPABASE_URL,
      supabaseAnonKey: process.env.SUPABASE_ANON_KEY,
      eas: {
        projectId: "f43e8b35-5e2a-4e5d-92bb-9cdc051ca72a"
      }
    },
    updates: {
      url: "https://u.expo.dev/f43e8b35-5e2a-4e5d-92bb-9cdc051ca72a"
    },
    runtimeVersion: {
      policy: "appVersion"
    },
    plugins: [],
    experiments: {
      tsconfigPaths: true
    },
    privacy: "unlisted"
  }
};