/*
  Staff Helper bot core logic (no external deps)
  - Restricts handling to two group threads
  - Catalog Q&A via internal APIs
  - Order Confirmation template fill
  - Lightweight per-thread rolling memory (ephemeral)
*/

import { callOpenRouter, type LLMMessage } from '@/lib/llm/openrouter'
import { createServiceRoleClient } from '@/lib/supabase/service-role'

// --- Config ---
// Bot token precedence (accept multiple env names to avoid misconfiguration):
// 1) TELEGRAM_STAFF_HELPER_BOT_TOKEN (preferred)
// 2) TELEGRAM_QUERIESBOT_TOKEN / TELEGRAM_QUERIES_BOT_TOKEN (legacy)
// 3) TELEGRAM_BOT_TOKEN (fallback if a single bot is used)
const BOT_TOKEN = (
  process.env.TELEGRAM_STAFF_HELPER_BOT_TOKEN ||
  process.env.TELEGRAM_QUERIESBOT_TOKEN ||
  process.env.TELEGRAM_QUERIES_BOT_TOKEN ||
  process.env.TELEGRAM_BOT_TOKEN ||
  ''
).trim()

// Allowed threads (support STAFF_HELPER_* overrides). Thread IDs default to 1519/1521 per spec.
const ADMIN_GROUP_ID = (
  process.env.STAFF_HELPER_ADMIN_GROUP_ID ||
  process.env.ADMIN_GROUP_ID ||
  ''
).trim()
const ADMIN_THREAD_ID = (
  process.env.STAFF_HELPER_ADMIN_THREAD_ID ||
  process.env.ADMIN_THREAD_ID ||
  '1519'
).trim()
const TEAM_GROUP_ID = (
  process.env.STAFF_HELPER_TEAM_GROUP_ID ||
  process.env.TEAM_GROUP_ID ||
  ''
).trim()
const TEAM_THREAD_ID = (
  process.env.STAFF_HELPER_TEAM_THREAD_ID ||
  process.env.TEAM_THREAD_ID ||
  '1521'
).trim()

const WEBHOOK_SECRET = (process.env.TELEGRAM_WEBHOOK_SECRET || 'foryoupiece-webhook-secret').trim()
const OPENROUTER_ENABLED = !!process.env.OPENROUTER_API_KEY

// Catalog base: allow override; otherwise derive per-request from host
const CATALOG_API_BASE = process.env.CATALOG_API_BASE // e.g., https://your.site

const TELEGRAM_API = 'https://api.telegram.org/bot'

// --- Memory (ephemeral, per runtime) ---
// Map key: `${chat_id}:${thread_id}` => turns with TTL 5 minutes
interface Turn { role: 'user' | 'assistant'; text: string; at: number }
const memory = new Map<string, Turn[]>()
const MEMORY_TTL_MS = 5 * 60 * 1000
const MEMORY_MAX_TURNS = 10
// --- Persistent memory (Supabase, service role) ---
const HAS_SERVICE_ROLE = !!process.env.SUPABASE_SERVICE_ROLE_KEY
const MEM_TABLE = 'telegram_thread_memory'

async function getServiceClientSafely() {
  try { return createServiceRoleClient() as any } catch { return null }
}

async function loadPersistedTurns(threadKey: string): Promise<Turn[]> {
  if (!HAS_SERVICE_ROLE) return []
  const client = await getServiceClientSafely()
  if (!client) return []
  try {
    const { data, error } = await client
      .from(MEM_TABLE)
      .select('turns, updated_at')
      .eq('thread_key', threadKey)
      .single()
    if (error || !data) return []
    const updatedAt = new Date(data.updated_at).getTime()
    if (Date.now() - updatedAt > MEMORY_TTL_MS) return []
    const arr = Array.isArray(data.turns) ? data.turns as Turn[] : []
    const fresh = arr.filter(t => typeof t?.at === 'number' && (Date.now() - t.at) < MEMORY_TTL_MS)
    return fresh.slice(-MEMORY_MAX_TURNS)
  } catch { return [] }
}

async function savePersistedTurn(threadKey: string, turn: Turn): Promise<void> {
  if (!HAS_SERVICE_ROLE) return
  const client = await getServiceClientSafely()
  if (!client) return
  try {
    const existing = await loadPersistedTurns(threadKey)
    const next = [...existing, turn].slice(-MEMORY_MAX_TURNS)
    const { error } = await client
      .from(MEM_TABLE)
      .upsert({ thread_key: threadKey, turns: next, updated_at: new Date().toISOString() }, { onConflict: 'thread_key' })
    if (error) { /* swallow to avoid impacting bot flow */ }
  } catch { /* ignore */ }
}

async function pushMemoryAsync(chatId: number, threadId: number | undefined, role: 'user' | 'assistant', text: string) {
  // always keep in-memory as fallback
  pushMemory(chatId, threadId, role, text)
  const key = keyFor(chatId, threadId)
  await savePersistedTurn(key, { role, text, at: Date.now() })
}

