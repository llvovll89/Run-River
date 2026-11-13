export class TimeoutError extends Error {
    constructor(label: string, ms: number) {
        super(`${label} 응답이 ${ms / 1000}초 안에 오지 않았어요. 잠시 후 다시 시도해주세요.`);
        this.name = "TimeoutError";
    }
}

/**
 * Supabase 같은 외부 호출이 응답하지 않을 때 화면 이동/렌더링이 무한정 막히지 않도록
 * 지정 시간 안에 끝나지 않으면 TimeoutError로 reject한다.
 */
export function withTimeout<T>(
    promise: PromiseLike<T>,
    ms: number,
    label = "요청",
): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new TimeoutError(label, ms)), ms);
    });
    return Promise.race([Promise.resolve(promise), timeout]).finally(() =>
        clearTimeout(timer),
    );
}
