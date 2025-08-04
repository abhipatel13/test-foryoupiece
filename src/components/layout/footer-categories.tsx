'use client'

import Link from 'next/link';
import { useBoxHeroCategories } from '@/hooks/use-boxhero-categories';

/**
 * Dynamic footer categories component that fetches real BoxHero categories
 */
export function FooterCategories() {
  const { categories, loading } = useBoxHeroCategories();

  if (loading) {
    return (
      <ul className="space-y-3">
        <li>
          <Link href="/en/products" className="text-sm text-muted-foreground hover:text-primary transition-colors">
            All Products
          </Link>
        </li>
        {[...Array(3)].map((_, i) => (
          <li key={i}>
            <div className="h-4 bg-muted rounded w-20 animate-pulse"></div>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <ul className="space-y-3">
      <li>
        <Link href="/en/products" className="text-sm text-muted-foreground hover:text-primary transition-colors">
          All Products
        </Link>
      </li>
      {categories.slice(0, 4).map((category) => (
        <li key={category.slug}>
          <Link
            href={`/en/products?category=${category.slug}`}
            className="text-sm text-muted-foreground hover:text-primary transition-colors"
          >
            {category.name}
          </Link>
        </li>
      ))}
    </ul>
  );
}
