"use client";

import { useEffect } from "react";
import { saveRunningRecord } from "@/lib/supabase";
import { getQueue, dequeue } from "@/lib/offlineQueue";

async function syncQueue() {
  const queue = getQueue();
  for (const item of queue) {
    try {
      await saveRunningRecord(item.record);
      dequeue(item.queueId);
    } catch {
      break;
    }
  }
}

export function OfflineSyncProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    window.addEventListener("online", syncQueue);
    if (navigator.onLine) syncQueue();
    return () => window.removeEventListener("online", syncQueue);
  }, []);

  return <>{children}</>;
}
