#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

/**
 * Clear Next.js cache and node_modules cache
 * Useful for Windows development when file watching issues occur
 */

const projectRoot = path.join(__dirname, '..');

const pathsToDelete = [
  path.join(projectRoot, '.next'),
  path.join(projectRoot, 'node_modules', '.cache'),
  path.join(projectRoot, '.turbo'),
];

function deleteFolderRecursive(folderPath) {
  if (fs.existsSync(folderPath)) {
    fs.rmSync(folderPath, { recursive: true, force: true });
    console.log(`✅ Deleted: ${folderPath}`);
  } else {
    console.log(`⚠️  Not found: ${folderPath}`);
  }
}

console.log('🧹 Clearing Next.js development cache...\n');

pathsToDelete.forEach(deleteFolderRecursive);

console.log('\n✨ Cache cleared successfully!');
console.log('💡 You can now run "npm run dev" to start fresh.');
