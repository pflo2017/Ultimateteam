export default {
  expo: {
    name: "Ultimate Team",
    slug: "ultimate-team",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/icon.png",
    userInterfaceStyle: "light",
    splash: {
      image: "./assets/splash.png",
      resizeMode: "contain",
      backgroundColor: "#ffffff"
    },
    assetBundlePatterns: [
      "**/*"
    ],
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.ultimateteam.app",
      backgroundColor: "#ffffff",
      statusBar: {
        style: "dark-content",
        backgroundColor: "#ffffff"
      }
    },
    android: {
      adaptiveIcon: {
        foregroundImage: "./assets/adaptive-icon.png",
        backgroundColor: "#ffffff"
      },
      package: "com.ultimateteam.app",
      statusBar: {
        backgroundColor: "#ffffff",
        barStyle: "dark-content"
      }
    },
    web: {
      favicon: "./assets/favicon.png"
    },
    extra: {
      supabaseUrl: "https://ulltpjezntzgiawchmaj.supabase.co",
      supabaseAnonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVsbHRwamV6bnR6Z2lhd2NobWFqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDUzMzczNDIsImV4cCI6MjA2MDkxMzM0Mn0.HZLgLWTSNEdTbE9HEaAQ92HkHe7k_gx4Pj2meQyZxfE",
    },
    plugins: [
      "expo-router"
    ],
    experiments: {
      tsconfigPaths: true
    },
    // Enable New Architecture
    newArchEnabled: true
  }
}; 