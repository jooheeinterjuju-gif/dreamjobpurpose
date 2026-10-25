// 나의 꿈 영어 글쓰기 — 선생님이 연 수업 단계를 모든 학생 기기와 공유하는 작은 저장소
// 주소: /api/settings   (GET: 누구나 읽기 · POST: 관리자 비밀번호 필요)
import { getStore } from "@netlify/blobs";

const ALLOWED = ["when"];               // 켜고 끌 수 있는 단계 이름
const DEFAULT_PASSWORD = "1234";
const headers = { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" };
const json = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function sha(text) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode("dreamWriting|" + text));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
function cleanFeatures(f) {
  const out = {};
  for (const k of ALLOWED) out[k] = !!(f && f[k]);
  return out;
}

export default async (req) => {
  const store = getStore({ name: "dream-writing", consistency: "strong" });
  const saved = (await store.get("settings", { type: "json" })) || {};
  const features = cleanFeatures(saved.features);

  if (req.method === "GET") return json({ features, updatedAt: saved.updatedAt || 0 });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  let body;
  try { body = await req.json(); } catch { return json({ error: "bad_request" }, 400); }

  const auth = (await store.get("auth", { type: "json" })) || { hash: await sha(DEFAULT_PASSWORD), changed: false };
  if (typeof body.password !== "string" || (await sha(body.password)) !== auth.hash) {
    await sleep(600);
    return json({ error: "wrong_password" }, 401);
  }

  if (body.action === "login") return json({ ok: true, changed: !!auth.changed, features });

  if (body.action === "setPassword") {
    const np = String(body.newPassword || "");
    if (np.length < 4 || np === DEFAULT_PASSWORD) return json({ error: "weak_password" }, 400);
    await store.setJSON("auth", { hash: await sha(np), changed: true });
    return json({ ok: true });
  }

  if (body.action === "setFeatures") {
    const next = cleanFeatures({ ...features, ...(body.features || {}) });
    await store.setJSON("settings", { features: next, updatedAt: Date.now() });
    return json({ ok: true, features: next });
  }

  return json({ error: "unknown_action" }, 400);
};

export const config = { path: "/api/settings" };
