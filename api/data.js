// /api/data  —  Persistencia del tablero en Redis (Upstash / Vercel KV)
// GET  -> { data: <JSON guardado> | null }
// POST -> body { data: [...] }  guarda y responde { ok: true }
//
// Usa SOLO la API REST de Upstash con fetch nativo (Node 18+), sin dependencias.
// Lee las credenciales de las variables de entorno que crea la integración de
// almacenamiento de Vercel (admite ambos nombres habituales).

const KEY = "tablero:gobierno-dato";

function creds() {
  const url =
    process.env.KV_REST_API_URL ||
    process.env.UPSTASH_REDIS_REST_URL ||
    process.env.REDIS_REST_API_URL;
  const token =
    process.env.KV_REST_API_TOKEN ||
    process.env.UPSTASH_REDIS_REST_TOKEN ||
    process.env.REDIS_REST_API_TOKEN;
  return { url, token };
}

// Ejecuta un comando Redis enviando un array JSON al endpoint REST de Upstash.
async function redis(cmd) {
  const { url, token } = creds();
  const r = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(cmd),
  });
  if (!r.ok) throw new Error("redis_http_" + r.status);
  return r.json(); // { result: ... }
}

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");

  const { url, token } = creds();
  if (!url || !token) {
    return res.status(500).json({ error: "storage_not_configured" });
  }

  try {
    if (req.method === "GET") {
      const out = await redis(["GET", KEY]);
      const data = out && out.result ? JSON.parse(out.result) : null;
      return res.status(200).json({ data });
    }

    if (req.method === "POST") {
      let body = req.body;
      if (typeof body === "string") body = JSON.parse(body || "{}");
      const data = body && body.data;
      if (!Array.isArray(data)) {
        return res.status(400).json({ error: "invalid_payload" });
      }
      await redis(["SET", KEY, JSON.stringify(data)]);
      return res.status(200).json({ ok: true, saved: data.length });
    }

    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ error: "method_not_allowed" });
  } catch (e) {
    return res.status(500).json({ error: String((e && e.message) || e) });
  }
};
