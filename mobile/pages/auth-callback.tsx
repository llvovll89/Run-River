import Link from "next/link";

export default function MobileAuthCallback() {
    return (
        <main className="p-5">
            <p>이메일 인증을 완료한 뒤 앱에서 이메일과 비밀번호로 로그인해주세요.</p>
            <Link href="/auth/">로그인으로 이동</Link>
        </main>
    );
}
