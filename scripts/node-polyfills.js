/**
 * Node.js startup polyfills
 * This script patches the global environment before any modules are loaded
 * It must run before Next.js starts to ensure browser globals are available
 */

// Patch global environment immediately
if (typeof global !== 'undefined') {
  // Define 'self' as global if not already defined
  if (typeof global.self === 'undefined') {
    global.self = global;
    console.log('✅ Polyfill: global.self defined as global');
  }

  // Define other browser globals that might be needed
  if (typeof global.window === 'undefined') {
    global.window = undefined;
  }

  if (typeof global.document === 'undefined') {
    global.document = undefined;
  }

  if (typeof global.navigator === 'undefined') {
    global.navigator = undefined;
  }

  if (typeof global.location === 'undefined') {
    global.location = undefined;
  }

  // Additional polyfills for common browser APIs
  if (typeof global.localStorage === 'undefined') {
    global.localStorage = undefined;
  }

  if (typeof global.sessionStorage === 'undefined') {
    global.sessionStorage = undefined;
  }

  if (typeof global.fetch === 'undefined' && typeof require !== 'undefined') {
    // Don't define fetch as undefined since Node.js might have it
    // Just ensure it doesn't cause issues
  }
}

// Also patch globalThis for modern environments
if (typeof globalThis !== 'undefined') {
  if (typeof globalThis.self === 'undefined') {
    globalThis.self = globalThis;
    console.log('✅ Polyfill: globalThis.self defined as globalThis');
  }
}

// Ensure the polyfills are applied before any other modules load
console.log('🔧 Node.js polyfills applied successfully');

module.exports = {};
