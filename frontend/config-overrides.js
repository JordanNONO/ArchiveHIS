
const webpack = require('webpack');
function override(config) {
    // Le paquet xlsx expédie un build .mjs, et canvg (dépendance de jspdf) un
    // build .es.js — tous deux avec des imports bruts type "process/browser"
    // (sans extension). Webpack 5 traite ces fichiers comme des modules ES
    // "fully specified" et refuse de les résoudre sans extension explicite. On
    // désactive cette contrainte pour ces fichiers de node_modules plutôt que de
    // renoncer aux libs.
    config.module.rules.push({
      test: /\.(mjs|es\.js)$/,
      include: /node_modules/,
      type: 'javascript/auto',
      resolve: { fullySpecified: false },
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

/**
 * Le backend (Laravel, :8000) et Reverb (WebSocket, :8080) sont relayés à travers
 * CE serveur de dev — une fois celui-ci en HTTPS (voir .env.local), un fetch/WS
 * direct vers un :8000/:8080 en http:// serait bloqué comme contenu mixte. Passer
 * par une seule origine évite aussi tout souci CORS. xfwd (sans changeOrigin)
 * transmet l'hôte/schéma d'origine au backend, qui s'en sert (TrustProxies, voir
 * bootstrap/app.php) pour générer des liens signés avec la bonne origine.
 */
function overrideDevServer(configFunction) {
  return function (proxy, allowedHost) {
    const config = configFunction(proxy, allowedHost);

    config.proxy = {
      '/api': { target: 'http://localhost:8000', xfwd: true, changeOrigin: false },
      '/broadcasting': { target: 'http://localhost:8000', xfwd: true, changeOrigin: false },
      '/storage': { target: 'http://localhost:8000', xfwd: true, changeOrigin: false },
      '/app': { target: 'ws://localhost:8080', ws: true, changeOrigin: false },
    };

    return config;
  };
}

module.exports = { webpack: override, devServer: overrideDevServer };