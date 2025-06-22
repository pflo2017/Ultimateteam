// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Optimize bundling
config.resolver.assetExts.push('db', 'mp3', 'ttf', 'obj', 'png', 'jpg', 'jpeg');
config.transformer.minifierConfig = {
  keep_classnames: true,
  keep_fnames: true,
  mangle: {
    keep_classnames: true,
    keep_fnames: true,
  },
};

<<<<<<< HEAD:metro.config.js
module.exports = config; 
=======
  config.transformer = {
    ...transformer,
    babelTransformerPath: require.resolve('react-native-svg-transformer'),
  };
  
  // Function to safely require a module with fallback
  const safeRequire = (moduleName, fallbackPath) => {
    try {
      return require.resolve(moduleName);
    } catch (e) {
      console.warn(`Could not resolve ${moduleName}, using fallback`);
      return fallbackPath;
    }
  };
  
  config.resolver = {
    ...resolver,
    assetExts: resolver.assetExts.filter((ext) => ext !== 'svg'),
    sourceExts: [...resolver.sourceExts, 'svg'],
    extraNodeModules: {
      ...resolver.extraNodeModules,
      stream: require.resolve('stream-browserify'),
      events: require.resolve('events/'),
      http: require.resolve('stream-http'),
      https: require.resolve('https-browserify'),
      url: require.resolve('url/'),
      zlib: require.resolve('browserify-zlib'),
      crypto: require.resolve('react-native-crypto'),
      buffer: require.resolve('buffer/'),
      util: require.resolve('util/'),
      net: safeRequire('react-native-tcp-socket', path.resolve(__dirname, 'empty-module.js')),
      tls: path.resolve(__dirname, 'empty-module.js'),
      ws: false,
      assert: require.resolve('assert'),
    },
  };

  return config;
})(); 
>>>>>>> dashboard-admin-fixes:temp_scripts/metro.config.js
