import { config as loadDotenv } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { join } from "node:path";

loadDotenv({ path: join(process.cwd(), ".env") });

function requireEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Falta ${name} en backend/.env`);
  return value;
}

const supabaseUrl = requireEnv("SUPABASE_URL");
const supabaseKey = requireEnv("SUPABASE_KEY");

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function isVideoReachable(url) {
  if (!url || typeof url !== "string") return false;
  try {
    const head = await fetch(url, { method: "HEAD", redirect: "follow" });
    if (head.ok) return true;
  } catch {
    // fallback GET
  }
  try {
    const get = await fetch(url, {
      method: "GET",
      headers: { Range: "bytes=0-0" },
      redirect: "follow",
    });
    return get.ok;
  } catch {
    return false;
  }
}

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function main() {
  const { data: rows, error } = await supabase
    .from("replay_assets")
    .select("match_key,video_url,updated_at")
    .order("updated_at", { ascending: false });

  if (error) throw new Error(`No se pudo leer replay_assets: ${error.message}`);
  if (!rows || rows.length === 0) {
    console.log("No hay filas en replay_assets.");
    return;
  }

  const toDelete = [];
  const toKeep = [];

  for (const row of rows) {
    const ok = await isVideoReachable(row.video_url);
    if (ok) toKeep.push(row);
    else toDelete.push(row);
  }

  if (toDelete.length > 0) {
    const keys = toDelete.map((r) => r.match_key);
    for (const keysChunk of chunk(keys, 100)) {
      const { error: codesErr } = await supabase
        .from("match_access_codes")
        .delete()
        .in("match_key", keysChunk);
      if (codesErr) throw new Error(`No se pudo borrar match_access_codes: ${codesErr.message}`);

      const { error: assetsErr } = await supabase
        .from("replay_assets")
        .delete()
        .in("match_key", keysChunk);
      if (assetsErr) throw new Error(`No se pudo borrar replay_assets: ${assetsErr.message}`);
    }
  }

  console.log(`Total evaluados: ${rows.length}`);
  console.log(`Con video accesible (quedan): ${toKeep.length}`);
  console.log(`Eliminados por URL rota/inaccesible: ${toDelete.length}`);

  if (toDelete.length > 0) {
    console.log("match_key eliminados:");
    for (const row of toDelete) {
      console.log(`- ${row.match_key}`);
    }
  }
}

await main();
