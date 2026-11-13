import type {ReactNode} from "react";
import Brand from "@/components/Brand";

export default function ScreenHeader({title, description, action}: {title: string; description?: string; action?: ReactNode}) {
    return <header className="screen-header">
        <div className="screen-header-top"><a href="/" aria-label="홈으로 가기"><Brand /></a>{action}</div>
        <h1>{title}</h1>
        {description && <p>{description}</p>}
    </header>;
}
