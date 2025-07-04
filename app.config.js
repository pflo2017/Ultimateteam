require('dotenv').config();

export default ({ config }) => ({
  ...config,
  updates: {
    ...config.updates,
    url: "https://u.expo.dev/f43e8b35-5e2a-4e5d-92bb-9cdc051ca72a"
  },
  runtimeVersion: {
    policy: "appVersion"
  }
}); 