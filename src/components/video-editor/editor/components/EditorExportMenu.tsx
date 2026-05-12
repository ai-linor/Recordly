import { DownloadSimple as Download } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ExportSettingsMenu } from "@/components/video-editor/ExportSettingsMenu";

type EditorExportMenuLabels = {
	export: string;
	exporting: string;
	renderingFile: string;
	cancel: string;
	processingAudioEdits: string;
	exportIssue: string;
	saveAgain: string;
	close: string;
	exportComplete: string;
	savedSuccessfully: string;
	showInFolder: string;
	done: string;
};

type EditorExportMenuProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onOpenClick: () => void;
	isExporting: boolean;
	exportError: string | null;
	exportedFilePath: string | null | undefined;
	hasPendingExportSave: boolean;
	onCancelExport: () => void;
	onRetrySaveExport: () => void;
	onClose: () => void;
	onRevealExportedFile: () => void;
	isLightningExportInProgress: boolean;
	isLegacyExportInProgress: boolean;
	onOpenLightningIssues: () => Promise<void>;
	isExportPreparing: boolean;
	isExportSaving: boolean;
	isExportFinalSaveIndeterminate: boolean;
	isRenderingAudio: boolean;
	exportProgressPercentage: number;
	exportPercentLabel: string;
	exportRenderSpeedLabel: string | null | undefined;
	exportRuntimeLabel: string | null | undefined;
	exportNativeSkipLabel: string | null | undefined;
	exportSettingsMenuProps: React.ComponentProps<typeof ExportSettingsMenu>;
	labels: EditorExportMenuLabels;
};

export function EditorExportMenu(props: EditorExportMenuProps) {
	return (
		<DropdownMenu open={props.open} onOpenChange={props.onOpenChange} modal={false}>
			<DropdownMenuTrigger asChild>
				<Button
					type="button"
					onClick={props.onOpenClick}
					className="inline-flex h-8 min-w-[112px] items-center justify-center gap-2 rounded-[5px] bg-[#2563EB] px-4.5 text-white transition-colors hover:bg-[#2563EB]/92"
				>
					<Download className="h-4 w-4" />
					<span className="text-sm font-semibold tracking-tight">{props.labels.export}</span>
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" sideOffset={10} className="w-[360px] border-none bg-transparent p-0 shadow-none">
				{props.isExporting ? (
					<div className="rounded-2xl border border-foreground/10 bg-editor-surface p-4 text-foreground shadow-2xl">
						<div className="mb-3 flex items-center justify-between gap-3">
							<div>
								<p className="text-sm font-semibold text-foreground">{props.labels.exporting}</p>
								<p className="text-xs text-muted-foreground">{props.labels.renderingFile}</p>
								{props.isLightningExportInProgress ? (
									<p className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground/70">
										PLEASE
										<button
											type="button"
											onClick={() => void props.onOpenLightningIssues()}
											className="underline decoration-slate-500/70 underline-offset-2 transition-colors hover:text-foreground"
										>
											report bugs
										</button>
										with Lightning export
										<span aria-hidden="true">{"\u{1F64F}"}</span>
									</p>
								) : null}
								{props.isLegacyExportInProgress ? (
									<p className="mt-1 text-[11px] text-muted-foreground/70">
										Export too slow? Cancel and try Lightning export!
									</p>
								) : null}
							</div>
							<Button type="button" variant="outline" onClick={props.onCancelExport} className="h-8 border-red-500/20 bg-red-500/10 px-3 text-xs text-red-400 hover:bg-red-500/20">
								{props.labels.cancel}
							</Button>
						</div>
						<div className="h-2 overflow-hidden rounded-full border border-foreground/5 bg-foreground/5">
							{props.isExportPreparing || props.isExportSaving || props.isExportFinalSaveIndeterminate ? (
								<div className="indeterminate-progress h-full rounded-full bg-transparent" />
							) : (
								<div className="h-full bg-[#2563EB] transition-all duration-300 ease-out" style={{ width: `${Math.min(props.exportProgressPercentage, 100)}%` }} />
							)}
						</div>
						<p className="mt-2 text-xs text-muted-foreground">{props.exportPercentLabel}</p>
						{props.isRenderingAudio ? (
							<p className="mt-1 text-[11px] text-muted-foreground/70">{props.labels.processingAudioEdits}</p>
						) : props.exportRenderSpeedLabel ? (
							<p className="mt-1 text-[11px] text-muted-foreground/70">{props.exportRenderSpeedLabel}</p>
						) : null}
						{props.exportRuntimeLabel ? <p className="mt-1 text-[11px] text-muted-foreground/70">Path: {props.exportRuntimeLabel}</p> : null}
						{props.exportNativeSkipLabel ? <p className="mt-1 text-[11px] text-amber-500/80">{props.exportNativeSkipLabel}</p> : null}
					</div>
				) : props.exportError ? (
					<div className="rounded-2xl border border-foreground/10 bg-editor-surface p-4 text-foreground shadow-2xl">
						<p className="text-sm font-semibold text-foreground">{props.labels.exportIssue}</p>
						{props.exportRuntimeLabel ? <p className="mt-1 text-[11px] text-muted-foreground/70">Path: {props.exportRuntimeLabel}</p> : null}
						<p className="mt-1 whitespace-pre-line text-xs leading-relaxed text-muted-foreground">{props.exportError}</p>
						<div className="mt-4 flex gap-2">
							{props.hasPendingExportSave ? (
								<Button type="button" onClick={props.onRetrySaveExport} className="h-8 flex-1 rounded-[5px] bg-[#2563EB] text-xs font-semibold text-white hover:bg-[#2563EB]/92">
									{props.labels.saveAgain}
								</Button>
							) : null}
							<Button type="button" variant="outline" onClick={props.onClose} className="h-8 flex-1 border-foreground/10 bg-foreground/5 text-xs text-muted-foreground hover:bg-foreground/10">
								{props.labels.close}
							</Button>
						</div>
					</div>
				) : props.exportedFilePath ? (
					<div className="rounded-2xl border border-foreground/10 bg-editor-surface p-4 text-foreground shadow-2xl">
						<p className="text-sm font-semibold text-foreground">{props.labels.exportComplete}</p>
						<p className="mt-1 text-xs text-muted-foreground">{props.labels.savedSuccessfully}</p>
						{props.exportRuntimeLabel ? <p className="mt-1 text-[11px] text-muted-foreground/70">Path: {props.exportRuntimeLabel}</p> : null}
						<p className="mt-3 truncate text-xs text-muted-foreground/70">{props.exportedFilePath.split("/").pop()}</p>
						<div className="mt-4 flex gap-2">
							<Button type="button" onClick={props.onRevealExportedFile} className="h-8 flex-1 rounded-[5px] bg-[#2563EB] text-xs font-semibold text-white hover:bg-[#2563EB]/92">
								{props.labels.showInFolder}
							</Button>
							<Button type="button" variant="outline" onClick={props.onClose} className="h-8 flex-1 border-foreground/10 bg-foreground/5 text-xs text-muted-foreground hover:bg-foreground/10">
								{props.labels.done}
							</Button>
						</div>
					</div>
				) : (
					<ExportSettingsMenu {...props.exportSettingsMenuProps} className="shadow-2xl" />
				)}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
