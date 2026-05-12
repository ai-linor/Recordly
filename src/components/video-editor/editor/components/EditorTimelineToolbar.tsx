import {
	CaretDown as ChevronDown,
	CaretUp as ChevronUp,
	Pause,
	Play,
	Plus,
	Scissors,
	SkipBack,
	SkipForward,
	SpeakerHigh as Volume2,
	SpeakerLow as Volume1,
	SpeakerX as VolumeX,
	MagicWand as WandSparkles,
	MagnifyingGlassPlus as ZoomIn,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type EditorTimelineToolbarProps = {
	onAddAnnotation: () => void;
	onAddAudio: () => void;
	onAddZoom: () => void;
	onSuggestZooms: () => void;
	onSplitClip: () => void;
	timelinePlayheadTimeLabel: string;
	timelineDurationLabel: string;
	isPlaying: boolean;
	onSkipBack: () => void;
	onTogglePlayPause: () => void;
	onSkipForward: () => void;
	timelineCollapsed: boolean;
	onToggleTimelineCollapsed: () => void;
	previewVolume: number;
	onToggleMute: () => void;
	onPreviewVolumeChange: (volume: number) => void;
	labels: {
		addLayer: string;
		annotation: string;
		audio: string;
		splitClip: string;
		addZoom: string;
		suggestZooms: string;
		skipBack: string;
		skipForward: string;
		expandTimeline: string;
		collapseTimeline: string;
		muteUnmute: string;
		play: string;
		pause: string;
	};
};

export function EditorTimelineToolbar(props: EditorTimelineToolbarProps) {
	return (
		<div className="relative flex flex-shrink-0 items-center px-1 py-1">
			<div className="z-10 flex min-w-0 flex-1 items-center gap-1.5">
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<Button variant="ghost" size="sm" className="h-7 gap-1 rounded-full border border-foreground/[0.08] bg-foreground/[0.04] px-2.5 text-[11px] text-foreground/65 shadow-[inset_0_1px_0_hsl(var(--foreground)/0.06)] transition-all hover:bg-foreground/[0.08] hover:text-foreground">
							<Plus className="w-3.5 h-3.5" />
							<span className="font-medium">{props.labels.addLayer}</span>
							<ChevronDown className="w-3 h-3" />
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="start" className="bg-editor-surface-alt border-foreground/10">
						<DropdownMenuItem onClick={props.onAddAnnotation} className="text-muted-foreground hover:text-foreground hover:bg-foreground/10 cursor-pointer">{props.labels.annotation}</DropdownMenuItem>
						<DropdownMenuItem onClick={props.onAddAudio} className="text-muted-foreground hover:text-foreground hover:bg-foreground/10 cursor-pointer">{props.labels.audio}</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
				<div className="w-[1px] h-4 bg-foreground/10 mx-1" />
				<Button onClick={props.onAddZoom} variant="ghost" size="icon" className="h-7 w-7 rounded-full text-muted-foreground transition-all hover:bg-[#2563EB]/10 hover:text-[#2563EB]" title={props.labels.addZoom}><ZoomIn className="w-4 h-4" /></Button>
				<Button onClick={props.onSuggestZooms} variant="ghost" size="icon" className="h-7 w-7 rounded-full text-muted-foreground transition-all hover:bg-[#2563EB]/10 hover:text-[#2563EB]" title={props.labels.suggestZooms}><WandSparkles className="w-4 h-4" /></Button>
				<Button onClick={props.onSplitClip} variant="ghost" size="icon" className="h-7 w-7 rounded-full text-muted-foreground transition-all hover:bg-foreground/10 hover:text-foreground" title={props.labels.splitClip}><Scissors className="w-4 h-4" /></Button>
			</div>
			<div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
				<div className="flex items-center gap-1.5 pointer-events-auto">
					<span className="mr-1 text-[10px] font-medium tabular-nums text-muted-foreground">{props.timelinePlayheadTimeLabel}</span>
					<Button variant="ghost" size="icon" className="h-7 w-7 rounded-full text-muted-foreground transition-all hover:bg-foreground/10 hover:text-foreground" title={props.labels.skipBack} onClick={props.onSkipBack}><SkipBack className="w-3.5 h-3.5" weight="fill" /></Button>
					<Button variant="ghost" size="icon" className={`h-7 w-7 rounded-full border border-foreground/10 transition-all shadow-[0_8px_18px_rgba(0,0,0,0.18)] ${props.isPlaying ? "bg-foreground/10 text-foreground hover:bg-foreground/20" : "bg-neutral-800 text-white hover:bg-neutral-700 dark:bg-white dark:text-black dark:hover:bg-white/90"}`} onClick={props.onTogglePlayPause} title={props.isPlaying ? props.labels.pause : props.labels.play}>
						{props.isPlaying ? <Pause className="w-3.5 h-3.5" weight="fill" /> : <Play className="w-3.5 h-3.5" weight="fill" />}
					</Button>
					<Button variant="ghost" size="icon" className="h-7 w-7 rounded-full text-muted-foreground transition-all hover:bg-foreground/10 hover:text-foreground" title={props.labels.skipForward} onClick={props.onSkipForward}><SkipForward className="w-3.5 h-3.5" weight="fill" /></Button>
					<span className="text-[10px] font-medium text-muted-foreground/70 tabular-nums ml-1">{props.timelineDurationLabel}</span>
				</div>
			</div>
			<div className="z-10 ml-auto flex items-center gap-2">
				<Button variant="ghost" size="icon" title={props.timelineCollapsed ? props.labels.expandTimeline : props.labels.collapseTimeline} className="h-7 w-7 rounded-full text-muted-foreground transition-all hover:bg-foreground/10 hover:text-foreground" onClick={props.onToggleTimelineCollapsed}>
					{props.timelineCollapsed ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
				</Button>
				<div className="flex items-center gap-1.5">
					<button type="button" className="text-muted-foreground hover:text-foreground transition-colors" title={props.labels.muteUnmute} onClick={props.onToggleMute}>
						{props.previewVolume <= 0.001 ? <VolumeX className="w-3.5 h-3.5" /> : props.previewVolume < 0.5 ? <Volume1 className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
					</button>
					<div className="relative flex h-7 w-24 select-none items-center overflow-hidden rounded-full border border-foreground/[0.06] bg-editor-bg/80 shadow-[inset_0_1px_0_hsl(var(--foreground)/0.06)]">
						<div className="absolute inset-y-[3px] left-[3px] right-auto rounded-[10px] bg-foreground/[0.08]" style={{ width: props.previewVolume > 0 ? `max(calc(${props.previewVolume * 100}% - 6px), 1.2rem)` : 0 }} />
						<div className="pointer-events-none absolute bottom-[18%] top-[18%] z-10 w-[2px] rounded-full bg-foreground/95 shadow-[0_0_10px_rgba(37,99,235,0.28)]" style={{ left: `calc(${props.previewVolume * 100}% - 8px)` }} />
						<span className="pointer-events-none relative z-10 pl-2 text-[10px] font-medium text-muted-foreground">{Math.round(props.previewVolume * 100)}%</span>
						<input type="range" min="0" max="1" step="0.01" value={props.previewVolume} onChange={(e) => props.onPreviewVolumeChange(Number(e.target.value))} className="absolute inset-0 h-full w-full cursor-ew-resize opacity-0" />
					</div>
				</div>
			</div>
		</div>
	);
}