async function getMemoryAsync(chatId: number, threadId?: number): Promise<Turn[]> {
  const key = keyFor(chatId, threadId)
  const persisted = await loadPersistedTurns(key)
  if (persisted.length) return persisted
  return getMemory(chatId, threadId)
}


function keyFor(chatId: number | string, threadId?: number | string) {
  return `${chatId}:${threadId || ''}`
}

function pushMemory(chatId: number, threadId: number | undefined, role: 'user' | 'assistant', text: string) {
  const key = keyFor(chatId, threadId)
  const turns = (memory.get(key) || []).filter(t => Date.now() - t.at < MEMORY_TTL_MS)
  turns.push({ role, text, at: Date.now() })
  // Trim to last N
  const trimmed = turns.slice(-MEMORY_MAX_TURNS)
  memory.set(key, trimmed)
}

function getMemory(chatId: number, threadId?: number) {
  const key = keyFor(chatId, threadId)
  const turns = (memory.get(key) || []).filter(t => Date.now() - t.at < MEMORY_TTL_MS)
  memory.set(key, turns)
  return turns
}

// --- Telegram helpers ---
export function validateWebhook(headers: Headers, bodyText: string) {
  const token = (headers.get('x-telegram-bot-api-secret-token') || '').trim()
  const isProd = process.env.NODE_ENV === 'production'
  const devAlt = process.env.DEV_TELEGRAM_WEBHOOK_SECRET || 'foryoupiece-secure-webhook-2025'
  const ok = (!WEBHOOK_SECRET) || token === WEBHOOK_SECRET || (!isProd && token === devAlt)
  if (!ok) {
    try {
      console.error('[StaffHelper] webhook unauthorized', {
        providedLen: String(token || '').length,
        expectedLen: String(WEBHOOK_SECRET || '').length,
        envHasSecret: Boolean(WEBHOOK_SECRET),
      })
    } catch {}
  }
  return ok
}

export async function sendTelegramMessage(params: {
  chat_id: number | string,
  message_thread_id?: number,
  text: string,
  parse_mode?: 'HTML' | 'Markdown' | 'MarkdownV2'
}) {
  if (!BOT_TOKEN) {
    console.error('[StaffHelper] sendTelegramMessage: missing BOT_TOKEN')
    return { ok: false, error: 'No bot token' }
  }
  const url = `${TELEGRAM_API}${BOT_TOKEN}/sendMessage`
  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params)
    })
    if (!resp.ok) {
      const txt = await resp.text().catch(() => '')
      console.error('[StaffHelper] Telegram send failed', { status: resp.status, detail: txt?.slice(0, 200) })
      return { ok: false, error: `HTTP ${resp.status}`, detail: txt.slice(0, 200) }
    }
    return { ok: true }
  } catch (e: any) {
    console.error('[StaffHelper] Telegram send error', { message: e?.message })
    return { ok: false, error: e?.message || 'fetch error' }
  }
}

// --- Intent classification ---
function classifyIntent(text: string):
  | 'greeting' | 'order_confirmation' | 'stock' | 'price' | 'description' | 'recommendation' | 'product_search' | 'math' | 'definition' | 'other' {
  const t = text.toLowerCase().trim()

  // Greetings
  if (/(^|\b)(hi|hello|hey|yo|good\s+morning|good\s+afternoon|good\s+evening)(\b|!|\.)/.test(t)) return 'greeting'

  // Order confirmation: explicit phrasing or presence of multiple structured fields
  if (t.includes('order confirmation') || (t.includes('order') && t.includes('confirmation'))) return 'order_confirmation'
  const fieldPatterns = [
    /name\s*:/i,
    /(phone|phone number|tel)\s*:/i,
    /address\s*:/i,
    /(items?|order details?)\s*:/i,
    /(delivery fee|total|amount due|deposit)\s*:/i,
  ]
  const fieldCount = fieldPatterns.reduce((c, r) => c + (r.test(text) ? 1 : 0), 0)
  if (fieldCount >= 2) return 'order_confirmation'

  if (/(in stock|stock|available)/.test(t)) return 'stock'
  if (/(price|cost|how much)/.test(t)) return 'price'
  if (/(describe|description|details)/.test(t)) return 'description'
  if (/(cheapest|recommend|best|top|under \$|under \¥|under usd|under jpy)/.test(t)) return 'recommendation'

  // Generic product search heuristic: short textual queries (1–4 words) or brand/category hints
  const wordCount = t.split(/\s+/).filter(Boolean).length
  const looksLikeProduct = /\b(refill|shampoo|conditioner|lotion|serum|mask|cream|oil|toner|kabi|yolu|honey|botanist|tsubaki|melano|nivea|naturie|curel|senka|shiseido|kose|orbis|kao|dove)\b/i.test(text)
    || (wordCount <= 4 && /[a-z]/i.test(text) && !/[?!.]/.test(text))
  if (looksLikeProduct) return 'product_search'

  if (/^[\d\s\.+\-*/()%x=]+$/.test(t)) return 'math'
  if (/what is|define|meaning of/.test(t)) return 'definition'
  return 'other'
}

