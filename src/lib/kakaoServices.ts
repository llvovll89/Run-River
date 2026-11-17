/**
 * Kakao is used only for Korean place search and reverse geocoding; maps are drawn by MapView.
 * Loads the Kakao JS SDK with the services library once, on demand.
 */
let loading: Promise<boolean> | null = null;

export function loadKakaoServices(): Promise<boolean> {
    if (typeof window === "undefined") return Promise.resolve(false);
    if (window.kakao?.maps?.services) return Promise.resolve(true);
    const key = process.env.NEXT_PUBLIC_KAKAO_MAP_KEY;
    if (!key) return Promise.resolve(false);
    loading ??= new Promise<boolean>(resolve => {
        const script = document.createElement("script");
        script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${key}&libraries=services&autoload=false`;
        script.async = true;
        script.onload = () => kakao.maps.load(() => resolve(Boolean(window.kakao?.maps?.services)));
        script.onerror = () => { script.remove(); loading = null; resolve(false); };
        document.head.appendChild(script);
    });
    return loading;
}

/** Short Korean area name ("종로구 청운동") for a point, or null when Kakao is unavailable. */
export async function areaName(lat: number, lng: number): Promise<string | null> {
    const ready = await Promise.race([loadKakaoServices(), new Promise<boolean>(resolve => setTimeout(() => resolve(false), 4000))]);
    if (!ready) return null;
    return new Promise(resolve => {
        const timer = setTimeout(() => resolve(null), 4000);
        new kakao.maps.services.Geocoder().coord2Address(lng, lat, (result, status) => {
            clearTimeout(timer);
            const address = status === kakao.maps.services.Status.OK ? result[0]?.address : undefined;
            resolve(address ? [address.region_2depth_name, address.region_3depth_name].filter(Boolean).join(" ") || address.region_1depth_name || null : null);
        });
    });
}
