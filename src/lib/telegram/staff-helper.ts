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
const BOT_TOKEN = (process.env.TELEGRAM_QUERIESBOT_TOKEN || process.env.TELEGRAM_QUERIES_BOT_TOKEN || '').trim()
const ADMIN_GROUP_ID = (process.env.ADMIN_GROUP_ID || '').trim()
const ADMIN_THREAD_ID = (process.env.ADMIN_THREAD_ID || '').trim()
const TEAM_GROUP_ID = (process.env.TEAM_GROUP_ID || '').trim()
const TEAM_THREAD_ID = (process.env.TEAM_THREAD_ID || '').trim()
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
  | 'order_confirmation' | 'stock' | 'price' | 'description' | 'recommendation' | 'math' | 'definition' | 'other' {
  const t = text.toLowerCase().trim()
  if (t.includes('order confirmation') || t.startsWith('add this to the order confirmation')) return 'order_confirmation'
  if (/(in stock|stock|available)/.test(t)) return 'stock'
  if (/(price|cost|how much)/.test(t)) return 'price'
  if (/(describe|description|details)/.test(t)) return 'description'
  if (/(cheapest|recommend|best|top|under \$|under \¥|under usd|under jpy)/.test(t)) return 'recommendation'
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
  }
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
  if (intent === 'stock' || intent === 'price' || intent === 'description' || intent === 'recommendation') {
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
    'When uncertain, ask a short clarifying question instead of hallucinating.',
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

function renderOrderConfirmation(fields: {
  name?: string; phone?: string; address?: string; items?: string[]; deliveryFee?: string; total?: string; deposit?: string; due?: string; notes?: string;
}) {
  const items = (fields.items && fields.items.length) ? fields.items.join('\n') : 'Item name x Qty = Price'
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
    '📌 Important Notes',
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
    total: get('total'),
    deposit: get('deposit'),
    due: get('amount due'),
    items: itemsBlock,
  }
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
    const fields = extractOrderFields(text)
    reply = renderOrderConfirmation(fields)
    await sendTelegramMessage({ chat_id: chatId, message_thread_id: threadId, text: reply })
    await pushMemoryAsync(chatId, threadId, 'assistant', '[order_confirmation_sent]')
    return { handled: true }
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

  if (intent === 'stock' || intent === 'price' || intent === 'description' || intent === 'recommendation') {
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
      const candidates = mapped.slice(0, 5)
      const lines = candidates.map((p, i) => `${i + 1}) ${p.name} — $${p.price.toFixed(2)} — Stock: ${p.stock_quantity}`)
      reply = `I found multiple matches. Please choose (1-${candidates.length}):\n${lines.join('\n')}\nData checked: ${nowJST()}`
      await sendTelegramMessage({ chat_id: chatId, message_thread_id: threadId, text: reply })
      await pushMemoryAsync(chatId, threadId, 'assistant', reply)
      return { handled: true }
    }

    const p = mapped[0]
    reply = `${p.name} | Price: $${p.price.toFixed(2)} | Stock: ${p.stock_quantity} | Link: ${productLink(siteBase, p.sku, p.id)}\nData checked: ${nowJST()}`
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

