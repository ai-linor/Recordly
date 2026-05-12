import type React from "react";
import { useEditorUiState } from "@/components/video-editor/editor/hooks/useVideoEditorStore";

type EditorTimelineAreaProps = {
	children: React.ReactNode;
};

export function EditorTimelineArea({ children }: EditorTimelineAreaProps) {
	const { timelineCollapsed } = useEditorUiState();
	return (
		<div
			className="flex-shrink-0 flex flex-col"
			style={{
				height: timelineCollapsed ? undefined : "15%",
				minHeight: timelineCollapsed ? 0 : 160,
			}}
		>
			{children}
		</div>
	);
}
