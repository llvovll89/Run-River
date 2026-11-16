"use client";

import {useEffect, useState} from "react";
import {getSupabaseBrowserClient} from "@/lib/supabaseClient";

export type AuthSessionState =
    | {status: "loading"}
    | {status: "guest"}
    | {status: "member"; email: string; name: string | null};

/**
 * Whether this device has a signed-in session, read locally (no network) and kept live.
 * Use it for UI decisions such as "show a login prompt"; the server still verifies access.
 */
export function useAuthSession(): AuthSessionState {
    const [state, setState] = useState<AuthSessionState>({status: "loading"});

    useEffect(() => {
        let alive = true;
        let supabase: ReturnType<typeof getSupabaseBrowserClient>;
        try {
            supabase = getSupabaseBrowserClient();
        } catch {
            setState({status: "guest"});
            return;
        }
        const apply = (session: {user: {email?: string | null; user_metadata?: Record<string, unknown>}} | null) => {
            if (!alive) return;
            if (!session) { setState({status: "guest"}); return; }
            const meta = session.user.user_metadata ?? {};
            const name = typeof meta.name === "string" ? meta.name : typeof meta.full_name === "string" ? meta.full_name : null;
            setState({status: "member", email: session.user.email ?? "", name});
        };
        // getSession may try a token refresh; never leave the UI in "loading" because of it.
        const fallback = setTimeout(() => setState(previous => previous.status === "loading" ? {status: "guest"} : previous), 2500);
        supabase.auth.getSession()
            .then(({data}) => apply(data.session))
            .catch(() => apply(null))
            .finally(() => clearTimeout(fallback));
        const {data: {subscription}} = supabase.auth.onAuthStateChange((_event, session) => apply(session));
        return () => {
            alive = false;
            clearTimeout(fallback);
            subscription.unsubscribe();
        };
    }, []);

    return state;
}
