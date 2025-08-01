/**
 * Node.js polyfills for browser globals
 * This script patches the global object before any modules are loaded
 */

// Ensure global is available
if (typeof global === 'undefined' && typeof globalThis !== 'undefined') {
  global = globalThis;
}

// Create a comprehensive self polyfill
const createSelfPolyfill = () => {
  const self = global || globalThis || {};
  
  // Add common browser globals that might be expected
  if (typeof self.window === 'undefined') {
    self.window = undefined;
  }
  if (typeof self.document === 'undefined') {
    self.document = undefined;
  }
  if (typeof self.navigator === 'undefined') {
    self.navigator = { userAgent: 'node' };
  }
  if (typeof self.location === 'undefined') {
    self.location = { href: '', protocol: 'https:' };
  }
  
  return self;
};

// Apply polyfill to all possible global contexts
if (typeof globalThis !== 'undefined' && typeof globalThis.self === 'undefined') {
  globalThis.self = createSelfPolyfill();
}

if (typeof global !== 'undefined' && typeof global.self === 'undefined') {
  global.self = createSelfPolyfill();
}

// Also set it as a direct variable in case modules check for it differently
if (typeof self === 'undefined') {
  self = createSelfPolyfill();
}

// Export to make this a module
module.exports = {};