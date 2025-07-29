export const preloadChunks = () => {
  if (typeof window === 'undefined') return;

  // Handle chunk load errors globally
  window.addEventListener('error', (event) => {
    if (event.error?.name === 'ChunkLoadError') {
      console.warn('ChunkLoadError detected, attempting recovery...');
      
      // Clear service worker caches
      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({ type: 'CLEAR_CACHE' });
      }
      
      // Retry loading the chunk
      const src = (event.target as HTMLScriptElement)?.src;
      if (src) {
        setTimeout(() => {
          const script = document.createElement('script');
          script.src = src;
          document.head.appendChild(script);
        }, 100);
      }
    }
  }, true);

  // Intercept webpack chunk loading
  if (window.__webpack_require__) {
    const originalEnsure = window.__webpack_require__.e;
    
    window.__webpack_require__.e = function(chunkId: string) {
      return originalEnsure.call(this, chunkId).catch((error: Error) => {
        console.warn(`Failed to load chunk ${chunkId}, retrying...`);
        
        // Clear module cache for this chunk
        delete window.__webpack_require__.cache[chunkId];
        
        // Retry once
        return originalEnsure.call(this, chunkId).catch(() => {
          // If retry fails, reload the page
          console.error(`Failed to load chunk ${chunkId} after retry`);
          window.location.reload();
        });
      });
    };
  }
};

// Initialize chunk preloader
if (typeof window !== 'undefined') {
  preloadChunks();
}

declare global {
  interface Window {
    __webpack_require__: any;
  }
}