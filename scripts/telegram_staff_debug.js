// Debug script for Telegram Staff Helper Bot
// Safe: read-only calls to Telegram API; prints no secrets

(async () => {
  try {
    const token = (process.env.TELEGRAM_STAFF_HELPER_BOT_TOKEN || process.env.TELEGRAM_QUERIESBOT_TOKEN || process.env.TELEGRAM_QUERIES_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN || '').trim();
    if (!token) {
      console.error('[telegram_staff_debug] Missing bot token in env');
      process.exitCode = 1;
      return;
    }
    const prefix = token.split(':')[0];

    async function safeGet(path) {
      const url = `https://api.telegram.org/bot${token}${path}`;
      const res = await fetch(url);
      const data = await res.json().catch(() => ({}));
      return data;
    }

    const getMe = await safeGet('/getMe');
    const webhookInfo = await safeGet('/getWebhookInfo');

    const summary = {
      tokenIdPrefix: prefix,
      getMe: getMe?.ok ? {
        ok: true,
        id: getMe.result.id,
        username: getMe.result.username,
        can_join_groups: getMe.result.can_join_groups,
        can_read_all_group_messages: getMe.result.can_read_all_group_messages
      } : { ok: false, error: getMe?.description || 'getMe failed' },
      webhook: webhookInfo?.ok ? {
        ok: true,
        url_set: Boolean(webhookInfo.result.url),
        url: webhookInfo.result.url,
        has_custom_secret: Boolean(webhookInfo.result.has_custom_certificate),
        pending_update_count: webhookInfo.result.pending_update_count,
        last_error_date: webhookInfo.result.last_error_date,
        last_error_message: webhookInfo.result.last_error_message
      } : { ok: false, error: webhookInfo?.description || 'getWebhookInfo failed' }
    };

    console.log(JSON.stringify({ ok: true, summary }, null, 2));
  } catch (e) {
    console.error('[telegram_staff_debug] error', e?.message || e);
    process.exitCode = 1;
  }
})();

