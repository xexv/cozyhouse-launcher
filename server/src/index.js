// Cloudflare Worker API for Cozy House Launcher & Server
// Features: Registration, PBKDF2 Authentication, Session Management, and Skin Updates.

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Handle CORS preflight requests
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
        },
      });
    }

    try {
      // Route 1: Register User
      if (url.pathname === "/api/register" && request.method === "POST") {
        const { username, password } = await request.json();
        if (!username || !password) {
          return errorResponse("Никнейм и пароль обязательны.", 400);
        }

        // Validate username formatting (alphanumeric and underscores, 3-16 chars)
        const usernameRegex = /^[a-zA-Z0-9_]{3,16}$/;
        if (!usernameRegex.test(username)) {
          return errorResponse("Неверный формат никнейма (3-16 символов, только латиница, цифры и _).", 400);
        }

        // Check if user already exists
        const existingUser = await env.DB.prepare(
          "SELECT id FROM users WHERE LOWER(username) = LOWER(?)"
        ).bind(username).first();

        if (existingUser) {
          return errorResponse("Пользователь с таким никнеймом уже зарегистрирован.", 409);
        }

        // Hash password using PBKDF2
        const salt = crypto.getRandomValues(new Uint8Array(16));
        const hash = await hashPassword(password, salt);
        const passwordHashString = `${toHex(salt)}:${toHex(hash)}`;

        // Generate custom UUID for Minecraft
        const uuid = crypto.randomUUID().replace(/-/g, ""); // strip hyphens

        const id = crypto.randomUUID();
        const now = Date.now();

        // Insert into D1 DB
        await env.DB.prepare(
          "INSERT INTO users (id, username, password_hash, uuid, balance_coins, created_at) VALUES (?, ?, ?, ?, 0, ?)"
        ).bind(id, username, passwordHashString, uuid, now).run();

        return jsonResponse({
          success: true,
          message: "Регистрация успешна!",
          user: { id, username, uuid }
        });
      }

      // Route 2: Login User
      if (url.pathname === "/api/login" && request.method === "POST") {
        const { username, password } = await request.json();
        if (!username || !password) {
          return errorResponse("Укажите логин и пароль.", 400);
        }

        // Fetch user from DB
        const user = await env.DB.prepare(
          "SELECT * FROM users WHERE LOWER(username) = LOWER(?)"
        ).bind(username).first();

        if (!user) {
          return errorResponse("Неверное имя пользователя или пароль.", 401);
        }

        // Verify password hash
        const [saltHex, hashHex] = user.password_hash.split(":");
        const salt = fromHex(saltHex);
        const expectedHash = fromHex(hashHex);
        const derivedHash = await hashPassword(password, salt);

        // Constant-time check
        if (!compareBuffers(derivedHash, expectedHash)) {
          return errorResponse("Неверное имя пользователя или пароль.", 401);
        }

        // Generate tokens
        const accessToken = crypto.randomUUID().replace(/-/g, "");
        const clientToken = crypto.randomUUID().replace(/-/g, "");
        const expiresAt = Date.now() + 30 * 24 * 60 * 60 * 1000; // 30 days active

        // Save session in DB
        await env.DB.prepare(
          "INSERT INTO sessions (access_token, user_id, client_token, expires_at) VALUES (?, ?, ?, ?)"
        ).bind(accessToken, user.id, clientToken, expiresAt).run();

        return jsonResponse({
          success: true,
          username: user.username,
          uuid: user.uuid,
          accessToken,
          clientToken,
          balance_coins: user.balance_coins,
          skin_url: user.skin_url,
        });
      }

      // Route 3: Validate Token
      if (url.pathname === "/api/validate" && request.method === "POST") {
        const { accessToken, clientToken } = await request.json();
        if (!accessToken) {
          return errorResponse("Токен обязателен.", 400);
        }

        const session = await env.DB.prepare(
          "SELECT expires_at FROM sessions WHERE access_token = ? AND client_token = ?"
        ).bind(accessToken, clientToken || "").first();

        if (!session || Date.now() > session.expires_at) {
          return errorResponse("Сессия недействительна или истекла.", 401);
        }

        return jsonResponse({ valid: true });
      }

      // Route 4: Logout (Revoke Session)
      if (url.pathname === "/api/logout" && request.method === "POST") {
        const { accessToken } = await request.json();
        if (accessToken) {
          await env.DB.prepare("DELETE FROM sessions WHERE access_token = ?").bind(accessToken).run();
        }
        return jsonResponse({ success: true });
      }

      // Route 5: Upload Skin
      if (url.pathname === "/api/skin/upload" && request.method === "POST") {
        // Simple mock / database URL save.
        // In a real R2 bucket setup, we would read request body as FormData / Binary
        // and upload the skin directly to R2 bucket storage.
        const { uuid, skinUrl } = await request.json();
        if (!uuid || !skinUrl) {
          return errorResponse("Параметры uuid и skinUrl обязательны.", 400);
        }

        await env.DB.prepare(
          "UPDATE users SET skin_url = ? WHERE uuid = ?"
        ).bind(skinUrl, uuid).run();

        return jsonResponse({ success: true, message: "Скин успешно обновлен!" });
      }

      // Route 6: Discord News
      if (url.pathname === "/news" && request.method === "GET") {
        const CHANNEL_ID = env.DISCORD_CHANNEL_ID;
        const BOT_TOKEN  = env.DISCORD_BOT_TOKEN;

        if (!CHANNEL_ID || !BOT_TOKEN) {
          return jsonResponse({ error: "News not configured" }, 503);
        }

        const discordRes = await fetch(
          `https://discord.com/api/v10/channels/${CHANNEL_ID}/messages?limit=5`,
          {
            headers: {
              "Authorization": `Bot ${BOT_TOKEN}`,
              "User-Agent": "CozyHouseLauncher/1.0",
            },
          }
        );

        if (!discordRes.ok) {
          return jsonResponse({ error: "Discord error" }, 502);
        }

        const messages = await discordRes.json();

        const news = messages
          .filter((m) => m.content || m.embeds?.length > 0)
          .map((m) => {
            const embed    = m.embeds?.[0];
            const hexColor = embed?.color != null
              ? "#" + embed.color.toString(16).padStart(6, "0")
              : null;
            return {
              tag:       embed?.footer?.text || "#новости",
              title:     embed?.title        || m.author?.username || "Новость",
              text:      embed?.description  || (m.content || "").slice(0, 120),
              color:     hexColor,
              url:       embed?.url          || null,
              timestamp: m.timestamp,
            };
          });

        return jsonResponse(news);
      }

      // Route 7: Player lookup — proxies Mojang API (avoids browser CORS)
      if (url.pathname.startsWith("/api/player/") && request.method === "GET") {
        const username = decodeURIComponent(url.pathname.slice("/api/player/".length)).trim();
        if (!username) return errorResponse("Никнейм обязателен.", 400);

        const mojangRes = await fetch(
          `https://api.mojang.com/users/profiles/minecraft/${encodeURIComponent(username)}`
        );

        if (mojangRes.status === 404 || mojangRes.status === 204) {
          return jsonResponse({ exists: false });
        }
        if (!mojangRes.ok) {
          return errorResponse("Ошибка Mojang API", 502);
        }

        const data = await mojangRes.json();
        return jsonResponse({ exists: true, id: data.id, name: data.name });
      }

      // Catch-all 404
      return errorResponse("Эндпоинт не найден.", 404);

    } catch (err) {
      return errorResponse(`Внутренняя ошибка сервера: ${err.message}`, 500);
    }
  }
};

