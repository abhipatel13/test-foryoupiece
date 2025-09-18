import { useState, useEffect, useCallback } from 'react';

interface CategoryImages {
  [categorySlug: string]: string | null;
}

interface CategoryImagesResponse {
  success: boolean;
  images: CategoryImages;
  timestamp: string;
  cached?: boolean;
}

interface ProgressiveLoadingState {
  textLoaded: boolean;
  imagesLoaded: boolean;
  imageLoadingProgress: number;
  loadedImages: Set<string>;
}

/**
 * Hook to fetch random product images for categories with progressive loading
 */
export function useCategoryImages() {
  const [images, setImages] = useState<CategoryImages>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cached, setCached] = useState(false);
  const [progressiveState, setProgressiveState] = useState<ProgressiveLoadingState>({
    textLoaded: true, // Text content is always immediately available
    imagesLoaded: false,
    imageLoadingProgress: 0,
    loadedImages: new Set()
  });

  // Robust image preloading function with error handling and progress tracking
  const preloadImagesWithProgress = useCallback(async (imageUrls: CategoryImages) => {
    const imageEntries = Object.entries(imageUrls).filter(([_, url]) => url !== null);
    const totalImages = imageEntries.length;

    if (totalImages === 0) {
      setProgressiveState(prev => ({
        ...prev,
        imagesLoaded: true,
        imageLoadingProgress: 100
      }));
      return;
    }

    console.log(`🖼️ Preloading ${totalImages} category images...`);

    // Create promises for each image with individual timeout and error handling
    const imagePromises = imageEntries.map(([categorySlug, imageUrl], index) => {
      return new Promise<{ categorySlug: string; success: boolean }>((resolve) => {
        const img = new Image();
        let resolved = false;

        // Success handler
        const onLoad = () => {
          if (!resolved) {
            resolved = true;
            console.log(`✅ Image loaded: ${categorySlug}`);

            // Update progress
            const loadedCount = index + 1;
            const progress = (loadedCount / totalImages) * 100;

            setProgressiveState(prev => {
              const newLoadedImages = new Set(prev.loadedImages);
              newLoadedImages.add(categorySlug);

              return {
                ...prev,
                loadedImages: newLoadedImages,
                imageLoadingProgress: progress,
                imagesLoaded: loadedCount === totalImages
              };
            });

            resolve({ categorySlug, success: true });
          }
        };

        // Error handler
        const onError = () => {
          if (!resolved) {
            resolved = true;
            console.warn(`⚠️ Image failed to load: ${categorySlug} (${imageUrl})`);

            // Still update progress even on failure
            const loadedCount = index + 1;
            const progress = (loadedCount / totalImages) * 100;

            setProgressiveState(prev => ({
              ...prev,
              imageLoadingProgress: progress,
              imagesLoaded: loadedCount === totalImages
            }));

            resolve({ categorySlug, success: false });
          }
        };

        // Timeout handler (3 seconds per image)
        const timeout = setTimeout(() => {
          if (!resolved) {
            resolved = true;
            console.warn(`⏰ Image loading timeout: ${categorySlug}`);
            onError();
          }
        }, 3000);

        // Set up event listeners
        img.onload = () => {
          clearTimeout(timeout);
          onLoad();
        };

        img.onerror = () => {
          clearTimeout(timeout);
          onError();
        };

        // Start loading with optimized parameters
        // Removed crossOrigin to avoid CORS restrictions on external images
        img.loading = 'eager';
        img.width = 150;
        img.height = 150;
        img.src = imageUrl!;
      });
    });

    // Use Promise.allSettled to handle all images regardless of individual failures
    try {
      const results = await Promise.allSettled(imagePromises);
      const successCount = results.filter(result =>
        result.status === 'fulfilled' && result.value.success
      ).length;

      console.log(`🎯 Image preloading complete: ${successCount}/${totalImages} successful`);

      // Ensure final state is set
      setProgressiveState(prev => ({
        ...prev,
        imagesLoaded: true,
        imageLoadingProgress: 100
      }));

    } catch (error) {
      console.error('❌ Unexpected error in image preloading:', error);
      // Ensure loading state is cleared even on unexpected errors
      setProgressiveState(prev => ({
        ...prev,
        imagesLoaded: true,
        imageLoadingProgress: 100
      }));
    }
  }, []);

  const fetchImages = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Add browser environment check
      if (typeof window === 'undefined') {
        console.log('⚠️ Server-side rendering detected, skipping image fetch');
        return;
      }

      // Reset progressive state
      setProgressiveState(prev => ({
        ...prev,
        imagesLoaded: false,
        imageLoadingProgress: 0,
        loadedImages: new Set()
      }));

      const startTime = performance.now();
      console.log('🖼️ Fetching random category images (ultra-fast mode)...');

      // Add timeout to prevent infinite loading (with browser compatibility check)
      let controller: AbortController | undefined;
      let timeoutId: number | undefined;

      if (typeof AbortController !== 'undefined') {
        controller = new AbortController();
        timeoutId = window.setTimeout(() => controller?.abort(), 8000); // 8 second timeout
      }

      const response = await fetch('/api/categories/random-images', {
        // Browser-compatible headers for performance
        headers: {
          'Accept': 'application/json',
          'Cache-Control': 'public, max-age=900' // 15 minutes
        },
        // Browser-compatible options
        method: 'GET',
        credentials: 'same-origin',
        ...(controller && { signal: controller.signal })
      });

      if (timeoutId) window.clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data: CategoryImagesResponse = await response.json();

      if (!data.success) {
        throw new Error('Failed to fetch category images');
      }

      const endTime = performance.now();
      const loadTime = Math.round(endTime - startTime);

      console.log(`✅ Loaded category images in ${loadTime}ms:`, Object.keys(data.images).map(cat => `${cat}: ${data.images[cat] ? 'Yes' : 'No'}`));

      if (data.cached) {
        console.log('💾 Images served from cache');
      }

      setImages(data.images);
      setCached(data.cached || false);

      // Robust image preloading with proper error handling and progress tracking
      if (data.images) {
        // Set maximum loading timeout (10 seconds total)
        const maxLoadingTimeout = setTimeout(() => {
          console.warn('⏰ Maximum image loading time reached, forcing completion');
          setProgressiveState(prev => ({
            ...prev,
            imagesLoaded: true,
            imageLoadingProgress: 100
          }));
        }, 10000);

        try {
          await preloadImagesWithProgress(data.images);
        } finally {
          clearTimeout(maxLoadingTimeout);
        }
      } else {
        // No images to load, mark as complete
        setProgressiveState(prev => ({
          ...prev,
          imagesLoaded: true,
          imageLoadingProgress: 100
        }));
      }

    } catch (err) {
      console.warn('⚠️ Error fetching category images:', err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);

      // Enhanced fallback with retry mechanism
      console.log('🔄 Attempting fallback image fetch...');

      try {
        // Try a simplified fetch without extra headers as fallback
        const fallbackResponse = await fetch('/api/categories/random-images', {
          method: 'GET'
        });

        if (fallbackResponse.ok) {
          const fallbackData = await fallbackResponse.json();
          if (fallbackData.success && fallbackData.images) {
            console.log('✅ Fallback image fetch successful');
            setImages(fallbackData.images);
            setError(null);
            setProgressiveState(prev => ({
              ...prev,
              imagesLoaded: true,
              imageLoadingProgress: 100
            }));
            return;
          }
        }
      } catch (fallbackErr) {
        console.warn('⚠️ Fallback image fetch also failed:', fallbackErr);
      }

      // Final fallback to empty images (categories will show emojis instead)
      console.log('📦 Using emoji fallback for category images');
      setImages({});
      setCached(false);

      // Mark as loaded even on error to stop loading states
      setProgressiveState(prev => ({
        ...prev,
        imagesLoaded: true,
        imageLoadingProgress: 100
      }));

    } finally {
      setLoading(false);
    }
  }, []);

  // Function to track individual image loading
  const onImageLoad = useCallback((categorySlug: string) => {
    setProgressiveState(prev => {
      const newLoadedImages = new Set(prev.loadedImages);
      newLoadedImages.add(categorySlug);

      const totalImages = Object.keys(images).length;
      const loadedCount = newLoadedImages.size;
      const progress = totalImages > 0 ? (loadedCount / totalImages) * 100 : 0;

      return {
        ...prev,
        loadedImages: newLoadedImages,
        imageLoadingProgress: progress,
        imagesLoaded: loadedCount === totalImages
      };
    });
  }, [images]);

  useEffect(() => {
    fetchImages();
  }, [fetchImages]);

  return {
    images,
    loading,
    error,
    cached,
    progressiveState,
    onImageLoad,
    refetch: fetchImages
  };
}
