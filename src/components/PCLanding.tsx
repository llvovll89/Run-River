"use client";

import {useState} from "react";
import Brand, {RiverMark} from "@/components/Brand";

export default function PCLanding() {
    const [copied, setCopied] = useState(false);
    const [copyError, setCopyError] = useState(false);
    async function copyAddress() {
        try { await navigator.clipboard.writeText(window.location.origin); setCopied(true); }
        catch { setCopyError(true); }
    }
    return <main className="desktop-landing">
        <header className="desktop-header"><Brand /><a href="#start">휴대폰에서 시작하기</a></header>
        <section className="desktop-hero">
            <div className="desktop-intro">
                <h1>나의 속도로,<br />흐르듯 달리다.</h1>
                <p>목표를 정하고, 지나온 길을 기록하세요.<br />인터넷이 끊겨도 화면을 켜둔 동안<br />GPS가 전하는 움직임을 기기에 담습니다.</p>
                <button className="primary-link" onClick={copyAddress}>{copied ? "주소를 복사했어요" : "휴대폰으로 열 주소 복사"}</button>
                <p role="status" className="desktop-caption">{copyError ? "브라우저 주소를 복사해 휴대폰에서 열어주세요." : "iPhone Safari에서 열고 홈 화면에 추가할 수 있어요."}</p>
            </div>
            <div className="desktop-preview" aria-label="운동 기록 화면 예시">
                <div className="preview-top"><RiverMark size={22} /><span>러닝 중</span><span className="preview-gps">GPS</span></div>
                <div className="preview-distance"><span>거리</span><strong className="num">5.00<small>km</small></strong></div>
                <div className="preview-stats"><div><span>시간</span><strong className="num">32:15</strong></div><div><span>페이스</span><strong className="num">6′27″<small>/km</small></strong></div></div>
                <svg className="preview-route" viewBox="0 0 300 230" fill="none" aria-hidden="true">
                    <path d="M-20 190C70 80 60 250 180 120S280 85 330 20M-30 145C70 40 70 210 185 80S290 40 330-10" stroke="currentColor" opacity=".1" strokeWidth="24" />
                    <path d="M60 170C80 120 50 85 105 80S130 160 175 135 178 48 225 55" stroke="var(--c-toss-blue)" strokeWidth="4" strokeLinecap="round" />
                    <circle cx="60" cy="170" r="5" fill="var(--c-walk)" /><circle cx="225" cy="55" r="7" fill="var(--c-toss-blue)" stroke="var(--c-surface)" strokeWidth="3" />
                </svg>
                <div className="preview-action">일시정지</div>
                <p className="preview-example">화면 예시</p>
            </div>
        </section>
        <section className="desktop-features" aria-label="주요 기능">
            <article><h2>목표는 가볍게</h2><p>거리, 시간, 인터벌 중 오늘의 운동을 선택하세요. 걷기도 함께 기록할 수 있어요.</p></article>
            <article><h2>지나온 길은 차곡차곡</h2><p>운동 중 기록을 기기에 저장하고, 다시 열었을 때 이어갈 수 있어요.</p></article>
            <article><h2>연결이 끊겨도</h2><p>처음 온라인으로 준비하면 인터넷 없이 운동 화면을 열고 GPS 궤적을 볼 수 있어요.</p></article>
        </section>
        <section className="desktop-start" id="start"><h2>다음 러닝은 휴대폰에서.</h2><p>Safari에서 이 사이트를 열고 공유 메뉴의 ‘홈 화면에 추가’를 선택하세요.</p><p>운동 중에는 화면을 켜두세요. 화면 잠금 중 연속 기록은 지원하지 않아요.</p></section>
        <footer className="desktop-footer"><Brand compact /><span>Run River</span><span>나의 일상에, 한 번의 움직임.</span></footer>
    </main>;
}