// --- Catalog helpers ---
async function catalogSearch(baseUrl: string, q: string, limit = 20) {
  const url = new URL('/api/search', baseUrl)
  url.searchParams.set('q', q)
  url.searchParams.set('limit', String(limit))
  const resp = await fetch(url.toString(), { method: 'GET' })
  if (!resp.ok) return { products: [] as any[] }
  const json = await resp.json().catch(() => ({}))
  return { products: json?.data?.products || [] }
}

function pickFields(p: any) {
  return {
    id: p.id,
    name: p.name_en,
    price: Number(p.price ?? 0),
    compare_at_price: Number(p.compare_at_price ?? 0),
    stock_quantity: Number(p.stock_quantity ?? 0),
    sku: p.sku,
    images: p.images,
    brand: p.brand,
    tags: p.tags,
    category: p.category?.name_en,
    category_slug: p.category?.slug,
    description: (p.short_description_en || p.description_en || '').slice(0, 140)
  }
}

// Enhanced search that can also fetch suggestions
async function searchApi(baseUrl: string, q: string, opts?: { limit?: number, includeSuggestions?: boolean, category?: string }) {
  const url = new URL('/api/search', baseUrl)
  url.searchParams.set('q', q)
  url.searchParams.set('limit', String(opts?.limit ?? 20))
  if (opts?.includeSuggestions) url.searchParams.set('include_suggestions', 'true')
  if (opts?.category) url.searchParams.set('category', opts.category)
  const resp = await fetch(url.toString(), { method: 'GET' })
  if (!resp.ok) return { products: [] as any[], suggestions: [] as any[] }
  const json: any = await resp.json().catch(() => ({}))
  return {
    products: (json?.data?.products || []) as any[],
    suggestions: (json?.data?.suggestions || []) as any[]
  }
}

function dedupeByIdSku(items: any[]) {
  const seen = new Set<string>()
  const out: any[] = []
  for (const p of items) {
    const key = String(p.id || '') + '|' + String(p.sku || '')
    if (seen.has(key)) continue
    seen.add(key)
    out.push(p)
  }
  return out
}
// --- Lightweight relevance scoring / re-ranking ---
function buildQueryTokens(q: string) {
  const norm = q.toLowerCase()
    .replace(/\bbotonist\b/g, 'botanist')
    .replace(/sham+poo/g, 'shampoo')
    .replace(/condit+ioner/g, 'conditioner')
  return norm.split(/[^a-z0-9]+/).filter(Boolean).slice(0, 8)
}

const BRAND_PRIORITY = ['botanist','tsubaki','shiseido','senka','nivea','curel','melano','kose','kosé','naturie','orbis','kao','dove']

function relevanceScore(p: any, q: string, catHint?: string) {
  const hay = `${String(p.name||'')} ${String(p.brand||'')} ${(p.tags||[]).join(' ')} ${String(p.category||'')}`.toLowerCase()
  const toks = buildQueryTokens(q)
  let score = 0
  for (const t of toks) {
    if (hay.includes(t)) score += 2
  }
  // brand boost
  const hayBrand = hay
  for (const b of BRAND_PRIORITY) {
    if (hayBrand.includes(b)) score += 1
  }
  // category alignment boost / penalty
  if (catHint && p.category_slug === catHint) score += 3
  if (catHint === 'skincare') {
    const badCats = new Set(['home','food-beverage'])
    if (badCats.has(String(p.category_slug||''))) score -= 4
  }
  // slight discount boost if compare_at_price > price
  if (Number(p.compare_at_price) > Number(p.price)) score += 1
  return score
}


function detectCategorySlug(text: string): string | undefined {
  const t = text.toLowerCase()
  // quick fuzzy hints
  if (/(sham|condit)/.test(t)) return 'hair'

  const pairs: Array<[string[], string]> = [
    [["dry skin","moisturizer","serum","mask","acne","cleanser","toner","cream","moist","hydrate"], 'skincare'],
    [["hair","shampoo","conditioner","treatment","mask","oil"], 'hair'],
    [["body wash","soap","deodorant","body","lotion"], 'bath-body'],
    [["mouth","oral","tooth","dental","mouthwash","toothpaste"], 'health-personal-care'],
    [["makeup","lip","mascara","foundation","concealer","blush","eyeliner"], 'makeup'],
    [["home","cleaner","mold","kitchen","bathroom"], 'home']
  ]
  for (const [keys, slug] of pairs) {
    if (keys.some(k => t.includes(k))) return slug
  }
  return undefined
}

async function fetchRecommendations(baseUrl: string, opts?: { categorySlug?: string, limit?: number }) {
  const url = new URL('/api/recommendations', baseUrl)
  url.searchParams.set('limit', String(opts?.limit ?? 3))
  url.searchParams.set('in_stock_only', 'true')
  url.searchParams.set('diversify', 'true')
  url.searchParams.set('include_discounts', 'true')
  if (opts?.categorySlug) url.searchParams.set('category_slug', opts.categorySlug)
  const resp = await fetch(url.toString(), { method: 'GET' })
  if (!resp.ok) return [] as any[]
  const json: any = await resp.json().catch(() => ({}))
  return (json?.data || []) as any[]
}

