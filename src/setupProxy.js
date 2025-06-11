const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function(app) {
  // --- Proxy for Faucet Backend --- 
  app.use(
    '/api/faucet-claim', // Match requests from the React app to this path
    createProxyMiddleware({
      target: 'http://localhost:3001', // Target the local Node.js server
      changeOrigin: true,
      pathRewrite: {
        '^/api/faucet-claim': '/faucet-claim', // Remove /api prefix before forwarding
      },
      logLevel: 'warn', // Reduced logging
    })
  );

  // Proxy API requests to Qubic RPC endpoint
  app.use(
    '/api/proxy',
    createProxyMiddleware({
      target: 'https://rpc.qubic.org',
      changeOrigin: true,
      pathRewrite: {
        '^/api/proxy': '',
      },
      onProxyRes: function(proxyRes, req, res) {
        // Add CORS headers
        proxyRes.headers['Access-Control-Allow-Origin'] = '*';
        proxyRes.headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS';
        proxyRes.headers['Access-Control-Allow-Headers'] = 'Origin, X-Requested-With, Content-Type, Accept';
      },
      logLevel: 'warn', // Reduced logging
    })
  );
}; 