"use client";

import {
    createContext,
    useContext,
    useEffect,
    useState,
    useCallback,
    useRef,
} from "react";
import type {UserProfile} from "@/types";
import {
    DEFAULT_RUN_TUNING,
    loadRunTuning,
    normalizeRunTuning,
    saveRunTuning,
} from "@/lib/runTuning";

async function getSupabaseProfileApi() {
    return import("@/lib/supabase");
}

const DEFAULT_PROFILE: UserProfile = {
    weight: 70,
    height: 170,
    age: 30,
    weeklyGoalKm: 20,
    autoPause: true,
    autoApplyGapAdjustment: false,
    runTuning: DEFAULT_RUN_TUNING,
};
const STORAGE_KEY = "userProfile";
const LEGACY_GOAL_KEY = "weeklyGoalKm";

interface ProfileCtx {
    profile: UserProfile;
    saveProfile: (p: UserProfile) => void;
    syncState: "idle" | "saving" | "synced" | "error";
    syncErrorMessage: string | null;
    retrySync: () => Promise<void>;
}

export const UserProfileContext = createContext<ProfileCtx>({
    profile: DEFAULT_PROFILE,
    saveProfile: () => {},
    syncState: "idle",
    syncErrorMessage: null,
    retrySync: async () => {},
});