async function fuzzyCollectCandidates(baseUrl: string, q: string) {
  // 1) primary search
  const primary = await searchApi(baseUrl, q, { limit: 50 })
  let products = primary.products
  if (products?.length) return dedupeByIdSku(products)

  // 2) suggestions-assisted retries
  const withSug = await searchApi(baseUrl, q, { limit: 10, includeSuggestions: true })
  const suggestionTexts = (withSug.suggestions || []).map((s: any) => String(s.suggestion_text || '')).filter(Boolean)
  for (const s of suggestionTexts.slice(0, 5)) {
    const r = await searchApi(baseUrl, s, { limit: 30 })
    products = [...products, ...(r.products || [])]
    if (products.length >= 3) break
  }
  if (products.length) return dedupeByIdSku(products)

  // 3) token partials (simple fuzzy fallback)
  const tokens = q.split(/\s+/).filter(w => w.length >= 3).slice(0, 4)
  for (const t of tokens) {
    const r = await searchApi(baseUrl, t, { limit: 20 })
    products = [...products, ...(r.products || [])]
    if (products.length >= 3) break
  }
  return dedupeByIdSku(products)
}

function formatProductLine(p: any, base: string) {
  const price = `$${Number(p.price || 0).toFixed(2)}`
  const was = (p.compare_at_price && p.compare_at_price > p.price) ? ` (was $${Number(p.compare_at_price).toFixed(2)})` : ''
  const stock = `Stock: ${Number(p.stock_quantity || 0)}`
  const link = productLink(base, p.sku, p.id)
  const desc = p.description ? ` — ${p.description}` : ''
  return `• ${p.name} — ${price}${was} — ${stock} — ${link}${desc ? `\n   ${desc}` : ''}`
}

async function buildProactiveProductReply(baseUrl: string, userText: string): Promise<string | null> {
  const candidates = await fuzzyCollectCandidates(baseUrl, userText)
  const catHint = detectCategorySlug(userText)
  let mapped = candidates.map(pickFields)

  if (catHint) {
    const kw = ['skin','face','serum','lotion','cream','moist','hydrate','mask','toner','cleanser','cleansing','face wash','hyaluronic','ceramide']
    const reg = new RegExp(kw.join('|'), 'i')
    mapped = mapped.filter(p => p.category_slug === catHint || (catHint === 'skincare' && reg.test(`${p.name} ${(p.tags||[]).join(' ')}`)))
    // Final guard for skincare to avoid off-topic cleaners
    if (catHint === 'skincare') {
      const strongReg = /(serum|lotion|cream|moist|hydrate|mask|toner|cleanser|cleansing|face wash)/i
      mapped = mapped.filter(p => p.category_slug === 'skincare' || strongReg.test(`${p.name} ${(p.tags||[]).join(' ')}`))
    }
  }

  if (mapped.length >= 1) {
    // Prefer in-stock first, then lower price
    const sorted = [...mapped].sort((a, b) => {
      const rb = relevanceScore(b, userText, catHint)
      const ra = relevanceScore(a, userText, catHint)
      if (rb !== ra) return rb - ra
      const aIn = Number(a.stock_quantity) > 0 ? 1 : 0
      const bIn = Number(b.stock_quantity) > 0 ? 1 : 0
      if (bIn !== aIn) return bIn - aIn
      return Number(a.price) - Number(b.price)
    })
    const top3 = sorted.slice(0, 3)
    const lines = top3.map(p => formatProductLine(p, baseUrl))
    const preface = mapped.length > 1
      ? `I found a few options — would any of these work?`
      : `Here’s a good match — would this work for you?`
    return `${preface}\n${lines.join('\n')}\nData checked: ${nowJST()}`
  }

  // Category-based fallback recommendations
  const cat = detectCategorySlug(userText)
  const recs = await fetchRecommendations(baseUrl, { categorySlug: cat, limit: 3 })
  if (recs?.length) {
    const lines = recs.slice(0, 3).map((p: any) => formatProductLine(pickFields(p), baseUrl))
    const pre = cat
      ? `I couldn’t find an exact match. I found these related ${cat.replace('-', ' ')} picks — does this help?`
      : `I couldn’t find an exact match. I found these related picks — does this help?`
    return `${pre}\n${lines.join('\n')}\nData checked: ${nowJST()}`
  }

  return null
}