// --- Web Crypto PBKDF2 Helpers ---
async function hashPassword(password, salt) {
  const encoder = new TextEncoder();
  const passwordBuffer = encoder.encode(password);

  const baseKey = await crypto.subtle.importKey(
    "raw",
    passwordBuffer,
    { name: "PBKDF2" },
    false,
    ["deriveBits", "deriveKey"]
  );

  return new Uint8Array(
    await crypto.subtle.deriveBits(
      {
        name: "PBKDF2",
        salt: salt,
        iterations: 100000,
        hash: "SHA-256",
      },
      baseKey,
      256
    )
  );
}

// Helper formatting utilities
function toHex(arrayBuffer) {
  return Array.prototype.map.call(new Uint8Array(arrayBuffer), x => ('00' + x.toString(16)).slice(-2)).join('');
}

function fromHex(hexString) {
  const bytes = new Uint8Array(hexString.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hexString.substr(i * 2, 2), 16);
  }
  return bytes;
}

function compareBuffers(buf1, buf2) {
  if (buf1.length !== buf2.length) return false;
  let result = 0;
  for (let i = 0; i < buf1.length; i++) {
    result |= buf1[i] ^ buf2[i];
  }
  return result === 0;
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  });
}

function errorResponse(message, status = 400) {
  return jsonResponse({ error: message }, status);
}
