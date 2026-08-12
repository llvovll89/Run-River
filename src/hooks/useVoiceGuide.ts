import {useCallback} from "react";

export function useVoiceGuide() {
    const speak = useCallback((text: string) => {
        if (typeof window === "undefined" || !("speechSynthesis" in window))
            return;
        const synth = window.speechSynthesis;
        synth.cancel();
        const u = new SpeechSynthesisUtterance(text);
        u.lang = "ko-KR";
        u.rate = 1.05;
        u.volume = 1;
        // cancel()이 비동기인 브라우저에서 즉시 speak()가 무시되는 경쟁 상태 방지
        setTimeout(() => synth.speak(u), 0);
    }, []);

    const cancel = useCallback(() => {
        if (typeof window !== "undefined" && "speechSynthesis" in window) {
            window.speechSynthesis.cancel();
        }
    }, []);

    return {speak, cancel};
}
