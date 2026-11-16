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
