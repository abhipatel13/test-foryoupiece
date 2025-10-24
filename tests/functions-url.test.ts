import { describe, it, expect } from 'vitest'
import { getFunctionsBaseUrlFromEnv, extractProjectRef } from '@/lib/supabase/functions-url'

describe('extractProjectRef', () => {
  it('gets ref from standard supabase url', () => {
    expect(extractProjectRef('https://abcd1234.supabase.co')).toBe('abcd1234')
  })
  it('returns null for custom domains', () => {
    expect(extractProjectRef('https://auth.foryoupiece.com')).toBeNull()
  })
  it('returns null for invalid', () => {
    expect(extractProjectRef('not-a-url')).toBeNull()
  })
})

describe('getFunctionsBaseUrlFromEnv', () => {
  it('prefers SUPABASE_FUNCTIONS_URL', () => {
    const env = { SUPABASE_FUNCTIONS_URL: 'https://x.functions.supabase.co/', SUPABASE_URL: 'https://y.supabase.co' } as any
    expect(getFunctionsBaseUrlFromEnv(env)).toBe('https://x.functions.supabase.co')
  })
  it('falls back to SUPABASE_URL ref', () => {
    const env = { SUPABASE_URL: 'https://projref.supabase.co' } as any
    expect(getFunctionsBaseUrlFromEnv(env)).toBe('https://projref.functions.supabase.co')
  })
  it('falls back to NEXT_PUBLIC_SUPABASE_URL ref', () => {
    const env = { NEXT_PUBLIC_SUPABASE_URL: 'https://ref2.supabase.co' } as any
    expect(getFunctionsBaseUrlFromEnv(env)).toBe('https://ref2.functions.supabase.co')
  })
  it('falls back to SUPABASE_PROJECT_REF', () => {
    const env = { SUPABASE_PROJECT_REF: 'pqr' } as any
    expect(getFunctionsBaseUrlFromEnv(env)).toBe('https://pqr.functions.supabase.co')
  })
  it('returns null if nothing available', () => {
    const env = {} as any
    expect(getFunctionsBaseUrlFromEnv(env)).toBeNull()
  })
})
