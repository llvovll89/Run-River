import {redirect} from "next/navigation";
import HistoryView from "@/components/HistoryView";
import {getHistoryPageData} from "@/lib/supabaseServer";
export const revalidate = 0;
export default async function HistoryPage() {
 const data = await getHistoryPageData();
 // Middleware let us through without verifying (auth server slow) and there is no session after all.
 if (!data.signedIn) redirect("/auth?next=%2Fhistory");
 return <HistoryView records={data.records} fetchError={data.fetchError} weightKg={data.weightKg} />;
}
