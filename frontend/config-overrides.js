
const webpack = require('webpack');
module.exports = function override(config) {
    // Le paquet xlsx expédie un build .mjs avec des imports bruts type "process/browser"
    // (sans extension). Webpack 5 traite les .mjs comme des modules ES "fully specified"
    // et refuse de les résoudre sans extension explicite. On désactive cette contrainte
    // pour les fichiers .mjs de node_modules plutôt que de renoncer à la lib.
    config.module.rules.push({
      test: /\.mjs$/,
      include: /node_modules/,
      type: 'javascript/auto',
    });
    const fallback = config.resolve.fallback || {};
    Object.assign(fallback, { 
      "crypto": require.resolve("crypto-browserify"), 
      "stream": require.resolve("stream-browserify"), 
      "assert": require.resolve("assert"), 
      "http": require.resolve("stream-http"), 
      "https": require.resolve("https-browserify"), 
      "os": require.resolve("os-browserify"), 
      "url": require.resolve("url") 
      }) 
   config.resolve.fallback = fallback; 
   config.plugins = (config.plugins || []).concat([ 
     new webpack.ProvidePlugin({ 
      process: 'process/browser', 
      Buffer: ['buffer', 'Buffer'] 
    }) 
   ]) 
   return config; }