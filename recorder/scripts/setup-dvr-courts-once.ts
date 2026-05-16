/**
 * Configura canchas → canales DVR (5, 9, 13). Uso único:
 *   npx tsx scripts/setup-dvr-courts-once.ts
 */
import { getSupabase } from "../src/config/supabase.js";

const MAPPING: Array<{
  slug: string;
  label: string;
  sortOrder: number;
  dvrChannel: number;
}> = [
  { slug: "cancha-padel", label: "Cancha Padel", sortOrder: 0, dvrChannel: 5 },
  { slug: "cancha-f5", label: "Cancha F5", sortOrder: 1, dvrChannel: 9 },
  { slug: "cancha-3", label: "Cancha 3", sortOrder: 2, dvrChannel: 13 },
];

async function main(): Promise<void> {
  const sb = getSupabase();

  for (const row of MAPPING) {
    const { data: existing } = await sb
      .from("replay_courts")
      .select("slug")
      .eq("slug", row.slug)
      .maybeSingle();

    if (existing) {
      const { error } = await sb
        .from("replay_courts")
        .update({
          dvr_channel: row.dvrChannel,
          dvr_subtype: 0,
          recording_enabled: true,
          label: row.label,
          updated_at: new Date().toISOString(),
        })
        .eq("slug", row.slug);
      if (error) throw new Error(`${row.slug}: ${error.message}`);
      console.log(`✓ actualizado ${row.slug} → canal ${row.dvrChannel}`);
    } else {
      const { error } = await sb.from("replay_courts").insert({
        slug: row.slug,
        label: row.label,
        sort_order: row.sortOrder,
        active: true,
        dvr_channel: row.dvrChannel,
        dvr_subtype: 0,
        recording_enabled: true,
      });
      if (error) throw new Error(`${row.slug}: ${error.message}`);
      console.log(`✓ creado ${row.slug} → canal ${row.dvrChannel}`);
    }
  }

  const { data, error } = await sb
    .from("replay_courts")
    .select("slug, label, dvr_channel, recording_enabled")
    .eq("recording_enabled", true)
    .order("sort_order");
  if (error) throw error;
  console.log("\nCanchas con grabación activa:");
  console.table(data);
}

void main().catch((e) => {
  console.error(e.message);
  if (String(e.message).includes("dvr_channel")) {
    console.error(
      "\n→ Ejecutá primero en Supabase SQL Editor: backend/supabase/010_replay_courts_dvr.sql",
    );
  }
  process.exit(1);
});
