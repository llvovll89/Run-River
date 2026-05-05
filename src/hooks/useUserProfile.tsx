"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import type { UserProfile } from "@/types";

const DEFAULT_PROFILE: UserProfile = { weight: 70, height: 170, age: 30, weeklyGoalKm: 20, autoPause: true };
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

export function UserProfileProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<UserProfile>(DEFAULT_PROFILE);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as UserProfile;
        // 기존 별도 저장된 weeklyGoalKm 마이그레이션
        if (!saved.weeklyGoalKm) {
          const legacy = localStorage.getItem(LEGACY_GOAL_KEY);
          saved.weeklyGoalKm = legacy ? Number(legacy) : DEFAULT_PROFILE.weeklyGoalKm;
          localStorage.removeItem(LEGACY_GOAL_KEY);
        }
        setProfile(saved);
      } else {
        // 프로필은 없고 주간 목표만 있던 경우
        const legacy = localStorage.getItem(LEGACY_GOAL_KEY);
        if (legacy) {
          const merged = { ...DEFAULT_PROFILE, weeklyGoalKm: Number(legacy) };
          setProfile(merged);
          localStorage.removeItem(LEGACY_GOAL_KEY);
        }
      }
    } catch {
      // 손상된 데이터는 기본값 사용
    }
  }, []);

  const saveProfile = useCallback((p: UserProfile) => {
    setProfile(p);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
  }, []);

  return (
    <UserProfileContext.Provider value={{ profile, saveProfile }}>
      {children}
    </UserProfileContext.Provider>
  );
}

export function useUserProfile() {
  return useContext(UserProfileContext);
}
