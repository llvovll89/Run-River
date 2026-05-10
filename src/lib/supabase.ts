import type {User} from "@supabase/supabase-js";
import type {RunningRecord, ActivityType, LatLng, UserProfile} from "@/types";
import {getSupabaseBrowserClient} from "@/lib/supabaseClient";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

function assertEnv() {
    if (!supabaseUrl || !supabaseAnonKey) {
        throw new Error(
            "Supabase 환경 변수가 설정되지 않았습니다. .env.local을 확인하세요.",
        );
    }
}

function getClient() {
    return getSupabaseBrowserClient();
}

export async function getCurrentUser(): Promise<User | null> {
    assertEnv();
    const supabase = getClient();
    const {data, error} = await supabase.auth.getUser();
    if (error) throw error;
    return data.user ?? null;
}

export async function signOut(): Promise<void> {
    assertEnv();
    const supabase = getClient();
    const {error} = await supabase.auth.signOut();
    if (error) throw error;
}

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
    const supabase = getClient();

    const {data, error} = await supabase
        .from("running_records")
        .insert([record])
        .select()
        .single();

    if (error) throw error;
    return data as RunningRecord;
}

export async function deleteRunningRecord(id: string): Promise<void> {
    assertEnv();
    const supabase = getClient();
    const {error} = await supabase
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
    const supabase = getClient();
    const {data, error} = await supabase
        .from("running_records")
        .update({memo})
        .eq("id", id)
        .select()
        .single();

    if (error) throw error;
    return data as RunningRecord;
}

export async function getRunningHistory(): Promise<RunningRecord[]> {
    assertEnv();
    const supabase = getClient();
    const {data, error} = await supabase
        .from("running_records")
        .select("*")
        .order("created_at", {ascending: false});

    if (error) throw error;
    return (data ?? []) as RunningRecord[];
}

export async function getUserProfile(): Promise<UserProfile | null> {
    assertEnv();
    const supabase = getClient();
    const {data, error} = await supabase
        .from("user_profiles")
        .select(
            "weight, height, age, weekly_goal_km, auto_pause, auto_apply_gap_adjustment",
        )
        .maybeSingle();

    if (error) throw error;
    if (!data) return null;

    return {
        weight: data.weight,
        height: data.height,
        age: data.age,
        weeklyGoalKm: data.weekly_goal_km,
        autoPause: data.auto_pause,
        autoApplyGapAdjustment: data.auto_apply_gap_adjustment,
    };
}

export async function upsertUserProfile(
    profile: UserProfile,
): Promise<UserProfile> {
    assertEnv();
    const supabase = getClient();
    const user = await getCurrentUser();
    if (!user) {
        throw new Error("로그인이 필요합니다.");
    }

    const {data, error} = await supabase
        .from("user_profiles")
        .upsert({
            user_id: user.id,
            weight: profile.weight,
            height: profile.height,
            age: profile.age,
            weekly_goal_km: profile.weeklyGoalKm,
            auto_pause: profile.autoPause,
            auto_apply_gap_adjustment: profile.autoApplyGapAdjustment,
            updated_at: new Date().toISOString(),
        })
        .select(
            "weight, height, age, weekly_goal_km, auto_pause, auto_apply_gap_adjustment",
        )
        .single();

    if (error) throw error;

    return {
        weight: data.weight,
        height: data.height,
        age: data.age,
        weeklyGoalKm: data.weekly_goal_km,
        autoPause: data.auto_pause,
        autoApplyGapAdjustment: data.auto_apply_gap_adjustment,
    };
}

export async function getUnclaimedLegacyCount(): Promise<number> {
    assertEnv();
    const supabase = getClient();
    const {data, error} = await supabase.rpc("count_unclaimed_legacy_records");
    if (error) throw error;
    return typeof data === "number" ? data : 0;
}

export async function claimLegacyRecords(limitCount = 200): Promise<number> {
    assertEnv();
    const supabase = getClient();
    const {data, error} = await supabase.rpc("claim_legacy_records", {
        limit_count: limitCount,
    });
    if (error) throw error;
    return typeof data === "number" ? data : 0;
}
