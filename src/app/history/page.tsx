import HistoryView from "@/components/HistoryView";
import {getRunningHistoryServer, getProfileWeightServer} from "@/lib/supabaseServer";
import type {RunningRecord} from "@/types";
export const revalidate = 0;
export default async function HistoryPage() {
 let records: RunningRecord[] = [];
 let fetchError = "";
 try { records = await getRunningHistoryServer(); }
 catch (error) { fetchError = error instanceof Error ? error.message : "기록을 불러올 수 없습니다."; }
 const weightKg = await getProfileWeightServer();
 return <HistoryView records={records} fetchError={fetchError} weightKg={weightKg} />;
}
