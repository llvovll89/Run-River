import type {ReactNode} from "react";

// 하위 화면은 하단 탐색으로 오가므로 브랜드 줄 없이 제목부터 보여준다.
export default function ScreenHeader({title, description, action}: {title: string; description?: string; action?: ReactNode}) {
    return <header className="screen-header">
        <div className="screen-header-top"><h1>{title}</h1>{action}</div>
        {description && <p>{description}</p>}
    </header>;
}
