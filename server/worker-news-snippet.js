/**
 * Cloudflare Worker — /news endpoint snippet
 *
 * HOW TO ADD TO YOUR EXISTING WORKER:
 *
 * 1. Open your Worker in Cloudflare Dashboard → Workers & Pages
 * 2. Add this route handler inside your fetch() function, BEFORE the final response
 * 3. Add secrets via: Dashboard → Worker → Settings → Variables → Add Secret
 *    - DISCORD_BOT_TOKEN  = your Discord bot token (Bot xxxxxxx)
 *    - DISCORD_CHANNEL_ID = the news channel ID (right-click channel → Copy ID)
 *
 * Discord bot requirements:
 *   - Permissions: "Read Messages" + "Read Message History" on the news channel
 *   - Intents: none needed (REST API only)
 */

// ─── Paste this block inside your worker's fetch() handler ───────────────────

if (url.pathname === '/news') {
  // Handle CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET',
        'Access-Control-Max-Age': '86400',
      },
    });
  }

  const CHANNEL_ID = env.DISCORD_CHANNEL_ID;
  const BOT_TOKEN  = env.DISCORD_BOT_TOKEN;

  if (!CHANNEL_ID || !BOT_TOKEN) {
    return jsonResponse({ error: 'News not configured' }, 503);
  }

  let messages;
  try {
    const discordRes = await fetch(
      `https://discord.com/api/v10/channels/${CHANNEL_ID}/messages?limit=5`,
      {
        headers: {
          Authorization: `Bot ${BOT_TOKEN}`,
          'User-Agent': 'CozyHouseLauncher/1.0',
        },
        cf: { cacheTtl: 120, cacheEverything: false },
      }
    );

    if (!discordRes.ok) {
      const err = await discordRes.text();
      console.error('[news] Discord API error:', discordRes.status, err);
      return jsonResponse({ error: 'Discord error' }, 502);
    }

    messages = await discordRes.json();
  } catch (e) {
    console.error('[news] fetch failed:', e);
    return jsonResponse({ error: 'Failed to fetch news' }, 500);
  }

  const news = messages
    .filter(m => m.content || m.embeds?.length > 0)
    .map(m => {
      const embed    = m.embeds?.[0];
      const hexColor = embed?.color != null
        ? '#' + embed.color.toString(16).padStart(6, '0')
        : null;

      // Use embed data if present, fall back to raw message text
      return {
        tag:       embed?.footer?.text || '#новости',
        title:     embed?.title        || m.author?.username || 'Новость',
        text:      embed?.description  || m.content?.slice(0, 120) || '',
        color:     hexColor,
        url:       embed?.url          || null,
        timestamp: m.timestamp,
      };
    });

  return jsonResponse(news);
}

// ─── Helper (add once if not already in your worker) ─────────────────────────

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
