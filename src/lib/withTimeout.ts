export class TimeoutError extends Error {
    readonly isTimeout = true;
}

/** Shared wording for a stats screen that could not reach the server in time (web SSR and static app). */
export const CONNECTION_DELAY_MESSAGE = "연결이 지연되고 있어요. 인터넷 연결을 확인한 뒤 통계를 다시 열어주세요.";

/** Reject when an operation does not settle within `ms`. The operation itself keeps running. */
export async function withTimeout<T>(operation: PromiseLike<T>, ms: number, message = "요청 시간이 초과됐어요."): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
        return await Promise.race([
            Promise.resolve(operation),
            new Promise<never>((_, reject) => {
                timer = setTimeout(() => reject(new TimeoutError(message)), ms);
            }),
        ]);
    } finally {
        clearTimeout(timer);
    }
}

/**
 * A fetch that aborts each request after `ms`, for Supabase's `global.fetch` option.
 * Unlike wrapping a call in `withTimeout`, the network request (including token refresh) really stops.
 */
export function fetchWithTimeout(ms: number): typeof fetch {
    return async (input, init) => {
        // Manual combination: AbortSignal.any/timeout are not guaranteed in every Edge runtime.
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(new TimeoutError("요청 시간이 초과됐어요.")), ms);
        const outer = init?.signal;
        const forward = () => controller.abort(outer?.reason);
        if (outer?.aborted) forward(); else outer?.addEventListener("abort", forward, {once: true});
        try {
            return await fetch(input, {...init, signal: controller.signal});
        } finally {
            clearTimeout(timer);
            outer?.removeEventListener("abort", forward);
        }
    };
}
