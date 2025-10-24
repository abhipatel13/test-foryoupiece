-- Secure synonyms table behind SECURITY DEFINER RPC (Option B)
-- 1) Enable RLS on table; 2) Revoke direct reads; 3) Make RPC SECURITY DEFINER; 4) Limit to EXECUTE on RPC

-- Enable RLS on synonyms table
ALTER TABLE public.search_synonyms ENABLE ROW LEVEL SECURITY;

-- Revoke any direct reads for anon/auth (RPC will access this under function owner)
REVOKE SELECT ON public.search_synonyms FROM anon, authenticated;

-- Ensure the RPC runs with definer privileges and safe search_path
ALTER FUNCTION public.search_products_en_km(text, integer, text) SECURITY DEFINER;
ALTER FUNCTION public.search_products_en_km(text, integer, text) SET search_path = public, pg_temp;

-- Allow clients to execute the RPC (no direct table access needed)
GRANT EXECUTE ON FUNCTION public.search_products_en_km(text, integer, text) TO anon, authenticated;
