import dynamicImport from "next/dynamic";

export const dynamic = "force-dynamic";

const HomePageClient = dynamicImport(
    () => import("@/components/HomePageClient"),
);

export default function HomePage() {
    return <HomePageClient />;
}
