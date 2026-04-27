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
  duration_seconds: number;
  pace: number;
  activity_type: ActivityType;
}) {
  assertEnv();
  const { data, error } = await supabase
    .from("running_records")
    .insert([record])
    .select()
    .single();

  if (error) throw error;
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
