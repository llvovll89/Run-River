import { createClient } from "@supabase/supabase-js";
import type { RunningRecord, ActivityType, LatLng } from "@/types";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export async function saveRunningRecord(record: {
  start_point: LatLng;
  end_point: LatLng;
  distance_km: number;
  duration_seconds: number;
  pace: number;
  activity_type: ActivityType;
}) {
  const { data, error } = await supabase
    .from("running_records")
    .insert([record])
    .select()
    .single();

  if (error) throw error;
  return data as RunningRecord;
}

export async function getRunningHistory(): Promise<RunningRecord[]> {
  const { data, error } = await supabase
    .from("running_records")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as RunningRecord[];
}
