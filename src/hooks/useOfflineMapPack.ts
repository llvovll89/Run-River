"use client";

import {useEffect, useState} from "react";
import {listOfflineMaps, selectedOfflineMap, type MapPack} from "@/lib/offlineMaps";

export function useOfflineMapPack() {
    const [pack, setPack] = useState<MapPack | null>(null);
    useEffect(() => {
        let disposed = false;
        const refresh = () => {
            void listOfflineMaps().then(packs => { if (!disposed) setPack(packs.find(pack => pack.id === selectedOfflineMap()) ?? null); }).catch(() => { if (!disposed) setPack(null); });
        };
        refresh(); window.addEventListener("offline-map-changed", refresh);
        return () => { disposed = true; window.removeEventListener("offline-map-changed", refresh); };
    }, []);
    return pack;
}
