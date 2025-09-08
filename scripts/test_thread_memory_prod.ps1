$ErrorActionPreference = 'Stop'

# Load .env.local minimally (without exposing contents)
$envPath = Join-Path (Get-Location) '.env.local'
if (-not (Test-Path $envPath)) { throw ".env.local not found at $envPath" }

$dotenv = Get-Content $envPath | Where-Object { $_ -and ($_ -notmatch '^\s*#') }
function Get-EnvVal([string]$key) {
  $line = $dotenv | Where-Object { $_ -match "^$key\s*=\s*(.*)$" } | Select-Object -First 1
  if (-not $line) { return $null }
  $m = [regex]::Match($line, "^$key\s*=\s*(.*)$")
  $val = $m.Groups[1].Value.Trim()
  if ($val.StartsWith('"') -and $val.EndsWith('"')) { $val = $val.Substring(1, $val.Length-2) }
  return $val
}

$base = Get-EnvVal 'NEXT_PUBLIC_SUPABASE_URL'
$anon = Get-EnvVal 'NEXT_PUBLIC_SUPABASE_ANON_KEY'
$service = Get-EnvVal 'SUPABASE_SERVICE_ROLE_KEY'
if (-not $base -or -not $anon -or -not $service) { throw 'Missing Supabase envs in .env.local' }

$rest = "$base/rest/v1/telegram_thread_memory"

function Get-Anon([string]$qs='') {
  $headers = @{ apikey = $anon ; Authorization = "Bearer $anon" }
  Invoke-RestMethod -Method Get -Uri ($rest + $qs) -Headers $headers -ContentType 'application/json'
}
function Insert-Anon($body) {
  $headers = @{ apikey = $anon ; Authorization = "Bearer $anon" ; Prefer = 'return=minimal' }
  Invoke-RestMethod -Method Post -Uri $rest -Headers $headers -ContentType 'application/json' -Body ($body | ConvertTo-Json -Compress)
}
function Get-Service([string]$qs='') {
  $headers = @{ apikey = $service ; Authorization = "Bearer $service" }
  Invoke-RestMethod -Method Get -Uri ($rest + $qs) -Headers $headers -ContentType 'application/json'
}
function Upsert-Service($obj) {
  $headers = @{ apikey = $service ; Authorization = "Bearer $service" ; Prefer = 'resolution=merge-duplicates,return=representation' }
  Invoke-RestMethod -Method Post -Uri ($rest + '?on_conflict=thread_key') -Headers $headers -ContentType 'application/json' -Body ($obj | ConvertTo-Json -Compress)
}
function Delete-Service([string]$key) {
  $headers = @{ apikey = $service ; Authorization = "Bearer $service" }
  Invoke-RestMethod -Method Delete -Uri ($rest + "?thread_key=eq.$key") -Headers $headers -ContentType 'application/json'
}

# Test keys for isolation and validation
$adminKey = '-1002830509223:1519'
$teamKey  = '-1002830509223:1521'
$testBadKey = 'invalid_key'
$testKey = '999999999:999999999'
$testKey2 = '999999998:999999998'

Write-Host '1) AuthZ: anon blocked (SELECT should be empty, INSERT should be 401/403)'
try { $a = Get-Anon('?select=thread_key&limit=1'); $a | ConvertTo-Json -Depth 5 | Write-Output } catch { $_.Exception.Message | Write-Output }
try { Insert-Anon(@{ thread_key = $testKey; turns = @(); updated_at = (Get-Date).ToString('o') }) } catch { $_.Exception.Response.StatusCode.Value__ | Write-Output }

Write-Host '2) Service role CRUD and upsert behavior'
$now = (Get-Date).ToUniversalTime()
$resp1 = Upsert-Service(@{ thread_key = $testKey; turns = @(@{ role='user'; text='hello'; at=[int][double]::Parse((Get-Date -UFormat %s)) }); updated_at = $now.ToString('o') })
Start-Sleep -Milliseconds 800
$resp2 = Upsert-Service(@{ thread_key = $testKey; turns = @(@{ role='assistant'; text='hi'; at=[int][double]::Parse((Get-Date -UFormat %s)) }); updated_at = (Get-Date).ToUniversalTime().ToString('o') })
$sel = Get-Service("?select=thread_key,turns,updated_at&thread_key=eq.$testKey")
$sel | ConvertTo-Json -Depth 8 | Write-Output

Write-Host '3) Thread isolation with service role (distinct rows)'
$adm = Get-Service("?select=thread_key,turns&thread_key=eq.$adminKey")
$team = Get-Service("?select=thread_key,turns&thread_key=eq.$teamKey")
(@{ admin=$adm; team=$team } | ConvertTo-Json -Depth 6) | Write-Output

Write-Host '4) Malformed values (bad key, bad turns)'
# Insert bad key
$bad1ok = $true; try { Upsert-Service(@{ thread_key = $testBadKey; turns = @(); updated_at = (Get-Date).ToString('o') }) } catch { $bad1ok = $false }
# Insert bad turns (string)
$bad2ok = $true; try { Upsert-Service(@{ thread_key = $testKey2; turns = 'not-an-array'; updated_at = (Get-Date).ToString('o') }) } catch { $bad2ok = $false }
(@{ badKeyAccepted=$bad1ok; badTurnsAccepted=$bad2ok } | ConvertTo-Json) | Write-Output

Write-Host '5) TTL and max turns logic at application level (inspect last 10, timestamps)'
# Simulate 12 turns then read back (DB will accept >10, app trims to 10 on savePersistedTurn)
$turns = @(for ($i=1; $i -le 12; $i++) { @{ role = if ($i%2 -eq 0) { 'assistant' } else { 'user' }; text = "m$i"; at = [int][double]::Parse((Get-Date -UFormat %s)) } })
Upsert-Service(@{ thread_key = $testKey2; turns = $turns; updated_at = (Get-Date).ToUniversalTime().ToString('o') }) | Out-Null
$got = Get-Service("?select=thread_key,turns,updated_at&thread_key=eq.$testKey2")
$len = ($got.turns | Measure-Object).Count
(@{ persisted_count=$len; updated_at=$got.updated_at } | ConvertTo-Json) | Write-Output

Write-Host '6) Cleanup'
Delete-Service $testKey | Out-Null
Delete-Service $testKey2 | Out-Null
if ($testBadKey) { Delete-Service $testBadKey | Out-Null }