// --- LLM helper (use OpenRouter for all intents when enabled) ---
async function buildLLMReply(params: {
  intent: string,
  text: string,
  chatId: number,
  threadId?: number,
  baseUrl: string,
}): Promise<string | null> {
  if (!OPENROUTER_ENABLED) return null
  const { intent, text, chatId, threadId, baseUrl } = params

  const mem = await getMemoryAsync(chatId, threadId)

  // For product-related intents, fetch compact product context (top 5)
  let productContext = ''
  if (intent === 'stock' || intent === 'price' || intent === 'description' || intent === 'recommendation' || intent === 'product_search') {
    try {
      const { products } = await catalogSearch(baseUrl, text, 20)
      const mapped = products.map(pickFields).slice(0, 5)
      if (mapped.length) {
        const items = mapped.map((p, i) => `${i + 1}) ${p.name} — $${p.price.toFixed(2)}${p.compare_at_price && p.compare_at_price > p.price ? ` (was $${p.compare_at_price.toFixed(2)})` : ''} — Stock: ${p.stock_quantity} — SKU: ${p.sku}`).join('\n')
        productContext = `\nProduct candidates (top ${mapped.length}):\n${items}`
      }
    } catch {}
  }

  const system = [
    'You are ForYouPiece Staff Helper Bot. Answer in concise, professional English.',
    'Follow business rules: No taxes. $1.50 fixed shipping; free shipping for 4+ items.',
    'If product context is provided, use it. Prefer in-stock items; mention savings if compare_at_price > price.',
    'When uncertain, do not ask clarifying questions. Propose up to 3 concrete product suggestions with price, stock, and direct links, using tentative phrasing like "Would this work for you?".',
  ].join(' ')

  const messages: LLMMessage[] = [
    { role: 'system', content: system + (productContext ? `\n${productContext}` : '') },
    ...mem.map(t => ({ role: t.role, content: t.text })) as LLMMessage[],
    { role: 'user', content: text },
  ]

  const llm = await callOpenRouter(messages, { max_tokens: 400 })
  if (!llm.success) return null
  const out = (llm.text || '').trim()
  return out ? out.slice(0, 1800) : null
}

function productLink(base: string, sku?: string, id?: string) {
  // Prefer SKU links if your product pages use it; else fallback by id
  if (sku) return `${base.replace(/\/$/, '')}/products/${encodeURIComponent(sku)}`
  if (id) return `${base.replace(/\/$/, '')}/products/id/${encodeURIComponent(id)}`
  return base
}

function nowJST() {
  const d = new Date()
  const utc = d.getTime() + d.getTimezoneOffset() * 60000
  const jst = new Date(utc + 9 * 3600000)
  const pad = (n: number) => (n < 10 ? '0' + n : '' + n)
  return `${jst.getFullYear()}-${pad(jst.getMonth() + 1)}-${pad(jst.getDate())} ${pad(jst.getHours())}:${pad(jst.getMinutes())} JST`
}

// --- Order Confirmation Template ---
const ORDER_TEMPLATE_HEADER = `🎀✨ ORDER CONFIRMATION ✨🎀`
/**
 * Render the Order Confirmation message in the exact required template.
 * - Falls back to default Important Notes block when not provided
 * - Leaves pricing placeholders as "$" if unknown
 */


function renderOrderConfirmation(fields: {
  name?: string; phone?: string; address?: string; items?: string[]; deliveryFee?: string; total?: string; deposit?: string; due?: string; notes?: string;
}) {
  const items = (fields.items && fields.items.length) ? fields.items.join('\n') : 'Item name x Qty = $Price'
  const notes = fields.notes || `🔒 Final Sale   : Orders are final and non-refundable. No cancellations, returns, or exchanges accepted.\n🚚 Delivery     : We will notify you once your items are ready for delivery.`
  return [
    `${ORDER_TEMPLATE_HEADER}`,
    '',
    '👤 Customer Info',
    `Name: ${fields.name || ''}`,
    `Phone number: ${fields.phone || ''}`,
    `Address: ${fields.address || ''}`,
    '',
    '🛒 Items',
    items,
    '',
    '💸 Pricing Summary',
    `• Delivery Fee: ${fields.deliveryFee || '$'}`,
    `• Total amount: ${fields.total || '$'}`,
    `• Deposit: ${fields.deposit || '$'}`,
    `• Amount Due: ${fields.due || '$'}`,
    '',
    '📌 Important Notes  ',
    notes,
    '',
    '🙏 Thank you for your purchase! 🤍'
  ].join('\n')
}

function extractOrderFields(text: string) {
  // Very lightweight extraction; if not found, leave blank
  const get = (label: string) => {
    const m = new RegExp(`${label}\s*:\s*(.+)`, 'i').exec(text)
    return m ? m[1].trim() : undefined
  }
  const itemsBlock = (() => {
    const idx = text.toLowerCase().indexOf('items')
    if (idx >= 0) {
      const tail = text.slice(idx)
      const lines = tail.split(/\r?\n/).slice(1, 10).map(l => l.trim()).filter(Boolean)
      if (lines.length) return lines
    }
    return undefined
  })()
  return {
    name: get('name'),
    phone: get('phone'),
    address: get('address'),
    deliveryFee: get('delivery fee'),
/**
 * Build the Order Confirmation using OpenRouter and thread memory, then
 * strictly enforce the exact template (items arithmetic, totals, notes).
 */

    total: get('total'),
    deposit: get('deposit'),
    due: get('amount due'),
    items: itemsBlock,
  }
}

