/*
  OpenRouter minimal client wrapper
  - No secrets logged
  - Uses env OPENROUTER_API_KEY and OPENROUTER_MODEL_ID
*/

export type LLMMessage = { role: 'system' | 'user' | 'assistant'; content: string };

export interface LLMResponse {
  success: boolean;
  text?: string;
  error?: string;
}

const OPENROUTER_ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';

function redact(s?: string) {
  if (!s) return '';
  return s.slice(0, 6) + '…redacted';
}

export async function callOpenRouter(
  messages: LLMMessage[],
  opts?: { max_tokens?: number; temperature?: number }
): Promise<LLMResponse> {
  try {
    const apiKey = process.env.OPENROUTER_API_KEY;
    const modelId = process.env.OPENROUTER_MODEL_ID || 'anthropic/claude-sonnet-4';

    if (!apiKey) return { success: false, error: 'OPENROUTER_API_KEY not set' };

    // Limit prompt size conservatively to ~100k tokens equivalent by truncating input
    // We apply a simple character cap as a guard (tokens ~= chars/3)
    const MAX_CHARS = 250_000; // ~ < 100k tokens
    const trimmedMessages = trimMessagesByChars(messages, MAX_CHARS);

    const resp = await fetch(OPENROUTER_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: modelId,
        messages: trimmedMessages,
        temperature: opts?.temperature ?? 0.2,
        max_tokens: Math.min(opts?.max_tokens ?? 800, 4000),
      }),
    });

    if (!resp.ok) {
      const text = await safeText(resp);
      console.error('OpenRouter error', { status: resp.status, text: text?.slice(0, 400) });
      return { success: false, error: `OpenRouter HTTP ${resp.status}` };
    }

    const data: any = await resp.json();
    const out = data?.choices?.[0]?.message?.content as string | undefined;
    if (!out) return { success: false, error: 'No completion' };
    return { success: true, text: out };
  } catch (e: any) {
    console.error('OpenRouter call failed', { message: e?.message });
    return { success: false, error: e?.message || 'OpenRouter error' };
  }
}

function trimMessagesByChars(messages: LLMMessage[], maxChars: number): LLMMessage[] {
  const cloned = messages.map(m => ({ ...m }));
  let total = cloned.reduce((acc, m) => acc + m.content.length, 0);
  if (total <= maxChars) return cloned;

  // Trim from earliest user/assistant turns first, keep system
  for (let i = 0; i < cloned.length && total > maxChars; i++) {
    if (cloned[i].role === 'system') continue;
    const excess = total - maxChars;
    const cut = Math.min(excess, Math.floor(cloned[i].content.length * 0.5));
    if (cut > 0) {
      cloned[i].content = cloned[i].content.slice(-1 * (cloned[i].content.length - cut));
      total = cloned.reduce((acc, m) => acc + m.content.length, 0);
    }
  }
  return cloned;
}

async function safeText(resp: Response) {
  try { return await resp.text(); } catch { return ''; }
}