export function UserProfileProvider({children}: {children: React.ReactNode}) {
    const [profile, setProfile] = useState<UserProfile>(DEFAULT_PROFILE);
    const [syncState, setSyncState] = useState<
        "idle" | "saving" | "synced" | "error"
    >("idle");
    const [syncErrorMessage, setSyncErrorMessage] = useState<string | null>(
        null,
    );
    const profileRef = useRef<UserProfile>(DEFAULT_PROFILE);
    const syncStateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
        null,
    );

    useEffect(() => {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            let nextProfile = DEFAULT_PROFILE;
            if (raw) {
                const saved = JSON.parse(raw) as Partial<UserProfile>;
                const merged: UserProfile = {
                    ...DEFAULT_PROFILE,
                    ...saved,
                    runTuning: normalizeRunTuning(
                        saved.runTuning ?? loadRunTuning(),
                    ),
                };
                // 기존 별도 저장된 weeklyGoalKm 마이그레이션
                if (!merged.weeklyGoalKm) {
                    const legacy = localStorage.getItem(LEGACY_GOAL_KEY);
                    merged.weeklyGoalKm = legacy
                        ? Number(legacy)
                        : DEFAULT_PROFILE.weeklyGoalKm;
                    localStorage.removeItem(LEGACY_GOAL_KEY);
                }
                nextProfile = merged;
            } else {
                // 프로필은 없고 주간 목표만 있던 경우
                const legacy = localStorage.getItem(LEGACY_GOAL_KEY);
                if (legacy) {
                    const merged = {
                        ...DEFAULT_PROFILE,
                        weeklyGoalKm: Number(legacy),
                        runTuning: loadRunTuning(),
                    };
                    nextProfile = merged;
                    localStorage.removeItem(LEGACY_GOAL_KEY);
                } else {
                    nextProfile = {
                        ...DEFAULT_PROFILE,
                        runTuning: loadRunTuning(),
                    };
                }
            }

            profileRef.current = nextProfile;
            setProfile(nextProfile);
        } catch {
            // 손상된 데이터는 기본값 사용
        }
    }, []);

    useEffect(() => {
        let mounted = true;

        async function syncProfile() {
            try {
                const {getCurrentUser, getUserProfile, upsertUserProfile} =
                    await getSupabaseProfileApi();
                const user = await getCurrentUser();
                if (!user || !mounted) return;

                const remoteProfile = await getUserProfile();
                if (!mounted) return;

                if (remoteProfile) {
                    profileRef.current = remoteProfile;
                    setProfile(remoteProfile);
                    if (remoteProfile.runTuning) {
                        saveRunTuning(remoteProfile.runTuning);
                    }
                    localStorage.setItem(
                        STORAGE_KEY,
                        JSON.stringify(remoteProfile),
                    );
                    setSyncState("synced");
                    setSyncErrorMessage(null);
                    return;
                }

                const migrated = await upsertUserProfile(profileRef.current);
                if (!mounted) return;
                profileRef.current = migrated;
                setProfile(migrated);
                if (migrated.runTuning) {
                    saveRunTuning(migrated.runTuning);
                }
                localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
                setSyncState("synced");
                setSyncErrorMessage(null);
            } catch (e) {
                // 네트워크 오류 시 로컬 프로필 유지
                setSyncState("error");
                setSyncErrorMessage(
                    e instanceof Error
                        ? e.message
                        : "프로필 동기화 중 오류가 발생했습니다.",
                );
            }
        }

        void syncProfile();

        return () => {
            mounted = false;
        };
    }, []);

    const saveProfile = useCallback((p: UserProfile) => {
        setSyncState("saving");
        setSyncErrorMessage(null);
        if (syncStateTimerRef.current) {
            clearTimeout(syncStateTimerRef.current);
            syncStateTimerRef.current = null;
        }

        const normalized: UserProfile = {
            ...p,
            runTuning: normalizeRunTuning(p.runTuning ?? DEFAULT_RUN_TUNING),
        };
        profileRef.current = normalized;
        setProfile(normalized);
        if (normalized.runTuning) {
            saveRunTuning(normalized.runTuning);
        }
        localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));

        void (async () => {
            try {
                const {getCurrentUser, upsertUserProfile} =
                    await getSupabaseProfileApi();
                const user = await getCurrentUser();
                if (!user) {
                    setSyncState("synced");
                    setSyncErrorMessage(null);
                    syncStateTimerRef.current = setTimeout(
                        () => setSyncState("idle"),
                        1800,
                    );
                    return;
                }
                await upsertUserProfile(normalized);
                setSyncState("synced");
                setSyncErrorMessage(null);
                syncStateTimerRef.current = setTimeout(
                    () => setSyncState("idle"),
                    1800,
                );
            } catch (e) {
                // 저장 실패 시 다음 저장 시도
                setSyncState("error");
                setSyncErrorMessage(
                    e instanceof Error
                        ? e.message
                        : "클라우드 저장에 실패했습니다.",
                );
            }
        })();
    }, []);

    const retrySync = useCallback(async () => {
        setSyncState("saving");
        setSyncErrorMessage(null);
        if (syncStateTimerRef.current) {
            clearTimeout(syncStateTimerRef.current);
            syncStateTimerRef.current = null;
        }

        try {
            const {getCurrentUser, upsertUserProfile} =
                await getSupabaseProfileApi();
            const user = await getCurrentUser();
            if (!user) {
                setSyncState("error");
                setSyncErrorMessage("로그인이 필요합니다.");
                return;
            }

            const synced = await upsertUserProfile(profileRef.current);
            profileRef.current = synced;
            setProfile(synced);
            if (synced.runTuning) {
                saveRunTuning(synced.runTuning);
            }
            localStorage.setItem(STORAGE_KEY, JSON.stringify(synced));

            setSyncState("synced");
            setSyncErrorMessage(null);
            syncStateTimerRef.current = setTimeout(
                () => setSyncState("idle"),
                1800,
            );
        } catch (e) {
            setSyncState("error");
            setSyncErrorMessage(
                e instanceof Error
                    ? e.message
                    : "클라우드 재시도에 실패했습니다.",
            );
        }
    }, []);

    useEffect(() => {
        return () => {
            if (syncStateTimerRef.current) {
                clearTimeout(syncStateTimerRef.current);
            }
        };
    }, []);

    return (
        <UserProfileContext.Provider
            value={{
                profile,
                saveProfile,
                syncState,
                syncErrorMessage,
                retrySync,
            }}
        >
            {children}
        </UserProfileContext.Provider>
    );
}

export function useUserProfile() {
    return useContext(UserProfileContext);
}