// Use OpenRouter to fill the order confirmation template intelligently
async function buildOrderConfirmationAI(params: { text: string, chatId: number, threadId?: number }): Promise<string | null> {
  if (!OPENROUTER_ENABLED) return null
  const { text, chatId, threadId } = params
  const mem = await getMemoryAsync(chatId, threadId)

  const system = [
    'You are ForYouPiece Staff Helper Bot. Extract customer and order information from the user message and recent conversation.',
    'Use the EXACT emoji and formatting structure shown below. Do not add or omit any characters. Preserve spacing and newlines exactly. Include two spaces after "📌 Important Notes" line.',
    'For each item, format strictly as: "Item name x Qty = $Price". Perform simple arithmetic on quantities if present (e.g., "16 x 3" -> 48). Do NOT invent prices. If unknown, leave the placeholder "$".',
    'Important Notes content MUST be exactly:',
    '🔒 Final Sale   : Orders are final and non-refundable. No cancellations, returns, or exchanges accepted. ',
    '🚚 Delivery     : We will notify you once your items are ready for delivery.',
    '' ,
    'Return ONLY the filled template, nothing else.',
    '',
    `${ORDER_TEMPLATE_HEADER}`,
    '',
    '👤 Customer Info',
    'Name: {name}',
    'Phone number: {phone}',
    'Address: {address}',
    '',
    '🛒 Items',
    '{items}',
    '',
    '💸 Pricing Summary',
    '• Delivery Fee: {deliveryFee}',
    '• Total amount: {total}',
    '• Deposit: {deposit}',
    '• Amount Due: {due}',
    '',
    '📌 Important Notes  ',
    '{notes}',
    '',
    '🙏 Thank you for your purchase! 🤍',
  ].join('\n')

  const user = [
    'Fill the template using data from the following message. Leave placeholders for unknown values. Items should be one per line when possible.',
    'User message:',
    text,
/**
 * Post-process AI output to enforce exact order confirmation template.
 * - Ensures two spaces after "📌 Important Notes"
 * - Normalizes items as "Name x Qty = $Price" computing arithmetic
 * - Prefers original Delivery Fee/Deposit from the user's text for accuracy
 * - Computes Total and Amount Due when possible
 */

  ].join('\n')

  const messages: LLMMessage[] = [
    { role: 'system', content: system },
    ...mem.map(t => ({ role: t.role, content: t.text })) as LLMMessage[],
    { role: 'user', content: user },
  ]

  const llm = await callOpenRouter(messages, { max_tokens: 700 })
  if (!llm.success) return null
  const out = (llm.text || '').trim()
  const fixed = enforceOrderTemplate(out, text)
  return fixed ? fixed.slice(0, 1800) : null
}


// Post-process AI output to strictly enforce required formatting and compute simple totals
function enforceOrderTemplate(aiOut: string, originalText: string): string {
  let out = aiOut

  // Ensure exact header for Important Notes (two spaces at end)
  out = out.replace(/^📌 Important Notes\s*$/m, '📌 Important Notes  ')

  // Extract items from originalText if pattern `{name} {unit} x {qty}` exists
  const itemMatches: Array<{ name: string; unit: number; qty: number }> = []
  const re = /(.*?)(\d+(?:\.\d{1,2})?)\s*x\s*(\d+)/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(originalText)) !== null) {
    const rawName = m[1].trim().replace(/^items?\s*[:\-]?\s*/i, '').replace(/[,:]$/,'').trim()
    const unit = parseFloat(m[2])
    const qty = parseInt(m[3], 10)
    if (rawName && isFinite(unit) && isFinite(qty) && qty > 0) {
      // Heuristic: if name ends with the unit number (e.g., "Kabi Killer 16"), strip trailing unit from name
      const name = rawName.replace(new RegExp(`\\b${unit.toString().replace('.', '\\.')}$`), '').trim()
      itemMatches.push({ name: name || rawName, unit, qty })
    }
  }

  // If we found computable items, replace Items block with normalized lines
  if (itemMatches.length) {
    const itemLines = itemMatches.map(it => `${it.name} x ${it.qty} = $${(it.unit * it.qty).toFixed(2)}`)
    out = out.replace(/(\n🛒 Items\n)([\s\S]*?)(\n\n|\n💸 Pricing Summary)/, (_all, p1, _mid, p3) => `${p1}${itemLines.join('\n')}${p3}`)

    // Compute totals if fee/deposit present
    const itemsTotal = itemMatches.reduce((s, it) => s + it.unit * it.qty, 0)
    // Delivery fee: prefer original text; fallback to AI output
    const feeFromOrig = originalText.match(/delivery\s*fee\s*:\s*\$?(\d+(?:\.\d{1,2})?)/i)
    const feeFromOut = out.match(/•\s*Delivery Fee:\s*\$?(\d+(?:\.\d{1,2})?)/)
    const fee = feeFromOrig ? parseFloat(feeFromOrig[1]) : (feeFromOut ? parseFloat(feeFromOut[1]) : undefined)
    if (typeof fee === 'number' && isFinite(fee)) {
      const total = (itemsTotal + fee)
      out = out.replace(/•\s*Total amount:\s*\$.*/ , `• Total amount: $${total.toFixed(2)}`)
      // Also normalize the Delivery Fee line to the parsed value
      out = out.replace(/•\s*Delivery Fee:\s*\$.*/, `• Delivery Fee: $${fee.toFixed(2)}`)
    }
    // Deposit → Amount Due (prefer original)
    const depFromOrig = originalText.match(/deposit\s*:\s*\$?(\d+(?:\.\d{1,2})?)/i)
    const depFromOut = out.match(/•\s*Deposit:\s*\$?(\d+(?:\.\d{1,2})?)/)
    const dep = depFromOrig ? parseFloat(depFromOrig[1]) : (depFromOut ? parseFloat(depFromOut[1]) : undefined)
    const totalLine = out.match(/•\s*Total amount:\s*\$(\d+(?:\.\d{1,2})?)/)
    const totalVal = totalLine ? parseFloat(totalLine[1]) : undefined
    if (typeof dep === 'number' && isFinite(dep)) {
      out = out.replace(/•\s*Deposit:\s*\$.*/, `• Deposit: $${dep.toFixed(2)}`)
    }
    if (typeof dep === 'number' && isFinite(dep) && typeof totalVal === 'number' && isFinite(totalVal)) {
      const due = Math.max(0, totalVal - dep)
      out = out.replace(/•\s*Amount Due:\s*\$.*/, `• Amount Due: $${due.toFixed(2)}`)
    }

  } else {
    // Even if AI left items blank, still enforce the exact placeholder form
    out = out.replace(/(\n🛒 Items\n)([\s\S]*?)(\n\n|\n💸 Pricing Summary)/, (_all, p1, _mid, p3) => `${p1}Item name x Qty = $Price${p3}`)
  }

  // Enforce exact Important Notes content
  const notesFixed = `🔒 Final Sale   : Orders are final and non-refundable. No cancellations, returns, or exchanges accepted. \n🚚 Delivery     : We will notify you once your items are ready for delivery.`
  out = out.replace(/(\n📌 Important Notes\s{2}\n)([\s\S]*?)(\n\n|$)/, (_all, p1, _mid, p3) => `${p1}${notesFixed}${p3}`)

  return out
}


