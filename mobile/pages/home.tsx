import {Suspense} from "react";
import HomePageClient from "@/components/HomePageClient";
import NativeRunBanner from "@/components/NativeRunBanner";

export default function HomePage() {
    return <><NativeRunBanner /><Suspense fallback={<p>Run River를 여는 중…</p>}><HomePageClient /></Suspense></>;
}
