#!/usr/bin/env node

/**
 * Bundle Analysis Script for ForYouPiece
 * Analyzes Next.js bundle sizes and provides optimization recommendations
 */

const fs = require('fs');
const path = require('path');

const BUNDLE_SIZE_LIMITS = {
  // Recommended bundle size limits (in KB)
  'main-app': 500,  // Main app bundle should be under 500KB
  'page': 200,      // Individual page bundles should be under 200KB
  'vendors': 800,   // Vendor chunks should be under 800KB
  'ui-libs': 150,   // UI library chunks should be under 150KB
  'icons': 50,      // Icon chunks should be under 50KB
};

const PERFORMANCE_THRESHOLDS = {
  // Performance thresholds for different metrics
  firstContentfulPaint: 2000,  // 2 seconds
  largestContentfulPaint: 4000, // 4 seconds
  totalBlockingTime: 300,       // 300ms
  cumulativeLayoutShift: 0.1,   // 0.1 CLS score
};

function analyzeBundleSize() {
  console.log('🔍 Analyzing Next.js bundle sizes...\n');

  const buildDir = path.join(process.cwd(), '.next');
  const staticDir = path.join(buildDir, 'static');

  if (!fs.existsSync(buildDir)) {
    console.error('❌ Build directory not found. Please run "npm run build" first.');
    process.exit(1);
  }

  // Analyze JavaScript chunks
  const jsChunksDir = path.join(staticDir, 'chunks');
  if (fs.existsSync(jsChunksDir)) {
    analyzeJavaScriptChunks(jsChunksDir);
  }

  // Analyze CSS files
  const cssDir = path.join(staticDir, 'css');
  if (fs.existsSync(cssDir)) {
    analyzeCSSFiles(cssDir);
  }

  // Provide optimization recommendations
  provideOptimizationRecommendations();
}

function analyzeJavaScriptChunks(chunksDir) {
  console.log('📦 JavaScript Bundle Analysis:');
  console.log('================================\n');

  const files = fs.readdirSync(chunksDir);
  const jsFiles = files.filter(file => file.endsWith('.js'));

  let totalSize = 0;
  const bundleAnalysis = [];

  jsFiles.forEach(file => {
    const filePath = path.join(chunksDir, file);
    const stats = fs.statSync(filePath);
    const sizeKB = Math.round(stats.size / 1024);
    totalSize += sizeKB;

    bundleAnalysis.push({
      name: file,
      size: sizeKB,
      path: filePath
    });
  });

  // Sort by size (largest first)
  bundleAnalysis.sort((a, b) => b.size - a.size);

  // Display results
  bundleAnalysis.slice(0, 10).forEach((bundle, index) => {
    const status = getBundleStatus(bundle.name, bundle.size);
    console.log(`${index + 1}. ${bundle.name}`);
    console.log(`   Size: ${bundle.size}KB ${status}`);
    console.log('');
  });

  console.log(`📊 Total JavaScript: ${totalSize}KB\n`);
}

function analyzeCSSFiles(cssDir) {
  console.log('🎨 CSS Bundle Analysis:');
  console.log('=======================\n');

  const files = fs.readdirSync(cssDir);
  const cssFiles = files.filter(file => file.endsWith('.css'));

  let totalSize = 0;

  cssFiles.forEach(file => {
    const filePath = path.join(cssDir, file);
    const stats = fs.statSync(filePath);
    const sizeKB = Math.round(stats.size / 1024);
    totalSize += sizeKB;

    console.log(`• ${file}: ${sizeKB}KB`);
  });

  console.log(`\n📊 Total CSS: ${totalSize}KB\n`);
}

function getBundleStatus(fileName, sizeKB) {
  // Determine bundle type and check against limits
  let bundleType = 'other';
  
  if (fileName.includes('main-app')) bundleType = 'main-app';
  else if (fileName.includes('page')) bundleType = 'page';
  else if (fileName.includes('vendors')) bundleType = 'vendors';
  else if (fileName.includes('ui-libs')) bundleType = 'ui-libs';
  else if (fileName.includes('icons')) bundleType = 'icons';

  const limit = BUNDLE_SIZE_LIMITS[bundleType];
  
  if (!limit) return ''; // No limit defined
  
  if (sizeKB > limit) {
    return `❌ (>${limit}KB limit)`;
  } else if (sizeKB > limit * 0.8) {
    return `⚠️ (approaching ${limit}KB limit)`;
  } else {
    return `✅ (under ${limit}KB limit)`;
  }
}

function provideOptimizationRecommendations() {
  console.log('💡 Optimization Recommendations:');
  console.log('=================================\n');

  const recommendations = [
    '1. 🔄 Enable dynamic imports for heavy components',
    '2. 📦 Use Next.js bundle analyzer: npm install --save-dev @next/bundle-analyzer',
    '3. 🌳 Implement tree shaking for unused code elimination',
    '4. 📱 Consider code splitting by routes and features',
    '5. 🗜️ Enable compression in production (gzip/brotli)',
    '6. 🖼️ Optimize images with Next.js Image component',
    '7. ⚡ Use React.lazy() for component-level code splitting',
    '8. 📊 Monitor Core Web Vitals regularly',
    '9. 🔍 Use webpack-bundle-analyzer for detailed analysis',
    '10. 🚀 Consider using SWC for faster builds'
  ];

  recommendations.forEach(rec => console.log(rec));
  console.log('');
}

// Performance monitoring utilities
function generatePerformanceReport() {
  console.log('⚡ Performance Monitoring Setup:');
  console.log('================================\n');

  const performanceScript = `
// Add this to your _app.tsx for performance monitoring
import { getCLS, getFID, getFCP, getLCP, getTTFB } from 'web-vitals';

function sendToAnalytics(metric) {
  console.log('📊 Web Vital:', metric);
  // Send to your analytics service
}

getCLS(sendToAnalytics);
getFID(sendToAnalytics);
getFCP(sendToAnalytics);
getLCP(sendToAnalytics);
getTTFB(sendToAnalytics);
`;

  console.log('Add web-vitals monitoring to your app:');
  console.log(performanceScript);
}

// Main execution
if (require.main === module) {
  analyzeBundleSize();
  generatePerformanceReport();
}

module.exports = {
  analyzeBundleSize,
  generatePerformanceReport,
  BUNDLE_SIZE_LIMITS,
  PERFORMANCE_THRESHOLDS
};
