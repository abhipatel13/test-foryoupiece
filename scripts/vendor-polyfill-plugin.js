/**
 * Webpack plugin to inject polyfills into vendor bundles
 * This ensures browser globals are available in all server-side code
 */

class VendorPolyfillPlugin {
  constructor(options = {}) {
    this.options = options;
  }

  apply(compiler) {
    const pluginName = 'VendorPolyfillPlugin';
    
    // Inject polyfill at the very beginning of compilation
    compiler.hooks.compilation.tap(pluginName, (compilation) => {
      compilation.hooks.optimizeChunks.tap(pluginName, (chunks) => {
        // Find vendor chunks
        chunks.forEach((chunk) => {
          if (chunk.name && (chunk.name.includes('vendor') || chunk.name === 'main')) {
            console.log(`[VendorPolyfillPlugin] Processing chunk: ${chunk.name}`);
          }
        });
      });
    });

    // Modify the output to include polyfills
    compiler.hooks.emit.tapAsync(pluginName, (compilation, callback) => {
      const polyfillCode = `
// [VendorPolyfillPlugin] Browser globals polyfill for server-side rendering
(function() {
  'use strict';
  
  // Check if we're in a Node.js environment
  var isNode = typeof global !== 'undefined' && 
               typeof global.process !== 'undefined' && 
               global.process.versions && 
               global.process.versions.node;
  
  if (isNode) {
    // Create self polyfill
    if (typeof global.self === 'undefined') {
      global.self = global;
    }
    if (typeof self === 'undefined') {
      var self = global;
    }
    
    // Polyfill other browser globals that might be expected
    if (typeof global.window === 'undefined') {
      global.window = undefined;
    }
    if (typeof global.document === 'undefined') {
      global.document = undefined;
    }
    if (typeof global.navigator === 'undefined') {
      global.navigator = { userAgent: 'node' };
    }
    if (typeof global.location === 'undefined') {
      global.location = { href: '', protocol: 'https:' };
    }
  }
})();

`;

      // Process all JavaScript files
      Object.keys(compilation.assets).forEach((filename) => {
        if (filename.endsWith('.js') && 
            (filename.includes('vendor') || 
             filename.includes('server') || 
             filename.includes('webpack'))) {
          
          const asset = compilation.assets[filename];
          const originalSource = asset.source();
          
          // Prepend polyfill to the file
          const modifiedSource = polyfillCode + originalSource;
          
          compilation.assets[filename] = {
            source: () => modifiedSource,
            size: () => modifiedSource.length
          };
          
          console.log(`[VendorPolyfillPlugin] Injected polyfill into ${filename}`);
        }
      });
      
      callback();
    });
  }
}

module.exports = VendorPolyfillPlugin;