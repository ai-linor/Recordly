import { CaretDown as ChevronDown, Check, Crop } from "@phosphor-icons/react";
import type React from "react";
import { Button } from "@/components/ui/button";
import { useEditorUiState } from "@/components/video-editor/editor/hooks/useVideoEditorStore";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
	ASPECT_RATIOS,
	getAspectRatioLabel,
	getAspectRatioValue,
} from "@/utils/aspectRatioUtils";

type EditorPreviewAreaProps = {
	onOpenCropEditor: () => void;
	isCropped: boolean;
	fallbackVideoAspectRatio: number;
	children: React.ReactNode;
};

export function EditorPreviewArea({
	onOpenCropEditor,
	isCropped,
	fallbackVideoAspectRatio,
	children,
}: EditorPreviewAreaProps) {
	const { aspectRatio, setAspectRatio } = useEditorUiState();
	return (
		<div className="flex min-h-0 flex-1 flex-col">
			<div className="relative flex flex-1 min-h-0 flex-col overflow-hidden">
				<div className="flex items-center justify-center gap-2 py-1.5 flex-shrink-0">
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button
								variant="ghost"
								size="sm"
								className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground hover:bg-foreground/10 transition-all gap-1"
							>
								<span className="font-medium">{getAspectRatioLabel(aspectRatio)}</span>
								<ChevronDown className="w-3 h-3" />
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="center" className="bg-editor-surface-alt border-foreground/10">
							{ASPECT_RATIOS.map((ratio) => (
								<DropdownMenuItem
									key={ratio}
									onClick={() => setAspectRatio(ratio)}
									className="text-muted-foreground hover:text-foreground hover:bg-foreground/10 cursor-pointer flex items-center justify-between gap-3"
								>
									<span>{getAspectRatioLabel(ratio)}</span>
									{aspectRatio === ratio && <Check className="w-3 h-3 text-[#2563EB]" />}
								</DropdownMenuItem>
							))}
						</DropdownMenuContent>
					</DropdownMenu>
					<div className="w-[1px] h-4 bg-foreground/20" />
					<Button
						variant="ghost"
						size="sm"
						onClick={onOpenCropEditor}
						className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground hover:bg-foreground/10 transition-all gap-1.5"
					>
						<Crop className="w-3.5 h-3.5" />
						<span className="font-medium">Crop</span>
						{isCropped ? <span className="h-1.5 w-1.5 rounded-full bg-[#2563EB]" /> : null}
					</Button>
				</div>
				<div className="flex w-full min-h-0 flex-1 items-stretch" style={{ flex: "1 1 auto", margin: "6px 0 0" }}>
					<div className="flex min-w-0 flex-1 items-center justify-center px-1">
						<div
							className="relative overflow-hidden rounded-[30px]"
							style={{
								width: "auto",
								height: "100%",
								aspectRatio: getAspectRatioValue(aspectRatio, fallbackVideoAspectRatio),
								maxWidth: "100%",
								margin: "0 auto",
								boxSizing: "border-box",
							}}
						>
							{children}
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
