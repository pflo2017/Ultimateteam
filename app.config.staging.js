require('dotenv').config();

export default {
  expo: {
    name: "Ultimate Team (Staging)",
    slug: "ultimateteam-staging",
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
      bundleIdentifier: "com.ultimateteam.app.staging",
      backgroundColor: "#ffffff"
    },
    android: {
      adaptiveIcon: {
        foregroundImage: "./assets/adaptive-icon.png",
        backgroundColor: "#ffffff"
      },
      package: "com.ultimateteam.app.staging"
    },
    web: {
      favicon: "./assets/favicon.png"
    },
    extra: {
      // These will be replaced with staging credentials
      supabaseUrl: process.env.STAGING_SUPABASE_URL || "YOUR_STAGING_SUPABASE_URL",
      supabasePublishableKey: process.env.STAGING_SUPABASE_PUBLISHABLE_KEY || "YOUR_STAGING_SUPABASE_PUBLISHABLE_KEY",
      supabaseSecretKey: process.env.STAGING_SUPABASE_SECRET_KEY || "YOUR_STAGING_SUPABASE_SECRET_KEY",
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