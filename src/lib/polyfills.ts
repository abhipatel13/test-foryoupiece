/**
 * Global polyfills for server-side rendering
 * This file ensures browser globals are available in Node.js environment
 */

// Polyfill for 'self' global
if (typeof globalThis !== 'undefined' && typeof globalThis.self === 'undefined') {
  globalThis.self = globalThis;
}

if (typeof global !== 'undefined' && typeof (global as any).self === 'undefined') {
  (global as any).self = global;
}

// Additional browser globals polyfills for SSR compatibility
if (typeof global !== 'undefined') {
  // Only define if not already defined to avoid conflicts
  if (typeof (global as any).window === 'undefined') {
    (global as any).window = undefined;
  }
  
  if (typeof (global as any).document === 'undefined') {
    (global as any).document = undefined;
  }
  
  if (typeof (global as any).navigator === 'undefined') {
    (global as any).navigator = undefined;
  }
  
  if (typeof (global as any).location === 'undefined') {
    (global as any).location = undefined;
  }
}

// Export empty object to make this a module
export {};
