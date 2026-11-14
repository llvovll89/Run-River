import type {ActivityType} from "@/types";

export function activityLabel(type: ActivityType) {
    return type === "hiking" ? "하이킹" : type === "running" ? "러닝" : "걷기";
}

// Enable only after the DB constraint migration has been applied and verified.
export function canSyncActivity(type: ActivityType) {
    return type !== "hiking" || process.env.NEXT_PUBLIC_HIKING_SYNC === "1";
}
