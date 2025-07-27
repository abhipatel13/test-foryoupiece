import { useState, useEffect } from 'react';

export interface BoxHeroCategory {
  name: string;
  count: number;
  slug: string;
  emoji: string;
}

interface BoxHeroCategoriesResponse {
  success: boolean;
  categories: BoxHeroCategory[];
  total: number;
  source: string;
}

interface UseBoxHeroCategoriesResult {
  categories: BoxHeroCategory[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

/**
 * Custom hook to fetch categories from Supabase database only
 * BoxHero data is synced via manual sync operations - no real-time API calls
 */
export function useBoxHeroCategories(): UseBoxHeroCategoriesResult {
  const [categories, setCategories] = useState<BoxHeroCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCategories = async () => {
    try {
      setLoading(true);
      setError(null);

      console.log('📂 Fetching categories from Supabase database...');

      // Add browser environment check
      if (typeof window === 'undefined') {
        console.log('⚠️ Server-side rendering detected, skipping fetch');
        return;
      }

      // Add timeout to prevent infinite loading (with browser compatibility check)
      let controller: AbortController | undefined;
      let timeoutId: number | undefined;

      if (typeof AbortController !== 'undefined') {
        controller = new AbortController();
        timeoutId = window.setTimeout(() => controller?.abort(), 10000); // 10 second timeout
      }

      // Retry logic for development 404 errors (Next.js compilation issues)
      let response: Response;
      let lastError: Error | null = null;
      const maxRetries = 3;

      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          response = await fetch('/api/boxhero/categories', {
            method: 'GET',
            headers: {
              'Accept': 'application/json'
            },
            credentials: 'same-origin',
            ...(controller && { signal: controller.signal })
          });

          if (timeoutId) window.clearTimeout(timeoutId);

          // If successful or non-404 error, break out of retry loop
          if (response.ok || response.status !== 404) {
            break;
          }

          // If 404 and not last attempt, wait and retry
          if (response.status === 404 && attempt < maxRetries) {
            console.log(`📂 Categories API returned 404, retrying... (${attempt}/${maxRetries})`);
            await new Promise(resolve => setTimeout(resolve, 1000 * attempt)); // Exponential backoff
            continue;
          }

          // If 404 on last attempt, throw error
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        } catch (error) {
          lastError = error as Error;
          if (attempt === maxRetries) {
            throw lastError;
          }
          console.log(`📂 Categories API error on attempt ${attempt}, retrying...`, error);
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        }
      }

      if (!response!.ok) {
        throw new Error(`HTTP ${response!.status}: ${response!.statusText}`);
      }

      const data: BoxHeroCategoriesResponse = await response.json();

      if (!data.success) {
        throw new Error('Failed to fetch categories from Supabase database');
      }

      console.log(`✅ Loaded ${data.categories.length} categories from Supabase database`);
      setCategories(data.categories);

    } catch (err) {
      console.error('❌ Error fetching categories:', err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);

      // Enhanced fallback with retry mechanism
      console.log('🔄 Attempting fallback categories...');

      // Try a simplified fetch without extra headers as fallback
      try {
        const fallbackResponse = await fetch('/api/boxhero/categories', {
          method: 'GET'
        });

        if (fallbackResponse.ok) {
          const fallbackData = await fallbackResponse.json();
          if (fallbackData.success && fallbackData.categories) {
            console.log('✅ Fallback fetch successful');
            setCategories(fallbackData.categories);
            setError(null);
            return;
          }
        }
      } catch (fallbackErr) {
        console.warn('⚠️ Fallback fetch also failed:', fallbackErr);
      }

      // Final fallback to static categories with realistic counts
      console.log('📦 Using static fallback categories');
      setCategories([
        { name: 'Hair', count: 347, slug: 'hair', emoji: '💇' },
        { name: 'Bath & Body', count: 189, slug: 'bath-body', emoji: '🛁' },
        { name: 'Skincare', count: 163, slug: 'skincare', emoji: '✨' },
        { name: 'Health & Personal Care', count: 59, slug: 'health-personal-care', emoji: '🏥' },
        { name: 'Food & Beverage', count: 40, slug: 'food-beverage', emoji: '🍽️' },
        { name: 'Makeup', count: 53, slug: 'makeup', emoji: '💄' },
        { name: 'Home', count: 36, slug: 'home', emoji: '🏠' }
      ]);

    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  return {
    categories,
    loading,
    error,
    refetch: fetchCategories
  };
}
