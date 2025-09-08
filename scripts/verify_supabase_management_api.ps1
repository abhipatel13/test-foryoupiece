param([string]$Pat)
$ErrorActionPreference = 'Stop'

$project = 'xhfmyghtcugcocchzgja'
$pat = if ($env:SUPABASE_PAT) { $env:SUPABASE_PAT } elseif ($Pat) { $Pat } else { $null }
if (-not $pat) { Write-Error 'Missing PAT. Set SUPABASE_PAT env var or pass -Pat <token>.' }
$endpoint = "https://api.supabase.com/v1/projects/$project/database/query"

function Run-Sql {
  param([Parameter(Mandatory=$true)][string]$Sql)
  $headers = @{ Authorization = "Bearer $pat" }
  $body = @{ query = $Sql } | ConvertTo-Json -Compress
  try {
    $resp = Invoke-RestMethod -Method Post -Uri $endpoint -Headers $headers -ContentType 'application/json' -Body $body
    $resp | ConvertTo-Json -Depth 10
  } catch {
    $msg = $_.Exception.Message
    $detail = $null
    if ($_.ErrorDetails) { $detail = $_.ErrorDetails.Message }
    [PSCustomObject]@{ ok=$false; error=$msg; detail=$detail } | ConvertTo-Json -Depth 5
  }
}

$q1 = @'
SELECT EXISTS (
  SELECT 1 FROM information_schema.tables
  WHERE table_schema='public' AND table_name='telegram_thread_memory'
) AS exists;
'@

$q2 = @'
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema='public' AND table_name='telegram_thread_memory'
ORDER BY ordinal_position;
'@

$q3 = @'
SELECT indexname, indexdef
FROM pg_indexes
WHERE schemaname='public' AND tablename='telegram_thread_memory';
'@

$q4 = @'
SELECT conname, contype, pg_get_constraintdef(c.oid) AS definition
FROM pg_constraint c
JOIN pg_class t ON c.conrelid = t.oid
JOIN pg_namespace n ON n.oid = t.relnamespace
WHERE n.nspname='public' AND t.relname='telegram_thread_memory';
'@

$q5 = @'
SELECT c.relrowsecurity AS rls_enabled, c.relforcerowsecurity AS rls_forced
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname='public' AND c.relname='telegram_thread_memory';
'@

$q6 = @'
SELECT polname, polpermissive, polcmd, polroles::regrole[] AS roles,
       pg_get_expr(polqual, polrelid) AS using_expr,
       pg_get_expr(polwithcheck, polrelid) AS check_expr
FROM pg_policy p
JOIN pg_class c ON p.polrelid = c.oid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname='public' AND c.relname='telegram_thread_memory';
'@

$q7 = @'
SELECT grantee, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema='public' AND table_name='telegram_thread_memory'
ORDER BY grantee, privilege_type;
'@

$q8 = @'
SELECT thread_key,
       (thread_key ~ '^-?[0-9]+:[0-9]+$') AS key_matches_pattern,
       jsonb_typeof(turns) AS turns_type,
       CASE WHEN jsonb_typeof(turns)='array' THEN jsonb_array_length(turns) END AS turns_len,
       updated_at
FROM public.telegram_thread_memory
ORDER BY updated_at DESC NULLS LAST
LIMIT 5;
'@

Write-Host '--- 1) Table exists ---'
Run-Sql $q1
Write-Host '--- 1b) Columns ---'
Run-Sql $q2
Write-Host '--- 2) Indexes ---'
Run-Sql $q3
Write-Host '--- 2b) Constraints ---'
Run-Sql $q4
Write-Host '--- 3) RLS flags ---'
Run-Sql $q5
Write-Host '--- 3b) RLS policies ---'
Run-Sql $q6
Write-Host '--- 4) Role grants ---'
Run-Sql $q7
Write-Host '--- 5) Sample rows ---'
Run-Sql $q8

