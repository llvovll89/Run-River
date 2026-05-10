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
};
const STORAGE_KEY = "userProfile";
const LEGACY_GOAL_KEY = "weeklyGoalKm";

interface ProfileCtx {
    profile: UserProfile;
    saveProfile: (p: UserProfile) => void;
}

export const UserProfileContext = createContext<ProfileCtx>({
    profile: DEFAULT_PROFILE,
    saveProfile: () => {},
});

export function UserProfileProvider({children}: {children: React.ReactNode}) {
    const [profile, setProfile] = useState<UserProfile>(DEFAULT_PROFILE);
    const profileRef = useRef<UserProfile>(DEFAULT_PROFILE);

    useEffect(() => {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            let nextProfile = DEFAULT_PROFILE;
            if (raw) {
                const saved = JSON.parse(raw) as Partial<UserProfile>;
                const merged: UserProfile = {
                    ...DEFAULT_PROFILE,
                    ...saved,
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
                    };
                    nextProfile = merged;
                    localStorage.removeItem(LEGACY_GOAL_KEY);
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
                    localStorage.setItem(
                        STORAGE_KEY,
                        JSON.stringify(remoteProfile),
                    );
                    return;
                }

                const migrated = await upsertUserProfile(profileRef.current);
                if (!mounted) return;
                profileRef.current = migrated;
                setProfile(migrated);
                localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
            } catch {
                // 네트워크 오류 시 로컬 프로필 유지
            }
        }

        void syncProfile();

        return () => {
            mounted = false;
        };
    }, []);

    const saveProfile = useCallback((p: UserProfile) => {
        profileRef.current = p;
        setProfile(p);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(p));

        void (async () => {
            try {
                const {getCurrentUser, upsertUserProfile} =
                    await getSupabaseProfileApi();
                const user = await getCurrentUser();
                if (!user) return;
                await upsertUserProfile(p);
            } catch {
                // 저장 실패 시 다음 저장 시도
            }
        })();
    }, []);

    return (
        <UserProfileContext.Provider value={{profile, saveProfile}}>
            {children}
        </UserProfileContext.Provider>
    );
}

export function useUserProfile() {
    return useContext(UserProfileContext);
}
