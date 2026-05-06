import { createClient } from "@supabase/supabase-js";
import type { RunningRecord, ActivityType, LatLng } from "@/types";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

function assertEnv() {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Supabase 환경 변수가 설정되지 않았습니다. .env.local을 확인하세요.");
  }
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export async function saveRunningRecord(record: {
  start_point: LatLng;
  end_point: LatLng;
  distance_km: number;
  gps_distance_km_raw?: number | null;
  gap_adjustment_distance_km?: number | null;
  gap_adjustment_seconds?: number | null;
  gap_adjustment_count?: number | null;
  gap_adjustment_auto_enabled?: boolean | null;
  duration_seconds: number;
  pace: number;
  activity_type: ActivityType;
  altitude_start_m?: number | null;
  altitude_end_m?: number | null;
  elevation_gain_m?: number | null;
  elevation_loss_m?: number | null;
}) {
  assertEnv();
  const { data, error } = await supabase
    .from("running_records")
    .insert([record])
    .select()
    .single();

  if (error) {
    const message = (error.message ?? "").toLowerCase();
    const hasMissingAltitudeColumn =
      message.includes("altitude_start_m") ||
      message.includes("altitude_end_m") ||
      message.includes("elevation_gain_m") ||
      message.includes("elevation_loss_m") ||
      message.includes("gps_distance_km_raw") ||
      message.includes("gap_adjustment_distance_km") ||
      message.includes("gap_adjustment_seconds") ||
      message.includes("gap_adjustment_count") ||
      message.includes("gap_adjustment_auto_enabled");

    if (hasMissingAltitudeColumn && message.includes("column")) {
      const {
        altitude_start_m: _altStart,
        altitude_end_m: _altEnd,
        elevation_gain_m: _gain,
        elevation_loss_m: _loss,
        gps_distance_km_raw: _rawDist,
        gap_adjustment_distance_km: _gapDist,
        gap_adjustment_seconds: _gapSecs,
        gap_adjustment_count: _gapCount,
        gap_adjustment_auto_enabled: _gapAuto,
        ...legacyRecord
      } = record;

      const fallback = await supabase
        .from("running_records")
        .insert([legacyRecord])
        .select()
        .single();

      if (fallback.error) throw fallback.error;
      return fallback.data as RunningRecord;
    }

    throw error;
  }
  return data as RunningRecord;
}

export async function deleteRunningRecord(id: string): Promise<void> {
  assertEnv();
  const { error } = await supabase
    .from("running_records")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

export async function updateRunningMemo(
  id: string,
  memo: string | null,
): Promise<RunningRecord> {
  assertEnv();
  const { data, error } = await supabase
    .from("running_records")
    .update({ memo })
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data as RunningRecord;
}

export async function getRunningHistory(): Promise<RunningRecord[]> {
  assertEnv();
  const { data, error } = await supabase
    .from("running_records")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as RunningRecord[];
}
