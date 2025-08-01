/**
 * Custom Webpack Plugin to inject polyfills at the start of bundles
 * This ensures browser globals are available before any code executes
 */

class WebpackPolyfillPlugin {
  constructor(options = {}) {
    this.options = options;
  }

  apply(compiler) {
    const pluginName = 'WebpackPolyfillPlugin';
    
    compiler.hooks.compilation.tap(pluginName, (compilation) => {
      // Hook into the optimize phase to modify chunks
      compilation.hooks.optimizeChunks.tap(pluginName, (chunks) => {
        // Add polyfill to all chunks, especially vendors
        chunks.forEach((chunk) => {
          if (chunk.name === 'vendors' || chunk.name === 'main' || chunk.name === 'runtime') {
            console.log(`🔧 Adding polyfill to chunk: ${chunk.name}`);
          }
        });
      });

      // Use banner to inject polyfill code at the start of each bundle
      const { BannerPlugin } = compiler.webpack;
      
      new BannerPlugin({
        banner: `
// Webpack Polyfill Plugin - Browser globals for Node.js environment
(function() {
  if (typeof global !== 'undefined' && typeof global.self === 'undefined') {
    global.self = global;
  }
  if (typeof globalThis !== 'undefined' && typeof globalThis.self === 'undefined') {
    globalThis.self = globalThis;
  }
  // Additional browser globals
  if (typeof global !== 'undefined') {
    if (typeof global.window === 'undefined') global.window = undefined;
    if (typeof global.document === 'undefined') global.document = undefined;
    if (typeof global.navigator === 'undefined') global.navigator = undefined;
    if (typeof global.location === 'undefined') global.location = undefined;
  }
})();
`,
        raw: true,
        entryOnly: false, // Apply to all chunks, not just entry points
      }).apply(compiler);
    });

    // Hook into the emit phase to modify the generated code
    compiler.hooks.emit.tapAsync(pluginName, (compilation, callback) => {
      // Modify the vendors.js file specifically
      Object.keys(compilation.assets).forEach((filename) => {
        if (filename.includes('vendors') && filename.endsWith('.js')) {
          const asset = compilation.assets[filename];
          const source = asset.source();
          
          // Prepend polyfill code to the vendors bundle
          const polyfillCode = `
// Emergency polyfill for 'self' global - injected by WebpackPolyfillPlugin
if (typeof self === 'undefined') {
  if (typeof global !== 'undefined') {
    self = global;
  } else if (typeof globalThis !== 'undefined') {
    self = globalThis;
  } else {
    self = {};
  }
}
`;
          
          const modifiedSource = polyfillCode + source;
          
          compilation.assets[filename] = {
            source: () => modifiedSource,
            size: () => modifiedSource.length
          };
          
          console.log(`🔧 Modified ${filename} with polyfill injection`);
        }
      });
      
      callback();
    });
  }
}

module.exports = WebpackPolyfillPlugin;
