#!/usr/bin/env node

/**
 * Script to systematically update admin API routes with sanitized error handling
 * This script identifies and updates error handling patterns in admin API routes
 */

const fs = require('fs');
const path = require('path');

// Admin API routes directory
const ADMIN_API_DIR = path.join(__dirname, '../src/app/api/admin');

// Error handling patterns to find and replace
const ERROR_PATTERNS = [
  // Pattern 1: Direct error.message exposure
  {
    pattern: /return NextResponse\.json\(\s*\{\s*success:\s*false,\s*error:\s*error\.message/g,
    replacement: 'return handleDatabaseError(error, context)'
  },
  
  // Pattern 2: Generic catch blocks
  {
    pattern: /catch\s*\(error[^)]*\)\s*\{\s*console\.error[^}]*return NextResponse\.json\(\s*\{\s*success:\s*false,\s*error:\s*['"]Internal server error['"][^}]*\}/g,
    replacement: 'catch (error) {\n    return handleGenericError(error, context);\n  }'
  },
  
  // Pattern 3: Database error exposures
  {
    pattern: /if\s*\(.*error.*\)\s*\{[^}]*error\.message[^}]*\}/g,
    replacement: 'if (error) {\n      return handleDatabaseError(error, context);\n    }'
  }
];

// Import statement to add
const IMPORT_STATEMENT = `import { 
  handleDatabaseError, 
  handleValidationError, 
  handleGenericError,
  handleAuthenticationError,
  handleAuthorizationError,
  handleExternalApiError
} from '@/lib/security/error-sanitizer';`;

/**
 * Recursively find all TypeScript files in admin API directory
 */
function findAdminApiFiles(dir) {
  const files = [];
  
  function traverse(currentDir) {
    const items = fs.readdirSync(currentDir);
    
    for (const item of items) {
      const fullPath = path.join(currentDir, item);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory()) {
        traverse(fullPath);
      } else if (item.endsWith('.ts') && item !== 'route.ts.backup') {
        files.push(fullPath);
      }
    }
  }
  
  traverse(dir);
  return files;
}

/**
 * Check if file already has error sanitizer imports
 */
function hasErrorSanitizerImport(content) {
  return content.includes('@/lib/security/error-sanitizer');
}

/**
 * Add error sanitizer import to file
 */
function addErrorSanitizerImport(content) {
  // Find the last import statement
  const lines = content.split('\n');
  let lastImportIndex = -1;
  
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim().startsWith('import ')) {
      lastImportIndex = i;
    }
  }
  
  if (lastImportIndex >= 0) {
    lines.splice(lastImportIndex + 1, 0, IMPORT_STATEMENT);
    return lines.join('\n');
  }
  
  return IMPORT_STATEMENT + '\n' + content;
}

/**
 * Analyze file for error handling patterns
 */
function analyzeErrorHandling(content, filePath) {
  const issues = [];
  
  // Check for direct error.message exposure
  if (content.includes('error.message')) {
    issues.push('Direct error.message exposure detected');
  }
  
  // Check for detailed error object exposure
  if (content.includes('error.code') || content.includes('error.details')) {
    issues.push('Detailed error object exposure detected');
  }
  
  // Check for stack trace exposure
  if (content.includes('error.stack')) {
    issues.push('Stack trace exposure detected');
  }
  
  // Check for generic error messages
  if (content.includes('"Internal server error"')) {
    issues.push('Generic error handling found');
  }
  
  return issues;
}

/**
 * Update a single admin API file
 */
function updateAdminApiFile(filePath) {
  console.log(`\n📁 Processing: ${path.relative(ADMIN_API_DIR, filePath)}`);
  
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    const originalContent = content;
    
    // Analyze current error handling
    const issues = analyzeErrorHandling(content, filePath);
    
    if (issues.length === 0) {
      console.log('  ✅ No error handling issues detected');
      return;
    }
    
    console.log('  🔍 Issues found:');
    issues.forEach(issue => console.log(`    - ${issue}`));
    
    // Add import if not present
    if (!hasErrorSanitizerImport(content)) {
      content = addErrorSanitizerImport(content);
      console.log('  ➕ Added error sanitizer import');
    }
    
    // Create backup
    const backupPath = filePath + '.backup';
    fs.writeFileSync(backupPath, originalContent);
    console.log('  💾 Created backup');
    
    // Note: Actual pattern replacement would be done manually
    // due to complexity of context-specific replacements
    console.log('  ⚠️  Manual review required for error handling updates');
    
  } catch (error) {
    console.error(`  ❌ Error processing file: ${error.message}`);
  }
}

/**
 * Main function
 */
function main() {
  console.log('🔧 Admin API Error Handling Update Script');
  console.log('==========================================');
  
  if (!fs.existsSync(ADMIN_API_DIR)) {
    console.error(`❌ Admin API directory not found: ${ADMIN_API_DIR}`);
    process.exit(1);
  }
  
  const adminApiFiles = findAdminApiFiles(ADMIN_API_DIR);
  console.log(`📊 Found ${adminApiFiles.length} admin API files`);
  
  // Process each file
  adminApiFiles.forEach(updateAdminApiFile);
  
  console.log('\n✅ Analysis complete!');
  console.log('\n📋 Next steps:');
  console.log('1. Review the identified issues in each file');
  console.log('2. Manually update error handling patterns');
  console.log('3. Test the updated error handling');
  console.log('4. Remove backup files when satisfied');
}

// Run the script
if (require.main === module) {
  main();
}

module.exports = {
  findAdminApiFiles,
  analyzeErrorHandling,
  updateAdminApiFile
};
