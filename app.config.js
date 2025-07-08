require('dotenv').config();

export default ({ config }) => ({
  ...config,
  updates: {
    ...config.updates,
    url: "https://u.expo.dev/f43e8b35-5e2a-4e5d-92bb-9cdc051ca72a"
  },
  runtimeVersion: {
    policy: "appVersion"
  },
  extra: {
    ...config.extra,
    supabaseUrl: process.env.SUPABASE_URL || "https://ulltpjezntzgiawchmaj.supabase.co",
    supabasePublishableKey: process.env.SUPABASE_PUBLISHABLE_KEY || "sb_publishable_k6gtnpe-RzS6RQ3EC8e5Jg_rVvZbqVm",
    supabaseSecretKey: process.env.SUPABASE_SECRET_KEY || "sb_secret_Rh0p39XrweFbVGozkaflhQ_-pOLol5-"
  },
  ios: {
    ...(config.ios || {}),
    bundleIdentifier: "com.ultimateteam.app"
  }
}); 