// --- Core handler ---

export async function handleStaffHelperUpdate(args: {
  body: any,
  requestUrl: string,
}): Promise<{ handled: boolean; reason?: string }> {
  if (!BOT_TOKEN) return { handled: false, reason: 'BOT_TOKEN missing' }

  const update = args.body
  const message = update?.message || update?.edited_message
  const chat = message?.chat
  const text: string | undefined = message?.text || message?.caption
  const threadId: number | undefined = message?.message_thread_id
  const chatId: number | undefined = chat?.id
  const isGroup = chat?.type === 'supergroup' || chat?.type === 'group'

  // Strict scope: only two threads; ignore DMs and others
  if (!isGroup || !chatId || !threadId) return { handled: false, reason: 'Not a target group thread' }

  const allowed = (
    String(chatId) === ADMIN_GROUP_ID && String(threadId) === ADMIN_THREAD_ID
  ) || (
    String(chatId) === TEAM_GROUP_ID && String(threadId) === TEAM_THREAD_ID
  )
  if (!allowed) {
    try {
      console.error('[StaffHelper] not allowed thread', {
        chatId: String(chatId), threadId: String(threadId),
        ADMIN_GROUP_ID, ADMIN_THREAD_ID, TEAM_GROUP_ID, TEAM_THREAD_ID
      })
    } catch {}
    return { handled: false, reason: 'Not in allowed thread' }
  }

  if (!text || !text.trim()) return { handled: true }

  // Derive base for catalog API and site links from request URL when not provided
  const baseUrl = CATALOG_API_BASE || (new URL(args.requestUrl).origin)
  const siteBase = baseUrl

  // Classify
  const intent = classifyIntent(text)

  // Memory (user turn)
  await pushMemoryAsync(chatId, threadId, 'user', text)

  let reply = ''

  if (intent === 'order_confirmation') {
    // Try AI formatter first; fall back to heuristic template
    let oc = await buildOrderConfirmationAI({ text, chatId, threadId })
    if (!oc) {
      const fields = extractOrderFields(text)
      oc = renderOrderConfirmation(fields)
    }
    reply = oc
    try { console.log('[StaffHelper][OrderConfirmation] reply:\n' + String(reply).slice(0, 1200)) } catch {}
    await sendTelegramMessage({ chat_id: chatId, message_thread_id: threadId, text: reply })
    await pushMemoryAsync(chatId, threadId, 'assistant', '[order_confirmation_sent]')
    return { handled: true }
  }


  // Friendly greeting handling
  if (intent === 'greeting') {
    reply = 'Hi! What would you like to know?'
    await sendTelegramMessage({ chat_id: chatId, message_thread_id: threadId, text: reply })
    await pushMemoryAsync(chatId, threadId, 'assistant', reply)
    return { handled: true }
  }

  // Proactive product suggestions only for product-related intents (before LLM)
  if (intent === 'stock' || intent === 'price' || intent === 'description' || intent === 'recommendation' || intent === 'product_search') {
    try {
      const proactive = await buildProactiveProductReply(baseUrl, text)
      if (proactive) {
        await sendTelegramMessage({ chat_id: chatId, message_thread_id: threadId, text: proactive })
        await pushMemoryAsync(chatId, threadId, 'assistant', proactive)
        return { handled: true }
      }
    } catch (e: any) {
      console.error('[StaffHelper] proactive suggestion path failed', { message: e?.message })
    }
  }

  // Use OpenRouter for intelligent responses for all other intents when enabled
  if (OPENROUTER_ENABLED) {
    try {
      const ai = await buildLLMReply({ intent, text, chatId, threadId, baseUrl })
      if (ai) {
        await sendTelegramMessage({ chat_id: chatId, message_thread_id: threadId, text: ai })
        await pushMemoryAsync(chatId, threadId, 'assistant', ai)
        return { handled: true }
      }
    } catch (e: any) {
      console.error('[StaffHelper] OpenRouter path failed; falling back', { message: e?.message })
    }
  }

  if (intent === 'stock' || intent === 'price' || intent === 'description' || intent === 'recommendation' || intent === 'product_search') {
    // Use search q as-is; handle ambiguity
    const { products } = await catalogSearch(baseUrl, text, 50)
    const mapped = products.map(pickFields)

    if (!mapped.length) {
      await sendTelegramMessage({ chat_id: chatId, message_thread_id: threadId, text: `I couldn’t find matching products. Try a clearer name or SKU.\nData checked: ${nowJST()}` })
      await pushMemoryAsync(chatId, threadId, 'assistant', 'no_matches')
      return { handled: true }
    }

    // For recommendation: sort by current price asc (consider discounts already in price)
    if (intent === 'recommendation') {
      const top = [...mapped]
        .sort((a, b) => a.price - b.price)
        .slice(0, 3)
      const lines = top.map(p => `• ${p.name} — $${p.price.toFixed(2)}${p.compare_at_price && p.compare_at_price > p.price ? ` (was $${p.compare_at_price.toFixed(2)})` : ''} — Stock: ${p.stock_quantity} — ${productLink(siteBase, p.sku, p.id)}`)
      reply = `Top picks:\n${lines.join('\n')}\nData checked: ${nowJST()}`
      await sendTelegramMessage({ chat_id: chatId, message_thread_id: threadId, text: reply })
      await pushMemoryAsync(chatId, threadId, 'assistant', reply)
      return { handled: true }
    }

    if (mapped.length > 1) {
      const catHint2 = detectCategorySlug(text)
      const sorted = [...mapped].sort((a, b) => {
        const rb = relevanceScore(b, text, catHint2)
        const ra = relevanceScore(a, text, catHint2)
        if (rb !== ra) return rb - ra
        const aIn = Number(a.stock_quantity) > 0 ? 1 : 0
        const bIn = Number(b.stock_quantity) > 0 ? 1 : 0
        if (bIn !== aIn) return bIn - aIn
        return Number(a.price) - Number(b.price)
      })
      const top = sorted.slice(0, 3)
      const lines = top.map(p => formatProductLine(p, siteBase))
      reply = `I found a few options — would any of these work?\n${lines.join('\n')}\nData checked: ${nowJST()}`
      await sendTelegramMessage({ chat_id: chatId, message_thread_id: threadId, text: reply })
      await pushMemoryAsync(chatId, threadId, 'assistant', reply)
      return { handled: true }
    }

    const p = mapped[0]
    const line = formatProductLine(p, siteBase)
    reply = `Here’s a good match — would this work for you?\n${line}\nData checked: ${nowJST()}`
    await sendTelegramMessage({ chat_id: chatId, message_thread_id: threadId, text: reply })
    await pushMemoryAsync(chatId, threadId, 'assistant', reply)
    return { handled: true }
  }

  if (intent === 'math') {
    try {
      // Evaluate basic arithmetic safely
      const sanitized = text.replace(/[^0-9+\-*/().%\s]/g, '')
      // eslint-disable-next-line no-new-func
      const result = Function(`return (${sanitized})`)()
      reply = `= ${result}`
      await sendTelegramMessage({ chat_id: chatId, message_thread_id: threadId, text: reply })
      await pushMemoryAsync(chatId, threadId, 'assistant', reply)
      return { handled: true }
    } catch {
      // fallback to LLM if enabled
    }
  }

  if (intent === 'definition' && OPENROUTER_ENABLED) {
    const mem = await getMemoryAsync(chatId, threadId)
    const messages: LLMMessage[] = [
      { role: 'system', content: 'You are a concise staff helper. Provide a one-line plain-language definition.' },
      ...mem.map(t => ({ role: t.role, content: t.text })) as LLMMessage[],
      { role: 'user', content: text }
    ]
    const llm = await callOpenRouter(messages, { max_tokens: 200 })
    reply = llm.success ? (llm.text || '').slice(0, 1500) : 'Sorry, I cannot answer that.'
    await sendTelegramMessage({ chat_id: chatId, message_thread_id: threadId, text: reply })
    await pushMemoryAsync(chatId, threadId, 'assistant', reply)
    return { handled: true }
  }

  // Out of scope or other
  reply = 'I can help with products, stock, pricing, descriptions, recommendations, the order confirmation, and basic math/logic. Please rephrase your request.'
  await sendTelegramMessage({ chat_id: chatId, message_thread_id: threadId, text: reply })
  await pushMemoryAsync(chatId, threadId, 'assistant', reply)
  return { handled: true }
}

