/**
 * Environment setup script for Node.js polyfills
 * This sets up the global environment before Next.js starts
 */

// Set NODE_OPTIONS to preload our polyfill
process.env.NODE_OPTIONS = (process.env.NODE_OPTIONS || '') + ' --require ./scripts/aggressive-polyfill.js';

console.log('🔧 Environment setup: NODE_OPTIONS configured for polyfills');
console.log('NODE_OPTIONS:', process.env.NODE_OPTIONS);

module.exports = {};
