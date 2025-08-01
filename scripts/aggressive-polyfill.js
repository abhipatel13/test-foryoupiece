/**
 * Aggressive polyfill that patches the Node.js module system
 * This runs before any modules are loaded and ensures browser globals are available
 */

// Patch the global environment immediately
function applyPolyfills() {
  const globals = [global, globalThis].filter(Boolean);
  
  globals.forEach(g => {
    if (typeof g.self === 'undefined') {
      g.self = g;
      console.log(`✅ Aggressive polyfill: Applied self to ${g === global ? 'global' : 'globalThis'}`);
    }
    
    // Define other browser globals as undefined to prevent errors
    const browserGlobals = ['window', 'document', 'navigator', 'location', 'localStorage', 'sessionStorage'];
    browserGlobals.forEach(name => {
      if (typeof g[name] === 'undefined') {
        g[name] = undefined;
      }
    });
  });
}

// Apply polyfills immediately
applyPolyfills();

// Patch the require system to apply polyfills before any module loads
if (typeof require !== 'undefined' && require.cache) {
  const Module = require('module');
  const originalRequire = Module.prototype.require;
  
  Module.prototype.require = function(id) {
    // Apply polyfills before loading any module
    applyPolyfills();
    
    // Call the original require
    return originalRequire.apply(this, arguments);
  };
  
  console.log('🔧 Aggressive polyfill: Patched require system');
}

// Also patch import() if available
if (typeof globalThis !== 'undefined' && globalThis.import) {
  const originalImport = globalThis.import;
  globalThis.import = function() {
    applyPolyfills();
    return originalImport.apply(this, arguments);
  };
  console.log('🔧 Aggressive polyfill: Patched import system');
}

// Set up process event handlers to ensure polyfills are always applied
if (typeof process !== 'undefined') {
  process.on('beforeExit', () => {
    applyPolyfills();
  });
  
  // Apply polyfills on next tick to ensure they're available
  process.nextTick(() => {
    applyPolyfills();
  });
}

console.log('🚀 Aggressive polyfills applied successfully');

module.exports = { applyPolyfills };
