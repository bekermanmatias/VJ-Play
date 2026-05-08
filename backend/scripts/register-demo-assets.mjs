import { config as loadDotenv } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import ws from "ws";

loadDotenv({ path: ".env" });

const required = (name) => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Falta ${name} en .env`);
  return value;
};

const supabase = createClient(required("SUPABASE_URL"), required("SUPABASE_KEY"), {
  auth: { persistSession: false, autoRefreshToken: false },
  realtime: { transport: ws },
});

const endpoint =
  process.env.R2_ENDPOINT?.trim() ||
  `https://${required("R2_ACCOUNT_ID")}.r2.cloudflarestorage.com`;
const bucket = required("R2_BUCKET_NAME");
const publicBase = process.env.R2_PUBLIC_BASE_URL?.trim().replace(/\/$/, "") || "";

const buildUrl = (key) =>
  publicBase ? `${publicBase}/${key}` : `${endpoint.replace(/\/$/, "")}/${bucket}/${key}`;

const localDay = "2026-05-07";
const key1 = "demo/replays/2026-05-08/demo-turno-1-turno2.mp4";
const key2 = "demo/replays/2026-05-08/demo-turno-2-turno3.mp4";
const key3 = "demo/replays/2026-05-08/demo-turno-3-turno4.mp4";

const rows = [
  ["08:00", buildUrl(key1)],
  ["09:00", buildUrl(key2)],
  ["10:00", buildUrl(key3)],
  ["11:00", buildUrl(key1)],
].map(([hour, url]) => ({
  match_key: `cancha-padel|${localDay}|${hour}`,
  video_url: url,
  poster_url: null,
  updated_at: new Date().toISOString(),
}));

const { error } = await supabase.from("replay_assets").upsert(rows, { onConflict: "match_key" });
if (error) throw new Error(`No se pudo registrar replay_assets: ${error.message}`);

console.log("upsert ok");
for (const row of rows) {
  console.log(`${row.match_key} -> ${row.video_url}`);
}
