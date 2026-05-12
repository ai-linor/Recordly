import type React from "react";

type EditorHeaderProps = {
	children: React.ReactNode;
};

export function EditorHeader({ children }: EditorHeaderProps) {
	return (
		<div
			className="relative flex h-11 flex-shrink-0 items-center justify-between bg-editor-header/88 px-5 backdrop-blur-md border-b border-foreground/10 z-50"
			style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
		>
			{children}
		</div>
	);
}
