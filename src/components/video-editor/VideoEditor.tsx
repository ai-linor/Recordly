import {
	ClosedCaptioning,
	Cursor,
	FolderOpen,
	Gear,
	Camera as PhCameraRegular,
	PuzzlePiece,
	ArrowClockwise as Redo2,
	Sparkle,
	ArrowCounterClockwise as Undo2,
	X,
} from "@phosphor-icons/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Toaster } from "@/components/ui/sonner";
import { useI18n } from "@/contexts/I18nContext";
import { useShortcuts } from "@/contexts/ShortcutsContext";
import {
	calculateOutputDimensions,
	DEFAULT_MP4_CODEC,
	type ExportBackendPreference,
	type ExportEncodingMode,
	type ExportFormat,
	type ExportMp4FrameRate,
	type ExportPipelineModel,
	type ExportProgress,
	type ExportQuality,
	type ExportRenderBackend,
	type ExportSettings,
	GIF_SIZE_PRESETS,
	GifExporter,
	type GifFrameRate,
	type GifSizePreset,
	isValidMp4FrameRate,
	ModernVideoExporter,
	probeSupportedMp4Dimensions,
	type SupportedMp4Dimensions,
	VideoExporter,
} from "@/lib/exporter";
import { getMp4ExportBitrate, getSourceQualityBitrate } from "@/lib/exporter/exportBitrate";
import {
	canUseInMemoryExportSaveFallback,
	describeBlockedInMemoryExportSave,
} from "@/lib/exporter/exportSavePolicy";
import { matchesShortcut } from "@/lib/shortcuts";
import { type AspectRatio } from "@/utils/aspectRatioUtils";
import {
	calculateMp4ExportDimensions,
	calculateMp4SourceDimensions,
} from "./exportDimensions";

const PhCursorFill = (props: { className?: string; weight?: "fill" | "regular" }) => (
	<Cursor weight="fill" className={props.className} />
);
const PhCamera = (props: { className?: string; weight?: "fill" | "regular" }) => (
	<PhCameraRegular weight={props.weight ?? "regular"} className={props.className} />
);
const PhCaptions = (props: { className?: string; weight?: "fill" | "regular" }) => (
	<ClosedCaptioning weight={props.weight ?? "regular"} className={props.className} />
);
const PhPuzzle = (props: { className?: string; weight?: "fill" | "regular" }) => (
	<PuzzlePiece weight={props.weight ?? "regular"} className={props.className} />
);
const PhSparkle = (props: { className?: string; weight?: "fill" | "regular" }) => (
	<Sparkle weight={props.weight ?? "regular"} className={props.className} />
);
const PhSettings = (props: { className?: string; weight?: "fill" | "regular" }) => (
	<Gear weight={props.weight ?? "regular"} className={props.className} />
);

import { extensionHost } from "@/lib/extensions";
import { CropControl } from "./CropControl";
import ExtensionManager from "./ExtensionManager";
import {
	loadEditorPreferences,
	saveEditorPreferences,
	type EditorPresetSnapshot,
} from "./editorPreferences";
import ProjectBrowserDialog, { type ProjectLibraryEntry } from "./ProjectBrowserDialog";
import {
	createProjectData,
	deriveNextId,
	type EditorProjectData,
	fromFileUrl,
	resolveVideoUrl,
	stripPersistedDevMotionBlurSettings,
	toFileUrl,
} from "./projectPersistence";
import { SettingsPanel } from "./SettingsPanel";
import { useVideoEditorAudio } from "./audio/useVideoEditorAudio";
import {
	APP_HEADER_ICON_BUTTON_CLASS,
	DiscordLinkButton,
	FeedbackDialog,
	openExternalLink,
	RECORDLY_ISSUES_URL,
} from "./TutorialHelp";
import TimelineEditor, { type TimelineEditorHandle } from "./timeline/TimelineEditor";
import { normalizeCursorTelemetry } from "./timeline/zoomSuggestionUtils";
import type { SourceAudioTrackSettings } from "@/components/video-editor/audio/audioTypes";
import {
	type AnnotationRegion,
	type AudioRegion,
	type AutoCaptionSettings,
	type CaptionCue,
	type ClipRegion,
	type CropRegion,
	type CursorStyle,
	type CursorTelemetryPoint,
	clipsToTrims,
	DEFAULT_AUTO_CAPTION_SETTINGS,
	DEFAULT_CONNECTED_ZOOM_DURATION_MS,
	DEFAULT_CONNECTED_ZOOM_EASING,
	DEFAULT_CONNECTED_ZOOM_GAP_MS,
	DEFAULT_CROP_REGION,
	DEFAULT_CURSOR_STYLE,
	DEFAULT_WEBCAM_OVERLAY,
	DEFAULT_WEBCAM_TIME_OFFSET_MS,
	DEFAULT_ZOOM_IN_DURATION_MS,
	DEFAULT_ZOOM_IN_EASING,
	DEFAULT_ZOOM_IN_OVERLAP_MS,
	DEFAULT_ZOOM_MOTION_BLUR_TUNING,
	DEFAULT_ZOOM_OUT_DURATION_MS,
	DEFAULT_ZOOM_OUT_EASING,
	type EditorEffectSection,
	extendAutoFullTrackClip,
	getClipSourceEndMs,
	getTimelineDurationMs,
	type Padding,
	mapSourceTimeToTimelineTime as resolveSourceTimeToTimelineTime,
	mapTimelineTimeToSourceTime as resolveTimelineTimeToSourceTime,
	type SpeedRegion,
	type TrimRegion,
	trimsToClips,
	type WebcamOverlaySettings,
	type ZoomMotionBlurTuning,
	type ZoomRegion,
	type ZoomTransitionEasing,
} from "./types";
import VideoPlayback, { VideoPlaybackRef } from "./VideoPlayback";
import {
	buildLoopedCursorTelemetry,
	getDisplayedTimelineWindowMs,
} from "./videoPlayback/cursorLoopTelemetry";
import {
	useEditorSettings,
	usePlayback,
	type EditorProjectFile,
	useProject,
	useProjectBootstrapController,
	useTimelineActions,
	useTimelineState,
	useExport,
	useSmokeExportController,
	useExportUiController,
	useVideoEditorProject,
	useVideoEditorThumbnail,
	useWhisperCaptions,
	useEditorUiState,
	useVideoEditorStore,
} from "./editor/hooks";
import { EditorHeader } from "./editor/components/EditorHeader";
import { EditorExportMenu } from "./editor/components/EditorExportMenu";
import { EditorPreviewArea } from "./editor/components/EditorPreviewArea";
import { PresetManager } from "./editor/components/PresetManager";
import { EditorSidebar } from "./editor/components/EditorSidebar";
import { EditorTimelineArea } from "./editor/components/EditorTimelineArea";
import { EditorTimelineToolbar } from "./editor/components/EditorTimelineToolbar";

type PendingExportSave = {
	fileName: string;
	// Exactly one of these is populated. `tempFilePath` is the preferred form
	// for MP4 exports — the main process holds the finished file on disk, so
	// "Save Again" just renames it instead of round-tripping through the
	// renderer's ArrayBuffer heap.
	arrayBuffer?: ArrayBuffer;
	tempFilePath?: string;
};

type CancelableExporter = {
	cancel(): void;
};

type SmokeExportConfig = {
	enabled: boolean;
	inputPath: string | null;
	outputPath: string | null;
	useNativeExport: boolean;
	encodingMode?: ExportEncodingMode;
	shadowIntensity?: number;
	webcamInputPath?: string | null;
	webcamShadow?: number;
	webcamSize?: number;
	pipelineModel?: ExportPipelineModel;
	backendPreference?: ExportBackendPreference;
	renderBackend?: ExportRenderBackend;
	maxEncodeQueue?: number;
	maxDecodeQueue?: number;
	maxPendingFrames?: number;
	projectPath?: string | null;
	quality?: ExportQuality;
	fps?: ExportMp4FrameRate;
};

const EXPORT_BLOB_STREAM_CHUNK_BYTES = 16 * 1024 * 1024;

async function streamExportBlobToTempFile(blob: Blob, extension: string): Promise<string | null> {
	if (
		typeof window === "undefined" ||
		!window.electronAPI?.openExportStream ||
		!window.electronAPI?.writeExportStreamChunk ||
		!window.electronAPI?.closeExportStream
	) {
		return null;
	}

	const openResult = await window.electronAPI.openExportStream({ extension });
	if (!openResult.success || !openResult.streamId || !openResult.tempPath) {
		throw new Error(openResult.error || "Failed to open export stream");
	}

	const { streamId } = openResult;
	let position = 0;

	try {
		while (position < blob.size) {
			const chunk = blob.slice(position, position + EXPORT_BLOB_STREAM_CHUNK_BYTES);
			const chunkBuffer = await chunk.arrayBuffer();
			const writeResult = await window.electronAPI.writeExportStreamChunk(
				streamId,
				position,
				new Uint8Array(chunkBuffer),
			);
			if (!writeResult.success) {
				throw new Error(writeResult.error || "Failed to write export stream chunk");
			}
			position += chunkBuffer.byteLength;
		}

		const closeResult = await window.electronAPI.closeExportStream(streamId);
		if (!closeResult.success || !closeResult.tempPath) {
			throw new Error(closeResult.error || "Failed to close export stream");
		}

		return closeResult.tempPath;
	} catch (error) {
		try {
			await window.electronAPI.closeExportStream(streamId, { abort: true });
		} catch {
			// Best-effort cleanup; preserve the original error below.
		}
		throw error;
	}
}

type DevOpenRecordingConfig = {
	inputPath: string | null;
	webcamInputPath: string | null;
};

async function writeSmokeExportReport(
	outputPath: string | null,
	report: Record<string, unknown>,
): Promise<void> {
	if (!outputPath || typeof window === "undefined") {
		return;
	}

	try {
		const reportBytes = new TextEncoder().encode(JSON.stringify(report, null, 2));
		const reportBuffer = reportBytes.buffer.slice(
			reportBytes.byteOffset,
			reportBytes.byteOffset + reportBytes.byteLength,
		) as ArrayBuffer;
		await window.electronAPI.writeExportedVideoToPath(
			reportBuffer,
			`${outputPath}.report.json`,
		);
	} catch (error) {
		console.error("[smoke-export] Failed to write report", error);
	}
}

const DEFAULT_MP4_EXPORT_FRAME_RATE: ExportMp4FrameRate = 30;
const PROJECT_AUTOSAVE_DELAY_MS = 1000;
const EXPORT_ERROR_TOAST_DURATION_MS = 20000;

function summarizeErrorMessage(message: string): string {
	const firstLine = message
		.split(/\r?\n/)
		.map((line) => line.trim())
		.find((line) => line.length > 0);

	return firstLine ?? message;
}

function showExportErrorToast(message: string) {
	const summary = summarizeErrorMessage(message);
	toast.error(summary, {
		description: summary === message ? undefined : message,
		duration: EXPORT_ERROR_TOAST_DURATION_MS,
	});
}

function cloneStructured<T>(value: T): T {
	return globalThis.structuredClone(value);
}

function parseSmokeExportNumber(value: string | null): number | undefined {
	if (value === null) {
		return undefined;
	}

	const parsed = Number.parseInt(value, 10);
	return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function parseSmokeExportNonNegativeNumber(value: string | null): number | undefined {
	if (value === null) {
		return undefined;
	}

	const parsed = Number.parseFloat(value);
	return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}

function parseSmokeExportQuality(value: string | null): ExportQuality | undefined {
	if (value === "medium" || value === "good" || value === "high" || value === "source") {
		return value;
	}
	return undefined;
}

function parseSmokeExportFps(value: string | null): ExportMp4FrameRate | undefined {
	if (value === null) return undefined;
	const parsed = Number.parseInt(value, 10);
	return isValidMp4FrameRate(parsed) ? parsed : undefined;
}

function parseSmokeRenderBackend(value: string | null): ExportRenderBackend | undefined {
	return value === "webgl" || value === "webgpu" ? value : undefined;
}

function getSmokeExportConfig(search: string): SmokeExportConfig {
	const params = new URLSearchParams(search);
	const enabled = params.get("smokeExport") === "1";

	return {
		enabled,
		inputPath: enabled ? params.get("smokeInput") : null,
		outputPath: enabled ? params.get("smokeOutput") : null,
		useNativeExport: enabled ? params.get("smokeUseNativeExport") === "1" : false,
		encodingMode:
			enabled && params.get("smokeEncodingMode") === "fast"
				? "fast"
				: enabled && params.get("smokeEncodingMode") === "balanced"
					? "balanced"
					: enabled && params.get("smokeEncodingMode") === "quality"
						? "quality"
						: undefined,
		shadowIntensity: enabled
			? parseSmokeExportNonNegativeNumber(params.get("smokeShadowIntensity"))
			: undefined,
		webcamInputPath: enabled ? params.get("smokeWebcamInput") : null,
		webcamShadow: enabled
			? parseSmokeExportNonNegativeNumber(params.get("smokeWebcamShadow"))
			: undefined,
		webcamSize: enabled
			? parseSmokeExportNonNegativeNumber(params.get("smokeWebcamSize"))
			: undefined,
		pipelineModel:
			enabled && params.get("smokePipelineModel") === "modern"
				? "modern"
				: enabled && params.get("smokePipelineModel") === "legacy"
					? "legacy"
					: undefined,
		backendPreference:
			enabled && params.get("smokeBackendPreference") === "auto"
				? "auto"
				: enabled && params.get("smokeBackendPreference") === "webcodecs"
					? "webcodecs"
					: enabled && params.get("smokeBackendPreference") === "breeze"
						? "breeze"
						: undefined,
		renderBackend: enabled
			? parseSmokeRenderBackend(params.get("smokeRenderBackend"))
			: undefined,
		maxEncodeQueue: enabled
			? parseSmokeExportNumber(params.get("smokeMaxEncodeQueue"))
			: undefined,
		maxDecodeQueue: enabled
			? parseSmokeExportNumber(params.get("smokeMaxDecodeQueue"))
			: undefined,
		maxPendingFrames: enabled
			? parseSmokeExportNumber(params.get("smokeMaxPendingFrames"))
			: undefined,
		projectPath: enabled ? params.get("smokeProject") : null,
		quality: enabled ? parseSmokeExportQuality(params.get("smokeQuality")) : undefined,
		fps: enabled ? parseSmokeExportFps(params.get("smokeFps")) : undefined,
	};
}

function getDevOpenRecordingConfig(search: string): DevOpenRecordingConfig {
	const params = new URLSearchParams(search);
	return {
		inputPath: params.get("devOpenInput"),
		webcamInputPath: params.get("devOpenWebcam"),
	};
}

function isComparableObject(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

function areDeepEqual(left: unknown, right: unknown): boolean {
	if (Object.is(left, right)) {
		return true;
	}

	if (Array.isArray(left) || Array.isArray(right)) {
		if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) {
			return false;
		}

		for (let index = 0; index < left.length; index += 1) {
			if (!areDeepEqual(left[index], right[index])) {
				return false;
			}
		}

		return true;
	}

	if (!isComparableObject(left) || !isComparableObject(right)) {
		return false;
	}

	const leftKeys = Object.keys(left);
	const rightKeys = Object.keys(right);
	if (leftKeys.length !== rightKeys.length) {
		return false;
	}

	for (const key of leftKeys) {
		if (!(key in right) || !areDeepEqual(left[key], right[key])) {
			return false;
		}
	}

	return true;
}

function getErrorMessage(error: unknown): string {
	if (error instanceof Error) {
		return error.message;
	}

	if (typeof error === "string") {
		return error.replace(/^Error:\s*/i, "");
	}

	return "Something went wrong";
}

export default function VideoEditor() {
	const { t } = useI18n();
	const smokeExportConfig = useMemo(
		() => getSmokeExportConfig(typeof window === "undefined" ? "" : window.location.search),
		[],
	);
	const devOpenRecordingConfig = useMemo(
		() =>
			getDevOpenRecordingConfig(typeof window === "undefined" ? "" : window.location.search),
		[],
	);
	const [appPlatform, setAppPlatform] = useState<string>(
		typeof navigator !== "undefined" && /Mac/i.test(navigator.platform) ? "darwin" : "",
	);
	const initialEditorPreferences = useMemo(() => loadEditorPreferences(), []);
	const [videoPath, setVideoPath] = useState<string | null>(null);
	const [videoSourcePath, setVideoSourcePath] = useState<string | null>(null);
	const autosaveRunnerRef = useRef<(() => Promise<boolean>) | null>(null);
	const projectManager = useProject<EditorProjectData>({
		initialSnapshot: createProjectData("", {}, null),
		autosaveDelayMs: PROJECT_AUTOSAVE_DELAY_MS,
		onRefreshLibrary: async () => {
			const result = await window.electronAPI.listProjectFiles();
			if (!result.success) {
				throw new Error(result.error || "Failed to load project library");
			}
			return result.entries.map(
				(entry) =>
					({
						projectId: entry.path,
						projectName: entry.name,
						videoPath: "",
						projectPath: entry.path,
						...entry,
					}) satisfies EditorProjectFile,
			);
		},
		onLoad: async (projectPath) => {
			const result = await window.electronAPI.openProjectFileAtPath(projectPath);
			if (result.canceled || !result.success || !result.project) {
				return null;
			}
			const candidateProject = result.project as EditorProjectData;
			return {
				project: {
					projectId: result.path ?? projectPath,
					projectName: (result.path ?? projectPath).split(/[\\/]/).pop() ?? "Untitled",
					videoPath: fromFileUrl(candidateProject.videoPath),
					projectPath: result.path ?? projectPath,
					path: result.path ?? projectPath,
					name: (result.path ?? projectPath).split(/[\\/]/).pop() ?? "Untitled",
					updatedAt: Date.now(),
					thumbnailPath: null,
					isCurrent: false,
					isInProjectsDirectory: true,
				},
				snapshot: candidateProject,
			};
		},
		onSave: async () => {
			if (!autosaveRunnerRef.current) {
				return;
			}
			await autosaveRunnerRef.current();
		},
	});
	const currentProjectPath = projectManager.project.projectPath;
	const setCurrentProjectPath = useCallback((next: string | null) => {
		projectManager.updateProject({ projectPath: next }, { markDirty: false });
	}, [projectManager]);
	const projectLibraryEntries = projectManager.projectLibrary as ProjectLibraryEntry[];
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const playback = usePlayback({
		initialIsPlaying: false,
		initialTime: 0,
		initialDuration: 0,
	});
	const isPlaying = playback.isPlaying;
	const currentTime = playback.currentTime;
	const duration = playback.duration;
	const setIsPlaying = useCallback((next: boolean) => {
		if (next) {
			playback.play();
			return;
		}
		playback.pause();
	}, [playback]);
	const setCurrentTime = useCallback((next: number) => {
		playback.seek(next);
	}, [playback]);
	const setDuration = useCallback((next: number) => {
		playback.setDuration(next);
	}, [playback]);
	const { settings, updateSettings } = useEditorSettings({
		wallpaper: initialEditorPreferences.wallpaper,
		shadowIntensity: initialEditorPreferences.shadowIntensity,
		backgroundBlur: initialEditorPreferences.backgroundBlur,
		borderRadius: initialEditorPreferences.borderRadius,
		padding: initialEditorPreferences.padding,
		cursorStyle: initialEditorPreferences.cursorStyle ?? DEFAULT_CURSOR_STYLE,
		cursorSize: initialEditorPreferences.cursorSize,
		cursorSmoothing: initialEditorPreferences.cursorSmoothing,
		cursorMotionBlur: initialEditorPreferences.cursorMotionBlur,
		zoomInDurationMs: initialEditorPreferences.zoomInDurationMs ?? DEFAULT_ZOOM_IN_DURATION_MS,
		zoomInOverlapMs: initialEditorPreferences.zoomInOverlapMs ?? DEFAULT_ZOOM_IN_OVERLAP_MS,
		zoomOutDurationMs: initialEditorPreferences.zoomOutDurationMs ?? DEFAULT_ZOOM_OUT_DURATION_MS,
		connectedZoomGapMs:
			initialEditorPreferences.connectedZoomGapMs ?? DEFAULT_CONNECTED_ZOOM_GAP_MS,
		connectedZoomDurationMs:
			initialEditorPreferences.connectedZoomDurationMs ?? DEFAULT_CONNECTED_ZOOM_DURATION_MS,
		zoomInEasing: initialEditorPreferences.zoomInEasing ?? DEFAULT_ZOOM_IN_EASING,
		zoomOutEasing: initialEditorPreferences.zoomOutEasing ?? DEFAULT_ZOOM_OUT_EASING,
		connectedZoomEasing:
			initialEditorPreferences.connectedZoomEasing ?? DEFAULT_CONNECTED_ZOOM_EASING,
	});
	const wallpaper = settings.wallpaper;
	const shadowIntensity = settings.shadowIntensity;
	const backgroundBlur = settings.backgroundBlur;
	const [zoomMotionBlur, setZoomMotionBlur] = useState(initialEditorPreferences.zoomMotionBlur);
	const [zoomMotionBlurTuning, setZoomMotionBlurTuning] = useState<ZoomMotionBlurTuning>(
		initialEditorPreferences.zoomMotionBlurTuning ?? DEFAULT_ZOOM_MOTION_BLUR_TUNING,
	);
	const [zoomTemporalMotionBlur, setZoomTemporalMotionBlur] = useState(
		initialEditorPreferences.zoomTemporalMotionBlur,
	);
	const [zoomMotionBlurSampleCount, setZoomMotionBlurSampleCount] = useState<number | null>(
		initialEditorPreferences.zoomMotionBlurSampleCount,
	);
	const [zoomMotionBlurShutterFraction, setZoomMotionBlurShutterFraction] = useState<
		number | null
	>(initialEditorPreferences.zoomMotionBlurShutterFraction);
	const [autoApplyFreshRecordingAutoZooms, setAutoApplyFreshRecordingAutoZooms] = useState(
		initialEditorPreferences.autoApplyFreshRecordingAutoZooms,
	);
	const [connectZooms, setConnectZooms] = useState(initialEditorPreferences.connectZooms);
	const zoomInDurationMs = settings.zoomInDurationMs;
	const zoomInOverlapMs = settings.zoomInOverlapMs;
	const zoomOutDurationMs = settings.zoomOutDurationMs;
	const connectedZoomGapMs = settings.connectedZoomGapMs;
	const connectedZoomDurationMs = settings.connectedZoomDurationMs;
	const zoomInEasing = settings.zoomInEasing;
	const zoomOutEasing = settings.zoomOutEasing;
	const connectedZoomEasing = settings.connectedZoomEasing;
	const [showCursor, setShowCursor] = useState(initialEditorPreferences.showCursor);
	const [loopCursor, setLoopCursor] = useState(initialEditorPreferences.loopCursor);
	const cursorStyle = settings.cursorStyle;
	const cursorSize = settings.cursorSize;
	const cursorSmoothing = settings.cursorSmoothing;
	const [cursorSpringStiffnessMultiplier, setCursorSpringStiffnessMultiplier] = useState(
		initialEditorPreferences.cursorSpringStiffnessMultiplier,
	);
	const [cursorSpringDampingMultiplier, setCursorSpringDampingMultiplier] = useState(
		initialEditorPreferences.cursorSpringDampingMultiplier,
	);
	const [cursorSpringMassMultiplier, setCursorSpringMassMultiplier] = useState(
		initialEditorPreferences.cursorSpringMassMultiplier,
	);
	const [cameraSpringStiffnessMultiplier, setCameraSpringStiffnessMultiplier] = useState(
		initialEditorPreferences.cameraSpringStiffnessMultiplier,
	);
	const [cameraSpringDampingMultiplier, setCameraSpringDampingMultiplier] = useState(
		initialEditorPreferences.cameraSpringDampingMultiplier,
	);
	const [cameraSpringMassMultiplier, setCameraSpringMassMultiplier] = useState(
		initialEditorPreferences.cameraSpringMassMultiplier,
	);
	const [sessionShowCursorOverride, setSessionShowCursorOverride] = useState<boolean | null>(
		null,
	);
	const [sessionNativeCaptureUnavailable, setSessionNativeCaptureUnavailable] = useState(false);
	const [nativeCaptureUnavailableModalOpen, setNativeCaptureUnavailableModalOpen] =
		useState(false);
	const [zoomSmoothness, setZoomSmoothness] = useState(0.5);
	const [zoomClassicMode, setZoomClassicMode] = useState(false);
	const cursorMotionBlur = settings.cursorMotionBlur;
	const [cursorClickBounce, setCursorClickBounce] = useState(
		initialEditorPreferences.cursorClickBounce,
	);
	const [cursorClickBounceDuration, setCursorClickBounceDuration] = useState(
		initialEditorPreferences.cursorClickBounceDuration,
	);
	const [cursorSway, setCursorSway] = useState(initialEditorPreferences.cursorSway);
	const borderRadius = settings.borderRadius;
	const padding = settings.padding;
	const [frame, setFrame] = useState<string | null>(initialEditorPreferences.frame);
	const [cropRegion, setCropRegion] = useState<CropRegion>(DEFAULT_CROP_REGION);
	const [webcam, setWebcam] = useState<WebcamOverlaySettings>(
		initialEditorPreferences.webcam ?? DEFAULT_WEBCAM_OVERLAY,
	);
	const [resolvedWebcamVideoUrl, setResolvedWebcamVideoUrl] = useState<string | null>(null);
	const timelineState = useTimelineState({
		zoomRegions: [],
		clipRegions: [],
		speedRegions: [],
		annotationRegions: [],
		audioRegions: [],
		autoCaptions: [],
		selectedZoomId: null,
		selectedClipId: null,
		selectedAnnotationId: null,
		selectedAudioId: null,
	});
	const zoomRegions = timelineState.state.zoomRegions;
	const [cursorTelemetry, setCursorTelemetry] = useState<CursorTelemetryPoint[]>([]);
	// Tracks the videoSourcePath for which the cursor telemetry IPC has already
	// resolved. The smoke-export auto-trigger waits on this so long recordings
	// still bake cursor/zoom animations into the output — without it, the
	// auto-export fires as soon as the video loads and the telemetry arrives
	// after encoding has started.
	const [cursorTelemetrySourcePath, setCursorTelemetrySourcePath] = useState<string | null>(null);
	const selectedZoomId = timelineState.state.selectedZoomId;
	const [trimRegions, setTrimRegions] = useState<TrimRegion[]>([]);
	const clipRegions = timelineState.state.clipRegions;
	const selectedClipId = timelineState.state.selectedClipId;
	const speedRegions = timelineState.state.speedRegions;
	const annotationRegions = timelineState.state.annotationRegions;
	const selectedAnnotationId = timelineState.state.selectedAnnotationId;
	const audioRegions = timelineState.state.audioRegions;
	const selectedAudioId = timelineState.state.selectedAudioId;
	const [sourceAudioTrackSettingsByClip, setSourceAudioTrackSettingsByClip] = useState<
		Record<string, SourceAudioTrackSettings>
	>({});
	const [defaultSourceAudioTrackSettings, setDefaultSourceAudioTrackSettings] = useState<
		SourceAudioTrackSettings
	>({});
	const [hasClipSourceAudio, setHasClipSourceAudio] = useState(false);
	const autoCaptions = timelineState.state.autoCaptions;
	const setWallpaper = useCallback((next: string) => {
		updateSettings({ wallpaper: next });
	}, [updateSettings]);
	const setShadowIntensity = useCallback((next: number) => {
		updateSettings({ shadowIntensity: next });
	}, [updateSettings]);
	const setBackgroundBlur = useCallback((next: number) => {
		updateSettings({ backgroundBlur: next });
	}, [updateSettings]);
	const setZoomInDurationMs = useCallback((next: number) => {
		updateSettings({ zoomInDurationMs: next });
	}, [updateSettings]);
	const setZoomInOverlapMs = useCallback((next: number) => {
		updateSettings({ zoomInOverlapMs: next });
	}, [updateSettings]);
	const setZoomOutDurationMs = useCallback((next: number) => {
		updateSettings({ zoomOutDurationMs: next });
	}, [updateSettings]);
	const setConnectedZoomGapMs = useCallback((next: number) => {
		updateSettings({ connectedZoomGapMs: next });
	}, [updateSettings]);
	const setConnectedZoomDurationMs = useCallback((next: number) => {
		updateSettings({ connectedZoomDurationMs: next });
	}, [updateSettings]);
	const setZoomInEasing = useCallback((next: ZoomTransitionEasing) => {
		updateSettings({ zoomInEasing: next });
	}, [updateSettings]);
	const setZoomOutEasing = useCallback((next: ZoomTransitionEasing) => {
		updateSettings({ zoomOutEasing: next });
	}, [updateSettings]);
	const setConnectedZoomEasing = useCallback((next: ZoomTransitionEasing) => {
		updateSettings({ connectedZoomEasing: next });
	}, [updateSettings]);
	const setCursorStyle = useCallback((next: CursorStyle) => {
		updateSettings({ cursorStyle: next });
	}, [updateSettings]);
	const setCursorSize = useCallback((next: number) => {
		updateSettings({ cursorSize: next });
	}, [updateSettings]);
	const setCursorSmoothing = useCallback((next: number) => {
		updateSettings({ cursorSmoothing: next });
	}, [updateSettings]);
	const setCursorMotionBlur = useCallback((next: number) => {
		updateSettings({ cursorMotionBlur: next });
	}, [updateSettings]);
	const setBorderRadius = useCallback((next: number) => {
		updateSettings({ borderRadius: next });
	}, [updateSettings]);
	const setPadding = useCallback((next: Padding) => {
		updateSettings({ padding: next });
	}, [updateSettings]);
	const setZoomRegions = useCallback(
		(next: ZoomRegion[] | ((prev: ZoomRegion[]) => ZoomRegion[])) => {
			timelineState.updateState({
				zoomRegions: typeof next === "function" ? next(zoomRegions) : next,
			});
		},
		[timelineState, zoomRegions],
	);
	const setClipRegions = useCallback(
		(next: ClipRegion[] | ((prev: ClipRegion[]) => ClipRegion[])) => {
			timelineState.updateState({
				clipRegions: typeof next === "function" ? next(clipRegions) : next,
			});
		},
		[timelineState, clipRegions],
	);
	const setSpeedRegions = useCallback(
		(next: SpeedRegion[] | ((prev: SpeedRegion[]) => SpeedRegion[])) => {
			timelineState.updateState({
				speedRegions: typeof next === "function" ? next(speedRegions) : next,
			});
		},
		[timelineState, speedRegions],
	);
	const setAnnotationRegions = useCallback(
		(next: AnnotationRegion[] | ((prev: AnnotationRegion[]) => AnnotationRegion[])) => {
			timelineState.updateState({
				annotationRegions: typeof next === "function" ? next(annotationRegions) : next,
			});
		},
		[timelineState, annotationRegions],
	);
	const setAudioRegions = useCallback(
		(next: AudioRegion[] | ((prev: AudioRegion[]) => AudioRegion[])) => {
			timelineState.updateState({
				audioRegions: typeof next === "function" ? next(audioRegions) : next,
			});
		},
		[timelineState, audioRegions],
	);
	const setAutoCaptions = useCallback(
		(next: CaptionCue[] | ((prev: CaptionCue[]) => CaptionCue[])) => {
			timelineState.updateState({
				autoCaptions: typeof next === "function" ? next(autoCaptions) : next,
			});
		},
		[timelineState, autoCaptions],
	);
	const setSelectedZoomId = useCallback((next: string | null) => {
		timelineState.updateState({ selectedZoomId: next });
	}, [timelineState]);
	const setSelectedClipId = useCallback((next: string | null) => {
		timelineState.updateState({ selectedClipId: next });
	}, [timelineState]);
	const setSelectedAnnotationId = useCallback((next: string | null) => {
		timelineState.updateState({ selectedAnnotationId: next });
	}, [timelineState]);
	const setSelectedAudioId = useCallback((next: string | null) => {
		timelineState.updateState({ selectedAudioId: next });
	}, [timelineState]);
	const [autoCaptionSettings, setAutoCaptionSettings] = useState<AutoCaptionSettings>(
		DEFAULT_AUTO_CAPTION_SETTINGS,
	);
	const [whisperExecutablePath, setWhisperExecutablePath] = useState<string | null>(
		initialEditorPreferences.whisperExecutablePath,
	);
	const [whisperModelPath, setWhisperModelPath] = useState<string | null>(
		initialEditorPreferences.whisperModelPath,
	);
	const [downloadedWhisperModelPath, setDownloadedWhisperModelPath] = useState<string | null>(
		null,
	);
	const [whisperModelDownloadStatus, setWhisperModelDownloadStatus] = useState<
		"idle" | "downloading" | "downloaded" | "error"
	>(initialEditorPreferences.whisperModelPath ? "downloaded" : "idle");
	const [whisperModelDownloadProgress, setWhisperModelDownloadProgress] = useState(0);
	const [isGeneratingCaptions, setIsGeneratingCaptions] = useState(false);
	const exportState = useExport({
		initialConfig: {
			exportQuality: initialEditorPreferences.exportQuality,
			exportEncodingMode: initialEditorPreferences.exportEncodingMode,
			exportBackendPreference: initialEditorPreferences.exportBackendPreference,
			exportPipelineModel: initialEditorPreferences.exportPipelineModel,
			mp4FrameRate: initialEditorPreferences.mp4FrameRate ?? DEFAULT_MP4_EXPORT_FRAME_RATE,
			exportFormat: initialEditorPreferences.exportFormat,
			gifFrameRate: initialEditorPreferences.gifFrameRate,
			gifLoop: initialEditorPreferences.gifLoop,
			gifSizePreset: initialEditorPreferences.gifSizePreset,
		},
		initialProgress: null as ExportProgress | null,
		initialError: null,
		initialIsExporting: false,
	});
	const isExporting = exportState.isExporting;
	const setIsExporting = exportState.setIsExporting;
	const exportProgress = exportState.progress;
	const setExportProgress = exportState.setProgress;
	const exportError = exportState.error;
	const setExportError = exportState.setError;
	const [previewVolume, setPreviewVolume] = useState(1);
	const applySessionPresentation = useCallback(
		(
			session:
				| {
						hideOverlayCursorByDefault?: boolean;
						nativeCaptureUnavailable?: boolean;
				  }
				| null
				| undefined,
		) => {
			setSessionShowCursorOverride(session?.hideOverlayCursorByDefault ? false : null);
			setSessionNativeCaptureUnavailable(Boolean(session?.nativeCaptureUnavailable));
			setNativeCaptureUnavailableModalOpen(Boolean(session?.nativeCaptureUnavailable));
		},
		[],
	);
	const effectiveShowCursor = sessionShowCursorOverride ?? showCursor;
	const {
		aspectRatio,
		activeEffectSection,
		timelineCollapsed,
		setAspectRatio,
		setActiveEffectSection,
		toggleTimelineCollapsed,
	} = useEditorUiState();
	const { syncUiState, syncPresetBindings, syncSidebarBindings } = useVideoEditorStore(
		(state) => ({
			syncUiState: state.syncUiState,
			syncPresetBindings: state.syncPresetBindings,
			syncSidebarBindings: state.syncSidebarBindings,
		}),
	);
	const exportQuality = exportState.config.exportQuality;
	const exportEncodingMode = exportState.config.exportEncodingMode;
	const exportBackendPreference = exportState.config.exportBackendPreference;
	const exportPipelineModel = exportState.config.exportPipelineModel;
	const mp4FrameRate = exportState.config.mp4FrameRate;
	const exportFormat = exportState.config.exportFormat;
	const gifFrameRate = exportState.config.gifFrameRate;
	const gifLoop = exportState.config.gifLoop;
	const gifSizePreset = exportState.config.gifSizePreset;
	const setExportQuality = useCallback((next: ExportQuality) => {
		exportState.updateConfig({ exportQuality: next });
	}, [exportState]);
	const setExportEncodingMode = useCallback((next: ExportEncodingMode) => {
		exportState.updateConfig({ exportEncodingMode: next });
	}, [exportState]);
	const setExportBackendPreference = useCallback((next: ExportBackendPreference) => {
		exportState.updateConfig({ exportBackendPreference: next });
	}, [exportState]);
	const setExportPipelineModel = useCallback((next: ExportPipelineModel) => {
		exportState.updateConfig({ exportPipelineModel: next });
	}, [exportState]);
	const setMp4FrameRate = useCallback((next: ExportMp4FrameRate) => {
		exportState.updateConfig({ mp4FrameRate: next });
	}, [exportState]);
	const setExportFormat = useCallback((next: ExportFormat) => {
		exportState.updateConfig({ exportFormat: next });
	}, [exportState]);
	const setGifFrameRate = useCallback((next: GifFrameRate) => {
		exportState.updateConfig({ gifFrameRate: next });
	}, [exportState]);
	const setGifLoop = useCallback((next: boolean) => {
		exportState.updateConfig({ gifLoop: next });
	}, [exportState]);
	const setGifSizePreset = useCallback((next: GifSizePreset) => {
		exportState.updateConfig({ gifSizePreset: next });
	}, [exportState]);
	const [exportedFilePath, setExportedFilePath] = useState<string | undefined>(undefined);
	const [hasPendingExportSave, setHasPendingExportSave] = useState(false);
	const [lastSavedSnapshot, setLastSavedSnapshot] = useState<EditorProjectData | null>(null);
	const [showCropModal, setShowCropModal] = useState(false);
	const [previewVersion, setPreviewVersion] = useState(0);
	const [isPreviewReady, setIsPreviewReady] = useState(false);
	const [autoSuggestZoomsTrigger, setAutoSuggestZoomsTrigger] = useState(0);
	const headerLeftControlsPaddingClass = appPlatform === "darwin" ? "pl-[76px]" : "";

	const videoPlaybackRef = useRef<VideoPlaybackRef>(null);
	const projectBrowserTriggerRef = useRef<HTMLButtonElement | null>(null);
	const projectBrowserFallbackTriggerRef = useRef<HTMLButtonElement | null>(null);
	const projectNameInputRef = useRef<HTMLInputElement | null>(null);
	const nextZoomIdRef = useRef(1);
	const nextClipIdRef = useRef(1);
	const nextAudioIdRef = useRef(1);
	const clipInitializedRef = useRef(false);
	const autoFullTrackClipIdRef = useRef<string | null>(null);
	const autoFullTrackClipEndMsRef = useRef<number | null>(null);

	const { shortcuts, isMac } = useShortcuts();
	const nextAnnotationIdRef = useRef(1);
	const nextAnnotationZIndexRef = useRef(1); // Track z-index for stacking order
	const exporterRef = useRef<CancelableExporter | null>(null);
	const autoSuggestedVideoPathRef = useRef<string | null>(null);
	const pendingFreshRecordingAutoZoomPathRef = useRef<string | null>(null);
	const pendingExportSaveRef = useRef<PendingExportSave | null>(null);
	const pendingTelemetryRetryTimeoutRef = useRef<number | null>(null);
	const pendingFreshRecordingAutoSuggestTimeoutRef = useRef<number | null>(null);
	const pendingFreshRecordingAutoSuggestTelemetryCountRef = useRef(0);
	const cropSnapshotRef = useRef<CropRegion | null>(null);
	const mp4SupportRequestRef = useRef(0);
	const timelineRef = useRef<TimelineEditorHandle>(null);

	function formatTime(seconds: number) {
		if (!isFinite(seconds) || isNaN(seconds) || seconds < 0) return "0:00";
		const mins = Math.floor(seconds / 60);
		const secs = Math.floor(seconds % 60);
		return `${mins}:${secs.toString().padStart(2, "0")}`;
	}

	useEffect(() => {
		syncUiState({
			activeEffectSection: "scene",
			timelineCollapsed: false,
			aspectRatio: initialEditorPreferences.aspectRatio,
		});
	}, [initialEditorPreferences.aspectRatio, syncUiState]);

	useEffect(() => {
		void window.electronAPI?.getPlatform?.()?.then((platform) => {
			setAppPlatform(platform);
		});
	}, []);

	useEffect(() => {
		autoSuggestedVideoPathRef.current = null;
		pendingFreshRecordingAutoSuggestTelemetryCountRef.current = 0;
		if (pendingFreshRecordingAutoSuggestTimeoutRef.current !== null) {
			window.clearTimeout(pendingFreshRecordingAutoSuggestTimeoutRef.current);
			pendingFreshRecordingAutoSuggestTimeoutRef.current = null;
		}
	}, []);

	// Auto-activate builtin extensions at editor startup (idempotent)
	useEffect(() => {
		extensionHost.autoActivateBuiltins();
	}, []);

	const [supportedMp4SourceDimensions, setSupportedMp4SourceDimensions] =
		useState<SupportedMp4Dimensions>({
			width: 1920,
			height: 1080,
			capped: false,
			encoderPath: null,
		});

	const clearPendingExportSave = useCallback(() => {
		const pending = pendingExportSaveRef.current;
		pendingExportSaveRef.current = null;
		setHasPendingExportSave(false);
		if (pending?.tempFilePath && typeof window !== "undefined") {
			// Best-effort cleanup — main-process also reaps stale temp files on
			// before-quit, so we ignore failures here.
			void window.electronAPI.discardExportedTemp?.(pending.tempFilePath);
		}
	}, []);

	const captureProjectThumbnail = useVideoEditorThumbnail({
		videoPlaybackRef,
		currentTime,
		renderState: {
			wallpaper,
			shadowIntensity,
			backgroundBlur,
			zoomMotionBlur,
			zoomMotionBlurTuning,
			zoomTemporalMotionBlur,
			zoomMotionBlurSampleCount,
			zoomMotionBlurShutterFraction,
			connectZooms,
			zoomInDurationMs,
			zoomInOverlapMs,
			zoomOutDurationMs,
			connectedZoomGapMs,
			connectedZoomDurationMs,
			zoomInEasing,
			zoomOutEasing,
			connectedZoomEasing,
			borderRadius,
			padding,
			cropRegion,
			webcam,
			resolvedWebcamVideoUrl,
			zoomRegions,
			annotationRegions,
			autoCaptions,
			autoCaptionSettings,
			clipRegions,
			speedRegions,
			cursorTelemetry,
			effectiveShowCursor,
			cursorStyle,
			cursorSize,
			cursorSmoothing,
			cursorSpringStiffnessMultiplier,
			cursorSpringDampingMultiplier,
			cursorSpringMassMultiplier,
			cameraSpringStiffnessMultiplier,
			cameraSpringDampingMultiplier,
			cameraSpringMassMultiplier,
			zoomSmoothness,
			zoomClassicMode,
			cursorMotionBlur,
			cursorClickBounce,
			cursorClickBounceDuration,
			cursorSway,
		},
	});

	const markExportAsSaving = useCallback(() => {
		setExportProgress((previous) => ({
			currentFrame: previous?.totalFrames ?? previous?.currentFrame ?? 1,
			totalFrames: previous?.totalFrames ?? previous?.currentFrame ?? 1,
			percentage: 100,
			estimatedTimeRemaining: 0,
			renderFps: previous?.renderFps,
			renderBackend: previous?.renderBackend,
			encodeBackend: previous?.encodeBackend,
			encoderName: previous?.encoderName,
			phase: "saving",
		}));
	}, []);

	const handleShowCursorChange = useCallback((nextShowCursor: boolean) => {
		setSessionShowCursorOverride(null);
		setShowCursor(nextShowCursor);
	}, []);

	const remountPreview = useCallback(() => {
		setIsPreviewReady(false);
		setPreviewVersion((version) => version + 1);
	}, []);


	const saveBlobExport = useCallback(
		async (blob: Blob, fileName: string, outputPath: string | null = null) => {
			const extension = fileName.split(".").pop()?.toLowerCase() || "bin";
			const hasExportStreamApi =
				typeof window !== "undefined" &&
				typeof window.electronAPI?.openExportStream === "function" &&
				typeof window.electronAPI?.writeExportStreamChunk === "function" &&
				typeof window.electronAPI?.closeExportStream === "function";
			let streamError: unknown = null;

			try {
				const tempFilePath = await streamExportBlobToTempFile(blob, extension);
				if (tempFilePath) {
					return {
						saveResult: await window.electronAPI.finalizeExportedVideo({
							tempPath: tempFilePath,
							fileName,
							outputPath,
						}),
						pendingSave: {
							fileName,
							tempFilePath,
						} satisfies PendingExportSave,
					};
				}
			} catch (error) {
				streamError = error;
				console.warn("[export] Temp-file blob save failed", error);
			}

			if (
				!canUseInMemoryExportSaveFallback({
					blobSize: blob.size,
					extension,
					hasExportStreamApi,
				})
			) {
				const message = describeBlockedInMemoryExportSave({
					blobSize: blob.size,
					extension,
				});
				console.error("[export] Refusing in-memory blob save fallback", {
					fileName,
					blobSize: blob.size,
					extension,
					hasExportStreamApi,
					streamError,
				});
				throw new Error(message);
			}

			console.warn("[export] Falling back to in-memory blob save", {
				fileName,
				blobSize: blob.size,
				extension,
				hasExportStreamApi,
			});
			const arrayBuffer = await blob.arrayBuffer();
			return {
				saveResult: outputPath
					? await window.electronAPI.writeExportedVideoToPath(arrayBuffer, outputPath)
					: await window.electronAPI.saveExportedVideo(arrayBuffer, fileName),
				pendingSave: {
					fileName,
					arrayBuffer,
				} satisfies PendingExportSave,
			};
		},
		[],
	);

	useEffect(() => {
		return () => {
			exporterRef.current?.cancel();
			exporterRef.current = null;
			const pending = pendingExportSaveRef.current;
			pendingExportSaveRef.current = null;
			if (pending?.tempFilePath && typeof window !== "undefined") {
				void window.electronAPI.discardExportedTemp?.(pending.tempFilePath);
			}
			if (pendingTelemetryRetryTimeoutRef.current !== null) {
				window.clearTimeout(pendingTelemetryRetryTimeoutRef.current);
				pendingTelemetryRetryTimeoutRef.current = null;
			}
			if (pendingFreshRecordingAutoSuggestTimeoutRef.current !== null) {
				window.clearTimeout(pendingFreshRecordingAutoSuggestTimeoutRef.current);
				pendingFreshRecordingAutoSuggestTimeoutRef.current = null;
			}
		};
	}, []);

	useEffect(() => {
		void projectManager.refreshProjectLibrary();
	}, [projectManager.refreshProjectLibrary]);

	const canUndo = timelineState.canUndo;
	const canRedo = timelineState.canRedo;

	const gifOutputDimensions = useMemo(
		() =>
			calculateOutputDimensions(
				videoPlaybackRef.current?.video?.videoWidth || 1920,
				videoPlaybackRef.current?.video?.videoHeight || 1080,
				gifSizePreset,
				GIF_SIZE_PRESETS,
			),
		[gifSizePreset],
	);

	const desiredMp4SourceDimensions = useMemo(
		() =>
			calculateMp4SourceDimensions(
				videoPlaybackRef.current?.video?.videoWidth || 1920,
				videoPlaybackRef.current?.video?.videoHeight || 1080,
				aspectRatio,
			),
		[aspectRatio],
	);

	const mp4OutputDimensions = useMemo(() => {
		const baseWidth = supportedMp4SourceDimensions.encoderPath
			? supportedMp4SourceDimensions.width
			: desiredMp4SourceDimensions.width;
		const baseHeight = supportedMp4SourceDimensions.encoderPath
			? supportedMp4SourceDimensions.height
			: desiredMp4SourceDimensions.height;

		return {
			medium: calculateMp4ExportDimensions(baseWidth, baseHeight, "medium"),
			good: calculateMp4ExportDimensions(baseWidth, baseHeight, "good"),
			high: calculateMp4ExportDimensions(baseWidth, baseHeight, "high"),
			source: calculateMp4ExportDimensions(baseWidth, baseHeight, "source"),
		};
	}, [
		desiredMp4SourceDimensions.height,
		desiredMp4SourceDimensions.width,
		supportedMp4SourceDimensions.encoderPath,
		supportedMp4SourceDimensions.height,
		supportedMp4SourceDimensions.width,
	]);

	const ensureSupportedMp4SourceDimensions = useCallback(
		async (frameRate: ExportMp4FrameRate) => {
			const result = await probeSupportedMp4Dimensions({
				width: desiredMp4SourceDimensions.width,
				height: desiredMp4SourceDimensions.height,
				frameRate,
				codec: DEFAULT_MP4_CODEC,
				getBitrate: getSourceQualityBitrate,
			});

			if (!result.encoderPath) {
				throw new Error(
					`Video encoding not supported on this system. Tried codec ${DEFAULT_MP4_CODEC} at ${frameRate} FPS up to ${desiredMp4SourceDimensions.width}x${desiredMp4SourceDimensions.height}.`,
				);
			}

			setSupportedMp4SourceDimensions((current) => {
				if (
					current.width === result.width &&
					current.height === result.height &&
					current.capped === result.capped &&
					current.encoderPath?.codec === result.encoderPath?.codec &&
					current.encoderPath?.hardwareAcceleration ===
						result.encoderPath?.hardwareAcceleration
				) {
					return current;
				}

				return result;
			});

			return result;
		},
		[desiredMp4SourceDimensions.height, desiredMp4SourceDimensions.width],
	);

	useEffect(() => {
		let cancelled = false;
		const requestId = mp4SupportRequestRef.current + 1;
		mp4SupportRequestRef.current = requestId;
		setSupportedMp4SourceDimensions({
			width: desiredMp4SourceDimensions.width,
			height: desiredMp4SourceDimensions.height,
			capped: false,
			encoderPath: null,
		});

		void ensureSupportedMp4SourceDimensions(mp4FrameRate)
			.then((result) => {
				if (cancelled || requestId !== mp4SupportRequestRef.current) {
					return;
				}
				setSupportedMp4SourceDimensions(result);
			})
			.catch(() => {
				if (cancelled || requestId !== mp4SupportRequestRef.current) {
					return;
				}
				setSupportedMp4SourceDimensions({
					width: desiredMp4SourceDimensions.width,
					height: desiredMp4SourceDimensions.height,
					capped: false,
					encoderPath: null,
				});
			});

		return () => {
			cancelled = true;
		};
	}, [
		desiredMp4SourceDimensions.height,
		desiredMp4SourceDimensions.width,
		ensureSupportedMp4SourceDimensions,
		mp4FrameRate,
	]);

	// Extension-contributed standalone section pages (no parentSection)
	const [extensionSectionButtons, setExtensionSectionButtons] = useState<
		{
			id: EditorEffectSection;
			label: string;
			icon: typeof PhPuzzle | string;
			extensionPath?: string | null;
		}[]
	>([]);
	useEffect(() => {
		const update = () => {
			const panels = extensionHost.getSettingsPanels();
			const extensionPathById = new Map(
				extensionHost
					.getActiveExtensions()
					.map((extension) => [extension.manifest.id, extension.path]),
			);
			const standalone = panels
				.filter((p) => !p.panel.parentSection)
				.map((p) => ({
					id: `ext:${p.extensionId}/${p.panel.id}` as EditorEffectSection,
					label: p.panel.label,
					icon: p.panel.icon || (PhPuzzle as typeof PhPuzzle | string),
					extensionPath: extensionPathById.get(p.extensionId),
				}));
			setExtensionSectionButtons(standalone);
		};
		update();
		return extensionHost.onChange(update);
	}, []);

	const editorSectionButtons = useMemo(
		() => [
			{ id: "scene" as const, label: t("settings.sections.scene", "Scene"), icon: PhSparkle },
			{
				id: "cursor" as const,
				label: t("settings.sections.cursor", "Cursor"),
				icon: PhCursorFill,
			},
			{
				id: "webcam" as const,
				label: t("settings.sections.webcam", "Webcam"),
				icon: PhCamera,
			},
			{
				id: "captions" as const,
				label: t("settings.sections.captions", "Captions"),
				icon: PhCaptions,
			},
			{
				id: "settings" as const,
				label: t("settings.sections.settings", "Settings"),
				icon: PhSettings,
			},
			...extensionSectionButtons,
			{
				id: "extensions" as const,
				label: t("settings.sections.extensions", "Extensions"),
				icon: PhPuzzle,
			},
		],
		[t, extensionSectionButtons],
	);

	useEffect(() => {
		if (activeEffectSection === "frame" || activeEffectSection === "crop") {
			setActiveEffectSection("scene");
		}
	}, [activeEffectSection]);

	const buildPersistedEditorState = useCallback(
		(
			editor: Partial<{
				wallpaper: string;
				shadowIntensity: number;
				backgroundBlur: number;
				zoomMotionBlur: number;
				zoomMotionBlurTuning: ZoomMotionBlurTuning;
				zoomTemporalMotionBlur: number;
				zoomMotionBlurSampleCount: number | null;
				zoomMotionBlurShutterFraction: number | null;
				connectZooms: boolean;
				zoomInDurationMs: number;
				zoomInOverlapMs: number;
				zoomOutDurationMs: number;
				connectedZoomGapMs: number;
				connectedZoomDurationMs: number;
				zoomInEasing: ZoomTransitionEasing;
				zoomOutEasing: ZoomTransitionEasing;
				connectedZoomEasing: ZoomTransitionEasing;
				showCursor: boolean;
				loopCursor: boolean;
				cursorStyle: CursorStyle;
				cursorSize: number;
				cursorSmoothing: number;
				cursorSpringStiffnessMultiplier: number;
				cursorSpringDampingMultiplier: number;
				cursorSpringMassMultiplier: number;
				cameraSpringStiffnessMultiplier: number;
				cameraSpringDampingMultiplier: number;
				cameraSpringMassMultiplier: number;
				zoomSmoothness: number;
				zoomClassicMode: boolean;
				cursorMotionBlur: number;
				cursorClickBounce: number;
				cursorClickBounceDuration: number;
				cursorSway: number;
				borderRadius: number;
				padding: Padding;
				frame: string | null;
				cropRegion: CropRegion;
				webcam: WebcamOverlaySettings;
				zoomRegions: ZoomRegion[];
				trimRegions: TrimRegion[];
				clipRegions: ClipRegion[];
				speedRegions: SpeedRegion[];
				annotationRegions: AnnotationRegion[];
				audioRegions: AudioRegion[];
				autoCaptions: CaptionCue[];
				autoCaptionSettings: AutoCaptionSettings;
				aspectRatio: AspectRatio;
				exportEncodingMode: ExportEncodingMode;
				exportBackendPreference: ExportBackendPreference;
				exportPipelineModel: ExportPipelineModel;
				exportQuality: ExportQuality;
				mp4FrameRate: ExportMp4FrameRate;
				exportFormat: ExportFormat;
				gifFrameRate: GifFrameRate;
				gifLoop: boolean;
				gifSizePreset: GifSizePreset;
				sourceAudioTrackSettingsByClip: Record<string, SourceAudioTrackSettings>;
				defaultSourceAudioTrackSettings: SourceAudioTrackSettings;
			}>,
		) => {
			return stripPersistedDevMotionBlurSettings(editor);
		},
		[],
	);

	const currentSourcePath = useMemo(
		() => videoSourcePath ?? (videoPath ? fromFileUrl(videoPath) : null),
		[videoPath, videoSourcePath],
	);
	const projectDisplayName = useMemo(() => {
		const fileName =
			currentProjectPath?.split(/[\\/]/).pop() ??
			currentSourcePath?.split(/[\\/]/).pop() ??
			"";
		const withoutExtension = fileName.replace(/\.recordly$/i, "").replace(/\.[^.]+$/, "");
		return withoutExtension || t("editor.project.untitled", "Untitled");
	}, [currentProjectPath, currentSourcePath, t]);

	const currentPersistedEditorState = useMemo(
		() =>
			buildPersistedEditorState({
				wallpaper,
				shadowIntensity,
				backgroundBlur,
				zoomMotionBlur,
				zoomMotionBlurTuning,
				zoomTemporalMotionBlur,
				zoomMotionBlurSampleCount,
				zoomMotionBlurShutterFraction,
				connectZooms,
				zoomInDurationMs,
				zoomInOverlapMs,
				zoomOutDurationMs,
				connectedZoomGapMs,
				connectedZoomDurationMs,
				zoomInEasing,
				zoomOutEasing,
				connectedZoomEasing,
				showCursor,
				loopCursor,
				cursorStyle,
				cursorSize,
				cursorSmoothing,
				cursorSpringStiffnessMultiplier,
				cursorSpringDampingMultiplier,
				cursorSpringMassMultiplier,
				cameraSpringStiffnessMultiplier,
				cameraSpringDampingMultiplier,
				cameraSpringMassMultiplier,
				zoomSmoothness,
				zoomClassicMode,
				cursorMotionBlur,
				cursorClickBounce,
				cursorClickBounceDuration,
				cursorSway,
				borderRadius,
				padding,
				frame,
				cropRegion,
				webcam,
				zoomRegions,
				trimRegions,
				clipRegions,
				speedRegions,
				annotationRegions,
				audioRegions,
				autoCaptions,
				autoCaptionSettings,
				aspectRatio,
				exportEncodingMode,
				exportBackendPreference,
				exportPipelineModel,
				exportQuality,
				mp4FrameRate,
				exportFormat,
				gifFrameRate,
				gifLoop,
				gifSizePreset,
				sourceAudioTrackSettingsByClip,
				defaultSourceAudioTrackSettings,
			}),
		[
			buildPersistedEditorState,
			wallpaper,
			shadowIntensity,
			backgroundBlur,
			zoomMotionBlur,
			zoomMotionBlurTuning,
			zoomTemporalMotionBlur,
			zoomMotionBlurSampleCount,
			zoomMotionBlurShutterFraction,
			connectZooms,
			zoomInDurationMs,
			zoomInOverlapMs,
			zoomOutDurationMs,
			connectedZoomGapMs,
			connectedZoomDurationMs,
			zoomInEasing,
			zoomOutEasing,
			connectedZoomEasing,
			showCursor,
			loopCursor,
			cursorStyle,
			cursorSize,
			cursorSmoothing,
			cursorSpringStiffnessMultiplier,
			cursorSpringDampingMultiplier,
			cursorSpringMassMultiplier,
			cameraSpringStiffnessMultiplier,
			cameraSpringDampingMultiplier,
			cameraSpringMassMultiplier,
			zoomSmoothness,
			zoomClassicMode,
			cursorMotionBlur,
			cursorClickBounce,
			cursorClickBounceDuration,
			cursorSway,
			borderRadius,
			padding,
			cropRegion,
			webcam,
			zoomRegions,
			trimRegions,
			clipRegions,
			speedRegions,
			annotationRegions,
			audioRegions,
			autoCaptions,
			autoCaptionSettings,
			aspectRatio,
			exportEncodingMode,
			exportBackendPreference,
			exportPipelineModel,
			exportQuality,
			mp4FrameRate,
			exportFormat,
			gifFrameRate,
			gifLoop,
			gifSizePreset,
			frame,
			sourceAudioTrackSettingsByClip,
			defaultSourceAudioTrackSettings,
		],
	);

	const handleUndo = timelineState.undo;
	const handleRedo = timelineState.redo;
	const {
		applyLoadedProject,
		syncActiveVideoSource,
		projectController,
		currentProjectSnapshot,
	} = useVideoEditorProject({
		projectManager,
		timelineState,
		editorRefs: {
			videoPlaybackRef,
			pendingFreshRecordingAutoZoomPathRef,
			clipInitializedRef,
			autoFullTrackClipIdRef,
			autoFullTrackClipEndMsRef,
			nextZoomIdRef,
			nextClipIdRef,
			nextAudioIdRef,
			nextAnnotationIdRef,
			nextAnnotationZIndexRef,
		},
		editorRuntime: {
			currentProjectPath,
			currentSourcePath,
			lastSavedProjectId: lastSavedSnapshot?.projectId ?? null,
			currentPersistedEditorState,
			webcamTimeOffsetMs: webcam.timeOffsetMs,
			resolveVideoUrl,
			applySessionPresentation,
			buildPersistedEditorState,
			captureProjectThumbnail,
			remountPreview,
		},
		editorSetters: {
			setIsPlaying,
			setCurrentTime,
			setDuration,
			setError,
			setVideoSourcePath,
			setVideoPath,
			setCurrentProjectPath,
			setWallpaper,
			setShadowIntensity,
			setBackgroundBlur,
			setZoomMotionBlur,
			setZoomMotionBlurTuning,
			setZoomTemporalMotionBlur,
			setZoomMotionBlurSampleCount,
			setZoomMotionBlurShutterFraction,
			setConnectZooms,
			setZoomInDurationMs,
			setZoomInOverlapMs,
			setZoomOutDurationMs,
			setConnectedZoomGapMs,
			setConnectedZoomDurationMs,
			setZoomInEasing,
			setZoomOutEasing,
			setConnectedZoomEasing,
			setShowCursor,
			setLoopCursor,
			setCursorStyle,
			setCursorSize,
			setCursorSmoothing,
			setCursorSpringStiffnessMultiplier,
			setCursorSpringDampingMultiplier,
			setCursorSpringMassMultiplier,
			setCameraSpringStiffnessMultiplier,
			setCameraSpringDampingMultiplier,
			setCameraSpringMassMultiplier,
			setZoomSmoothness,
			setZoomClassicMode,
			setCursorMotionBlur,
			setCursorClickBounce,
			setCursorClickBounceDuration,
			setCursorSway,
			setBorderRadius,
			setPadding,
			setFrame,
			setCropRegion,
			setWebcam,
			setTrimRegions,
			setSourceAudioTrackSettingsByClip,
			setDefaultSourceAudioTrackSettings,
			setAutoCaptionSettings,
			setAspectRatio,
			setExportEncodingMode,
			setExportBackendPreference,
			setExportPipelineModel,
			setExportQuality,
			setMp4FrameRate,
			setExportFormat,
			setGifFrameRate,
			setGifLoop,
			setGifSizePreset,
			setLastSavedSnapshot,
		},
		projectDisplayName,
		cloneStructured,
		onMenuLoadProject: window.electronAPI.onMenuLoadProject,
		onMenuSaveProject: window.electronAPI.onMenuSaveProject,
		onMenuSaveProjectAs: window.electronAPI.onMenuSaveProjectAs,
		onRequestSaveBeforeClose: window.electronAPI.onRequestSaveBeforeClose,
	});

	const syncRecordingSessionWebcam = useCallback(
		async (webcamPath: string | null, timeOffsetMs?: number) => {
			if (!currentSourcePath || !window.electronAPI.setCurrentRecordingSession) {
				return;
			}

			await window.electronAPI.setCurrentRecordingSession(
				{
					videoPath: currentSourcePath,
					webcamPath,
					timeOffsetMs:
						webcamPath && Number.isFinite(timeOffsetMs)
							? (timeOffsetMs ?? DEFAULT_WEBCAM_TIME_OFFSET_MS)
							: webcamPath
								? webcam.timeOffsetMs
								: DEFAULT_WEBCAM_TIME_OFFSET_MS,
				},
				{
					preserveProjectPath: Boolean(currentProjectPath),
				},
			);
		},
		[currentProjectPath, currentSourcePath, webcam.timeOffsetMs],
	);

	useEffect(() => {
		syncSidebarBindings({
			defaultWebcamTimeOffsetMs: DEFAULT_WEBCAM_TIME_OFFSET_MS,
			setWebcam,
			syncRecordingSessionWebcam,
		});
	}, [setWebcam, syncRecordingSessionWebcam, syncSidebarBindings]);

	useEffect(() => {
		syncPresetBindings(
			{
				...(currentPersistedEditorState as EditorPresetSnapshot),
				autoCaptionSettings,
				whisperExecutablePath,
				whisperModelPath,
			},
			{
				wallpaper: setWallpaper,
				shadowIntensity: setShadowIntensity,
				backgroundBlur: setBackgroundBlur,
				zoomMotionBlur: setZoomMotionBlur,
				zoomMotionBlurTuning: setZoomMotionBlurTuning,
				zoomTemporalMotionBlur: setZoomTemporalMotionBlur,
				zoomMotionBlurSampleCount: setZoomMotionBlurSampleCount,
				zoomMotionBlurShutterFraction: setZoomMotionBlurShutterFraction,
				connectZooms: setConnectZooms,
				zoomInDurationMs: setZoomInDurationMs,
				zoomInOverlapMs: setZoomInOverlapMs,
				zoomOutDurationMs: setZoomOutDurationMs,
				connectedZoomGapMs: setConnectedZoomGapMs,
				connectedZoomDurationMs: setConnectedZoomDurationMs,
				zoomInEasing: setZoomInEasing,
				zoomOutEasing: setZoomOutEasing,
				connectedZoomEasing: setConnectedZoomEasing,
				showCursor: setShowCursor,
				loopCursor: setLoopCursor,
				cursorStyle: setCursorStyle,
				cursorSize: setCursorSize,
				cursorSmoothing: setCursorSmoothing,
				cursorSpringStiffnessMultiplier: setCursorSpringStiffnessMultiplier,
				cursorSpringDampingMultiplier: setCursorSpringDampingMultiplier,
				cursorSpringMassMultiplier: setCursorSpringMassMultiplier,
				cameraSpringStiffnessMultiplier: setCameraSpringStiffnessMultiplier,
				cameraSpringDampingMultiplier: setCameraSpringDampingMultiplier,
				cameraSpringMassMultiplier: setCameraSpringMassMultiplier,
				cursorMotionBlur: setCursorMotionBlur,
				cursorClickBounce: setCursorClickBounce,
				cursorClickBounceDuration: setCursorClickBounceDuration,
				cursorSway: setCursorSway,
				borderRadius: setBorderRadius,
				padding: setPadding,
				frame: setFrame,
				webcam: setWebcam,
				aspectRatio: setAspectRatio,
				exportEncodingMode: setExportEncodingMode,
				exportBackendPreference: setExportBackendPreference,
				exportPipelineModel: setExportPipelineModel,
				exportQuality: setExportQuality,
				mp4FrameRate: setMp4FrameRate,
				exportFormat: setExportFormat,
				gifFrameRate: setGifFrameRate,
				gifLoop: setGifLoop,
				gifSizePreset: setGifSizePreset,
				autoCaptionSettings: setAutoCaptionSettings,
				whisperExecutablePath: setWhisperExecutablePath,
				whisperModelPath: setWhisperModelPath,
			},
		);
	}, [
		autoCaptionSettings,
		currentPersistedEditorState,
		syncPresetBindings,
		whisperExecutablePath,
		whisperModelPath,
	]);

	const whisperCaptions = useWhisperCaptions({
		videoPath,
		videoSourcePath,
		webcamSourcePath: webcam.sourcePath ?? null,
		autoCaptionSettings,
		whisperExecutablePath,
		whisperModelPath,
		downloadedWhisperModelPath,
		whisperModelDownloadStatus,
		isGeneratingCaptions,
		onSyncVideoSource: syncActiveVideoSource,
		onResolveVideoUrl: resolveVideoUrl,
		onSetVideoSourcePath: setVideoSourcePath,
		onSetVideoPath: setVideoPath,
		onSetAutoCaptions: setAutoCaptions,
		onSetAutoCaptionSettings: setAutoCaptionSettings,
		onSetWhisperExecutablePath: setWhisperExecutablePath,
		onSetWhisperModelPath: setWhisperModelPath,
		onSetDownloadedWhisperModelPath: setDownloadedWhisperModelPath,
		onSetWhisperModelDownloadStatus: setWhisperModelDownloadStatus,
		onSetWhisperModelDownloadProgress: setWhisperModelDownloadProgress,
		onSetIsGeneratingCaptions: setIsGeneratingCaptions,
	});
	const handlePickWhisperExecutable = whisperCaptions.handlePickWhisperExecutable;
	const handleDownloadWhisperSmallModel = whisperCaptions.handleDownloadWhisperSmallModel;
	const handlePickWhisperModel = whisperCaptions.handlePickWhisperModel;
	const handleDeleteWhisperSmallModel = whisperCaptions.handleDeleteWhisperSmallModel;
	const handleGenerateAutoCaptions = whisperCaptions.handleGenerateAutoCaptions;
	const handleClearAutoCaptions = whisperCaptions.handleClearAutoCaptions;
	const projectBootstrap = useProjectBootstrapController();

	const hasUnsavedChanges = useMemo(
		() =>
			Boolean(
				currentProjectSnapshot &&
					(!lastSavedSnapshot ||
						!areDeepEqual(currentProjectSnapshot, lastSavedSnapshot)),
			),
		[currentProjectSnapshot, lastSavedSnapshot],
	);

	useEffect(() => {
		void projectBootstrap.initializeEditorProjectState({
			smokeExportEnabled: smokeExportConfig.enabled,
			smokeExportProjectPath: smokeExportConfig.projectPath ?? null,
			smokeExportInputPath: smokeExportConfig.inputPath ?? null,
			smokeExportWebcamInputPath: smokeExportConfig.webcamInputPath ?? null,
			smokeExportWebcamShadow: smokeExportConfig.webcamShadow,
			smokeExportWebcamSize: smokeExportConfig.webcamSize,
			devOpenRecordingInputPath: devOpenRecordingConfig.inputPath ?? null,
			devOpenRecordingWebcamInputPath: devOpenRecordingConfig.webcamInputPath ?? null,
			autoApplyFreshRecordingAutoZooms,
			initialEditorPreferences,
			fromFileUrl,
			resolveVideoUrl,
			applyLoadedProject,
			applySessionPresentation,
			setVideoSourcePath,
			setVideoPath,
			setCurrentProjectPath,
			setLastSavedSnapshot: () => setLastSavedSnapshot(null),
			setPendingFreshRecordingAutoZoomPath: (value) => {
				pendingFreshRecordingAutoZoomPathRef.current = value;
			},
			setWebcam: (update) => setWebcam((prev) => update(prev as never) as WebcamOverlaySettings),
			setError,
			setLoading,
			setPadding,
			setBorderRadius,
			setAspectRatio,
			setExportFormat,
			setMp4FrameRate,
			setExportQuality,
			setExportEncodingMode,
			setExportBackendPreference,
			setExportPipelineModel,
			setGifFrameRate,
			setGifLoop,
			setGifSizePreset,
			defaultWebcamTimeOffsetMs: DEFAULT_WEBCAM_TIME_OFFSET_MS,
		});
	}, [
		applyLoadedProject,
		applySessionPresentation,
		autoApplyFreshRecordingAutoZooms,
		devOpenRecordingConfig.inputPath,
		devOpenRecordingConfig.webcamInputPath,
		initialEditorPreferences,
		smokeExportConfig.enabled,
		smokeExportConfig.inputPath,
		smokeExportConfig.projectPath,
		smokeExportConfig.webcamInputPath,
		smokeExportConfig.webcamShadow,
		smokeExportConfig.webcamSize,
		projectBootstrap,
	]);

	useEffect(() => {
		if (!window.electronAPI.onRecordingSessionChanged) {
			return;
		}

		return window.electronAPI.onRecordingSessionChanged((session) => {
			console.log("[VideoEditor] onRecordingSessionChanged received!", {
				sessionVideoPath: session?.videoPath,
				videoSourcePath: videoSourcePath,
				match: session?.videoPath === videoSourcePath,
				webcamPath: session?.webcamPath
			});

			if (!session || session.videoPath !== videoSourcePath) {
				return;
			}

			setWebcam((prev) => ({
				...prev,
				enabled: Boolean(session.webcamPath),
				sourcePath: session.webcamPath ?? null,
				timeOffsetMs: session.webcamPath
					? (session.timeOffsetMs ?? prev.timeOffsetMs)
					: DEFAULT_WEBCAM_TIME_OFFSET_MS,
			}));
		});
	}, [videoSourcePath]);

	useEffect(() => {
		let cancelled = false;
		if (!webcam.sourcePath) {
			setResolvedWebcamVideoUrl(null);
			return;
		}
		void resolveVideoUrl(webcam.sourcePath).then((url) => {
			if (!cancelled) setResolvedWebcamVideoUrl(url);
		});
		return () => {
			cancelled = true;
		};
	}, [webcam.sourcePath]);

	useEffect(() => {
		if (!autoApplyFreshRecordingAutoZooms) {
			pendingFreshRecordingAutoZoomPathRef.current = null;
		}
	}, [autoApplyFreshRecordingAutoZooms]);

	useEffect(() => {
		saveEditorPreferences({
			wallpaper,
			shadowIntensity,
			backgroundBlur,
			zoomMotionBlur,
			zoomMotionBlurTuning,
			zoomTemporalMotionBlur,
			zoomMotionBlurSampleCount,
			zoomMotionBlurShutterFraction,
			autoApplyFreshRecordingAutoZooms,
			connectZooms,
			zoomInDurationMs,
			zoomInOverlapMs,
			zoomOutDurationMs,
			connectedZoomGapMs,
			connectedZoomDurationMs,
			zoomInEasing,
			zoomOutEasing,
			connectedZoomEasing,
			showCursor,
			loopCursor,
			cursorStyle,
			cursorSize,
			cursorSmoothing,
			cursorSpringStiffnessMultiplier,
			cursorSpringDampingMultiplier,
			cursorSpringMassMultiplier,
			cameraSpringStiffnessMultiplier,
			cameraSpringDampingMultiplier,
			cameraSpringMassMultiplier,
			cursorMotionBlur,
			cursorClickBounce,
			cursorClickBounceDuration,
			cursorSway,
			borderRadius,
			padding,
			frame,
			webcam,
			aspectRatio,
			exportEncodingMode,
			exportBackendPreference,
			exportPipelineModel,
			exportQuality,
			mp4FrameRate,
			exportFormat,
			gifFrameRate,
			gifLoop,
			gifSizePreset,
			whisperExecutablePath,
			whisperModelPath,
		});
	}, [
		wallpaper,
		shadowIntensity,
		backgroundBlur,
		zoomMotionBlur,
		zoomMotionBlurTuning,
		zoomTemporalMotionBlur,
		zoomMotionBlurSampleCount,
		zoomMotionBlurShutterFraction,
		autoApplyFreshRecordingAutoZooms,
		connectZooms,
		zoomInDurationMs,
		zoomInOverlapMs,
		zoomOutDurationMs,
		connectedZoomGapMs,
		connectedZoomDurationMs,
		zoomInEasing,
		zoomOutEasing,
		connectedZoomEasing,
		showCursor,
		loopCursor,
		cursorStyle,
		cursorSize,
		cursorSmoothing,
		cursorSpringStiffnessMultiplier,
		cursorSpringDampingMultiplier,
		cursorSpringMassMultiplier,
		cameraSpringStiffnessMultiplier,
		cameraSpringDampingMultiplier,
		cameraSpringMassMultiplier,
		cursorMotionBlur,
		cursorClickBounce,
		cursorClickBounceDuration,
		cursorSway,
		borderRadius,
		padding,
		frame,
		webcam,
		aspectRatio,
		exportEncodingMode,
		exportBackendPreference,
		exportPipelineModel,
		exportQuality,
		mp4FrameRate,
		exportFormat,
		gifFrameRate,
		gifLoop,
		gifSizePreset,
		whisperExecutablePath,
		whisperModelPath,
	]);

	const {
		projectBrowserOpen,
		setProjectBrowserOpen,
		isEditingProjectName,
		setIsEditingProjectName,
		projectNameDraft,
		setProjectNameDraft,
		isSavingProjectName,
		closeProjectNameEditor,
		handleProjectNameSubmit,
		handleOpenProjectFromLibrary,
		handleOpenProjectBrowser,
		saveProject,
	} = projectController;

	useEffect(() => {
		if (!isEditingProjectName) {
			return;
		}
		const frameId = window.requestAnimationFrame(() => {
			projectNameInputRef.current?.focus();
			projectNameInputRef.current?.select();
		});
		return () => {
			window.cancelAnimationFrame(frameId);
		};
	}, [isEditingProjectName]);

	useEffect(() => {
		autosaveRunnerRef.current = () => saveProject(false, { silent: true });
		return () => {
			autosaveRunnerRef.current = null;
		};
	}, [saveProject]);

	useEffect(() => {
		window.electronAPI.setHasUnsavedChanges(hasUnsavedChanges);
	}, [hasUnsavedChanges]);

	useEffect(() => {
		if (currentProjectPath && hasUnsavedChanges) {
			projectManager.markDirty();
			return;
		}
		projectManager.clearDirty();
	}, [currentProjectPath, hasUnsavedChanges, projectManager]);

	useEffect(() => {
		let mounted = true;
		let retryAttempts = 0;

		async function loadCursorTelemetry() {
			if (!videoPath || !videoSourcePath) {
				if (mounted) {
					setCursorTelemetry([]);
					setCursorTelemetrySourcePath(null);
				}
				return;
			}

			try {
				const result = await window.electronAPI.getCursorTelemetry(videoSourcePath);
				if (mounted) {
					const samples = result.success ? result.samples : [];
					setCursorTelemetry(samples);
					setCursorTelemetrySourcePath(videoSourcePath);

					const shouldRetryFreshRecordingTelemetry =
						pendingFreshRecordingAutoZoomPathRef.current === videoPath &&
						autoSuggestedVideoPathRef.current !== videoPath &&
						retryAttempts < 12;

					if (shouldRetryFreshRecordingTelemetry) {
						retryAttempts += 1;
						pendingTelemetryRetryTimeoutRef.current = window.setTimeout(() => {
							pendingTelemetryRetryTimeoutRef.current = null;
							if (mounted) {
								void loadCursorTelemetry();
							}
						}, 350);
					}
				}
			} catch (telemetryError) {
				console.warn("Unable to load cursor telemetry:", telemetryError);
				if (mounted) {
					setCursorTelemetry([]);
					setCursorTelemetrySourcePath(videoSourcePath);
					if (
						pendingFreshRecordingAutoZoomPathRef.current === videoPath &&
						autoSuggestedVideoPathRef.current !== videoPath &&
						retryAttempts < 12
					) {
						retryAttempts += 1;
						pendingTelemetryRetryTimeoutRef.current = window.setTimeout(() => {
							pendingTelemetryRetryTimeoutRef.current = null;
							if (mounted) {
								void loadCursorTelemetry();
							}
						}, 350);
					}
				}
			}
		}

		if (pendingTelemetryRetryTimeoutRef.current !== null) {
			window.clearTimeout(pendingTelemetryRetryTimeoutRef.current);
			pendingTelemetryRetryTimeoutRef.current = null;
		}

		loadCursorTelemetry();

		return () => {
			mounted = false;
			if (pendingTelemetryRetryTimeoutRef.current !== null) {
				window.clearTimeout(pendingTelemetryRetryTimeoutRef.current);
				pendingTelemetryRetryTimeoutRef.current = null;
			}
		};
	}, [videoPath, videoSourcePath]);

	const normalizedCursorTelemetry = useMemo(() => {
		if (cursorTelemetry.length === 0) {
			return [] as CursorTelemetryPoint[];
		}

		const totalMs = Math.max(0, Math.round(duration * 1000));
		return normalizeCursorTelemetry(
			cursorTelemetry,
			totalMs > 0 ? totalMs : Number.MAX_SAFE_INTEGER,
		);
	}, [cursorTelemetry, duration]);

	const displayedTimelineWindow = useMemo(() => {
		const totalMs = Math.max(0, Math.round(duration * 1000));
		return getDisplayedTimelineWindowMs(totalMs, trimRegions);
	}, [duration, trimRegions]);

	const effectiveCursorTelemetry = useMemo(() => {
		if (!loopCursor) {
			return normalizedCursorTelemetry;
		}

		if (
			normalizedCursorTelemetry.length < 2 ||
			displayedTimelineWindow.endMs <= displayedTimelineWindow.startMs
		) {
			return normalizedCursorTelemetry;
		}

		return buildLoopedCursorTelemetry(
			normalizedCursorTelemetry,
			displayedTimelineWindow.endMs,
			displayedTimelineWindow.startMs,
		);
	}, [loopCursor, normalizedCursorTelemetry, displayedTimelineWindow]);

	// Initialize a full-track clip when duration is first known
	useEffect(() => {
		const totalMs = Math.round(duration * 1000);
		if (totalMs <= 0) return;
		if (!clipInitializedRef.current) {
			if (clipRegions.length === 0) {
				const nextClipRegions =
					trimRegions.length > 0
						? trimsToClips(trimRegions, totalMs)
						: (() => {
								const id = `clip-${nextClipIdRef.current++}`;
								autoFullTrackClipIdRef.current = id;
								autoFullTrackClipEndMsRef.current = totalMs;
								return [{ id, startMs: 0, endMs: totalMs, speed: 1 }];
							})();

				if (trimRegions.length > 0) {
					nextClipIdRef.current = deriveNextId(
						"clip",
						nextClipRegions.map((region) => region.id),
					);
				}

				setClipRegions(nextClipRegions);
				if (speedRegions.length > 0) {
					// Legacy speed regions no longer have dedicated editing surfaces.
					// Clear them during clip bootstrap so old projects do not keep
					// hidden playback changes that users cannot inspect or edit.
					setSpeedRegions([]);
				}
			}
			clipInitializedRef.current = true;
			return;
		}

		const extendedClipRegions = extendAutoFullTrackClip(
			clipRegions,
			autoFullTrackClipIdRef.current,
			autoFullTrackClipEndMsRef.current,
			totalMs,
		);
		if (!extendedClipRegions) return;

		autoFullTrackClipEndMsRef.current = totalMs;
		setClipRegions(extendedClipRegions);
	}, [duration, clipRegions, trimRegions, speedRegions]);

	// Derive trimRegions from clipRegions so export/playback pipelines stay unchanged
	useEffect(() => {
		const totalMs = Math.round(duration * 1000);
		if (totalMs <= 0 || clipRegions.length === 0) return;
		setTrimRegions(clipsToTrims(clipRegions, totalMs));
	}, [clipRegions, duration]);

	const mapTimelineTimeToSourceTime = useCallback(
		(timeMs: number) => resolveTimelineTimeToSourceTime(timeMs, clipRegions),
		[clipRegions],
	);

	const mapSourceTimeToTimelineTime = useCallback(
		(timeMs: number) => resolveSourceTimeToTimelineTime(timeMs, clipRegions),
		[clipRegions],
	);

	const effectiveZoomRegions = useMemo<ZoomRegion[]>(
		() =>
			zoomRegions.map((region) => ({
				...region,
				startMs: mapTimelineTimeToSourceTime(region.startMs),
				endMs: mapTimelineTimeToSourceTime(region.endMs),
			})),
		[zoomRegions, mapTimelineTimeToSourceTime],
	);

	const timelinePlayheadTime = useMemo(
		() => mapSourceTimeToTimelineTime(currentTime * 1000) / 1000,
		[currentTime, mapSourceTimeToTimelineTime],
	);
	const timelineDuration = useMemo(
		() => getTimelineDurationMs(clipRegions, duration * 1000) / 1000,
		[clipRegions, duration],
	);

	// Merge clip speeds into speed regions so playback + export respect per-clip speed
	const effectiveSpeedRegions = useMemo<SpeedRegion[]>(() => {
		const clipDerived: SpeedRegion[] = clipRegions
			.filter((clip) => clip.speed !== 1)
			.map((clip) => ({
				id: `clip-speed-${clip.id}`,
				startMs: clip.startMs,
				endMs: getClipSourceEndMs(clip),
				speed: clip.speed as SpeedRegion["speed"],
			}));
		if (clipDerived.length === 0) return speedRegions;
		const result = [...speedRegions];
		for (const cs of clipDerived) {
			const overlaps = speedRegions.some(
				(sr) => sr.endMs > cs.startMs && sr.startMs < cs.endMs,
			);
			if (!overlaps) {
				result.push(cs);
			}
		}
		return result;
	}, [clipRegions, speedRegions]);
	const audio = useVideoEditorAudio({
		currentSourcePath,
		selectedClipId,
		clipRegions,
		audioRegions,
		effectiveSpeedRegions,
		sourceAudioTrackSettingsByClip,
		setSourceAudioTrackSettingsByClip,
		defaultSourceAudioTrackSettings,
		setDefaultSourceAudioTrackSettings,
		currentTime,
		timelineTime: timelinePlayheadTime,
		duration,
		isPlaying,
		previewVolume,
		summarizeErrorMessage,
		onSourceFallbackLoadError: (error) => {
			toast.warning(
				`Could not load companion audio source: ${summarizeErrorMessage(getErrorMessage(error))}`,
				{ duration: 10000 },
			);
		},
	});

	function togglePlayPause() {
		const playback = videoPlaybackRef.current;
		const video = playback?.video;
		if (!playback || !video) return;

		if (!video.paused && !video.ended) {
			playback.pause();
		} else {
			playback.play().catch((err) => console.error("Video play failed:", err));
		}
	}

	const handleAutoSuggestZoomsConsumed = useCallback(() => {
		setAutoSuggestZoomsTrigger(0);
	}, []);

	const handleSeek = useCallback((time: number, options: { pause?: boolean } = {}) => {
		const playback = videoPlaybackRef.current;
		const video = playback?.video;
		if (!video) return;

		if (options.pause && !video.paused) {
			playback?.pause();
		}

		video.currentTime = mapTimelineTimeToSourceTime(time * 1000) / 1000;
	}, [mapTimelineTimeToSourceTime]);

	const handleTimelineSeek = useCallback((time: number) => {
		handleSeek(time, { pause: true });
	}, [handleSeek]);
	const timelineActions = useTimelineActions({
		videoPath,
		pendingFreshRecordingAutoZoomPathRef,
		autoSuggestedVideoPathRef,
		nextZoomIdRef,
		nextClipIdRef,
		nextAudioIdRef,
		nextAnnotationIdRef,
		nextAnnotationZIndexRef,
		zoomRegions,
		clipRegions,
		selectedZoomId,
		selectedClipId,
		selectedAnnotationId,
		selectedAudioId,
		onSetActiveEffectSection: setActiveEffectSection,
		onSetZoomRegions: setZoomRegions,
		onSetClipRegions: setClipRegions,
		onSetSpeedRegions: setSpeedRegions,
		onSetAnnotationRegions: setAnnotationRegions,
		onSetAudioRegions: setAudioRegions,
		onSetSelectedZoomId: setSelectedZoomId,
		onSetSelectedClipId: setSelectedClipId,
		onSetSelectedAnnotationId: setSelectedAnnotationId,
		onSetSelectedAudioId: setSelectedAudioId,
	});
	const {
		handleSelectZoom,
		handleSelectAnnotation,
		handleZoomAdded,
		handleZoomSuggested,
		handleZoomSpanChange,
		handleZoomFocusChange,
		handleZoomDepthChange,
		handleZoomModeChange,
		handleZoomDelete,
		handleSelectClip,
		handleClipSplit,
		handleClipSpanChange,
		handleClipSpeedChange,
		handleClipMutedChange,
		handleClipShowSourceAudioChange,
		handleClipDelete,
		handleSelectAudio,
		handleAudioAdded,
		handleAudioSpanChange,
		handleAudioVolumeChange,
		handleAudioDelete,
		handleAudioNormalizeChange,
		handleAnnotationAdded,
		handleAnnotationSpanChange,
		handleAnnotationDelete,
		handleAnnotationContentChange,
		handleAnnotationTypeChange,
		handleAnnotationStyleChange,
		handleAnnotationFigureDataChange,
		handleAnnotationBlurIntensityChange,
		handleAnnotationBlurColorChange,
		handleAnnotationPositionChange,
		handleAnnotationSizeChange,
	} = timelineActions;

	useEffect(() => {
		if (
			!videoPath ||
			loading ||
			!isPreviewReady ||
			duration <= 0 ||
			zoomRegions.length > 0 ||
			normalizedCursorTelemetry.length < 2
		) {
			if (pendingFreshRecordingAutoSuggestTimeoutRef.current !== null) {
				window.clearTimeout(pendingFreshRecordingAutoSuggestTimeoutRef.current);
				pendingFreshRecordingAutoSuggestTimeoutRef.current = null;
			}
			return;
		}

		if (pendingFreshRecordingAutoZoomPathRef.current !== videoPath) {
			return;
		}

		if (autoSuggestedVideoPathRef.current === videoPath) {
			pendingFreshRecordingAutoZoomPathRef.current = null;
			return;
		}

		const telemetryPointCount = cursorTelemetry.length;
		if (pendingFreshRecordingAutoSuggestTelemetryCountRef.current === telemetryPointCount) {
			return;
		}

		pendingFreshRecordingAutoSuggestTelemetryCountRef.current = telemetryPointCount;

		if (pendingFreshRecordingAutoSuggestTimeoutRef.current !== null) {
			window.clearTimeout(pendingFreshRecordingAutoSuggestTimeoutRef.current);
			pendingFreshRecordingAutoSuggestTimeoutRef.current = null;
		}

		pendingFreshRecordingAutoSuggestTimeoutRef.current = window.setTimeout(() => {
			pendingFreshRecordingAutoSuggestTimeoutRef.current = null;
			if (
				pendingFreshRecordingAutoZoomPathRef.current !== videoPath ||
				autoSuggestedVideoPathRef.current === videoPath ||
				zoomRegions.length > 0
			) {
				return;
			}

			setAutoSuggestZoomsTrigger((value) => value + 1);
		}, 500);
	}, [
		videoPath,
		loading,
		isPreviewReady,
		duration,
		cursorTelemetry.length,
		normalizedCursorTelemetry,
		zoomRegions,
	]);


	// Global Tab prevention
	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			const target = e.target as HTMLElement | null;
			const isEditableTarget =
				target instanceof HTMLInputElement ||
				target instanceof HTMLTextAreaElement ||
				target?.isContentEditable;

			const usesPrimaryModifier = isMac ? e.metaKey : e.ctrlKey;
			const key = e.key.toLowerCase();

			if (usesPrimaryModifier && !e.altKey && key === "z") {
				if (!isEditableTarget) {
					e.preventDefault();
					if (e.shiftKey) {
						handleRedo();
					} else {
						handleUndo();
					}
				}
				return;
			}

			if (!isMac && e.ctrlKey && !e.metaKey && !e.altKey && key === "y") {
				if (!isEditableTarget) {
					e.preventDefault();
					handleRedo();
				}
				return;
			}

			if (e.key === "Tab") {
				// Allow tab only in inputs/textareas
				if (isEditableTarget) {
					return;
				}
				e.preventDefault();
			}

			if (matchesShortcut(e, shortcuts.playPause, isMac)) {
				// Allow space only in inputs/textareas
				if (isEditableTarget) {
					return;
				}
				e.preventDefault();

				const playback = videoPlaybackRef.current;
				if (playback?.video) {
					if (playback.video.paused) {
						playback.play().catch(console.error);
					} else {
						playback.pause();
					}
				}
			}
		};

		window.addEventListener("keydown", handleKeyDown, { capture: true });
		return () => window.removeEventListener("keydown", handleKeyDown, { capture: true });
	}, [shortcuts, isMac, handleUndo, handleRedo]);

	useEffect(() => {
		if (selectedZoomId && !zoomRegions.some((region) => region.id === selectedZoomId)) {
			setSelectedZoomId(null);
		}
	}, [selectedZoomId, zoomRegions]);

	useEffect(() => {
		if (
			selectedAnnotationId &&
			!annotationRegions.some((region) => region.id === selectedAnnotationId)
		) {
			setSelectedAnnotationId(null);
		}
	}, [selectedAnnotationId, annotationRegions]);

	useEffect(() => {
		if (selectedAudioId && !audioRegions.some((region) => region.id === selectedAudioId)) {
			setSelectedAudioId(null);
		}
	}, [selectedAudioId, audioRegions]);

	const showExportSuccessToast = useCallback((filePath: string) => {
		toast.success(`Exported successfully to ${filePath}`, {
			action: {
				label: "Show in Folder",
				onClick: async () => {
					try {
						const result = await window.electronAPI.revealInFolder(filePath);
						if (!result.success) {
							const errorMessage =
								result.error ||
								result.message ||
								"Failed to reveal item in folder.";
							toast.error(errorMessage);
						}
					} catch (err) {
						toast.error(`Error revealing in folder: ${String(err)}`);
					}
				},
			},
		});
	}, []);


	const handleExport = useCallback(
		async (settings: ExportSettings) => {
			if (!videoPath) {
				toast.error("No video loaded");
				return;
			}

			const video = videoPlaybackRef.current?.video;
			if (!video) {
				toast.error("Video not ready");
				return;
			}

			setIsExporting(true);
			setExportProgress(null);
			setExportError(null);
			clearPendingExportSave();
			extensionHost.emitEvent({ type: "export:start" });
			const smokeExportStartedAt = smokeExportConfig.enabled ? performance.now() : null;

			let keepExportDialogOpen = false;

			try {
				const wasPlaying = isPlaying;
				const restoreTime = video.currentTime;
				if (wasPlaying) {
					videoPlaybackRef.current?.pause();
				}

				// Get preview CONTAINER dimensions for scaling
				const playbackRef = videoPlaybackRef.current;
				const containerElement = playbackRef?.containerRef?.current;
				const previewWidth = containerElement?.clientWidth || 1920;
				const previewHeight = containerElement?.clientHeight || 1080;
				const effectiveShadowIntensity =
					smokeExportConfig.enabled && smokeExportConfig.shadowIntensity !== undefined
						? smokeExportConfig.shadowIntensity
						: shadowIntensity;
				const smokeProgressSamples: Array<Record<string, unknown>> = [];
				let lastSmokeProgressSampleAt = 0;
				let lastSmokeProgressPhase: ExportProgress["phase"] | undefined;
				const recordSmokeProgress = (progress: ExportProgress) => {
					if (!smokeExportConfig.enabled || smokeExportStartedAt === null) {
						return;
					}

					const now = performance.now();
					const phase = progress.phase ?? "extracting";
					const shouldSample =
						smokeProgressSamples.length === 0 ||
						phase !== lastSmokeProgressPhase ||
						now - lastSmokeProgressSampleAt >= 1000 ||
						progress.currentFrame >= progress.totalFrames;

					if (!shouldSample) {
						return;
					}

					smokeProgressSamples.push({
						elapsedMs: Math.round(now - smokeExportStartedAt),
						phase,
						currentFrame: progress.currentFrame,
						totalFrames: progress.totalFrames,
						percentage: progress.percentage,
						estimatedTimeRemaining: progress.estimatedTimeRemaining,
						renderFps: progress.renderFps,
						renderBackend: progress.renderBackend,
						encodeBackend: progress.encodeBackend,
						encoderName: progress.encoderName,
					});
					lastSmokeProgressSampleAt = now;
					lastSmokeProgressPhase = phase;
				};

				if (settings.format === "gif" && settings.gifConfig) {
					// GIF Export
					const gifExporter = new GifExporter({
						videoUrl: videoPath,
						width: settings.gifConfig.width,
						height: settings.gifConfig.height,
						frameRate: settings.gifConfig.frameRate,
						loop: settings.gifConfig.loop,
						sizePreset: settings.gifConfig.sizePreset,
						wallpaper,
						trimRegions,
						speedRegions: effectiveSpeedRegions,
						showShadow: effectiveShadowIntensity > 0,
						shadowIntensity: effectiveShadowIntensity,
						backgroundBlur,
						zoomMotionBlur,
						zoomMotionBlurTuning,
						zoomTemporalMotionBlur,
						zoomMotionBlurSampleCount,
						zoomMotionBlurShutterFraction,
						connectZooms,
						zoomInDurationMs,
						zoomInOverlapMs,
						zoomOutDurationMs,
						connectedZoomGapMs,
						connectedZoomDurationMs,
						zoomInEasing,
						zoomOutEasing,
						connectedZoomEasing,
						borderRadius,
						padding,
						videoPadding: padding,
						cropRegion,
						webcam,
						webcamUrl:
							resolvedWebcamVideoUrl ??
							(webcam.sourcePath ? toFileUrl(webcam.sourcePath) : null),
						annotationRegions,
						autoCaptions,
						autoCaptionSettings,
						zoomRegions: effectiveZoomRegions,
						cursorTelemetry: effectiveCursorTelemetry,
						showCursor: effectiveShowCursor,
						cursorStyle,
						cursorSize,
						cursorSmoothing,
						cursorSpringStiffnessMultiplier,
						cursorSpringDampingMultiplier,
						cursorSpringMassMultiplier,
						cameraSpringStiffnessMultiplier,
						cameraSpringDampingMultiplier,
						cameraSpringMassMultiplier,
						zoomSmoothness,
						zoomClassicMode,
						cursorMotionBlur,
						cursorClickBounce,
						cursorClickBounceDuration,
						cursorSway,
						frame,
						previewWidth,
						previewHeight,
						maxDecodeQueue: smokeExportConfig.maxDecodeQueue,
						maxPendingFrames: smokeExportConfig.maxPendingFrames,
						onProgress: (progress: ExportProgress) => {
							recordSmokeProgress(progress);
							setExportProgress(progress);
						},
					});

					exporterRef.current = gifExporter as unknown as VideoExporter;
					const result = await gifExporter.export();

					if (result.success && result.blob) {
						const timestamp = Date.now();
						const fileName = `export-${timestamp}.gif`;
						markExportAsSaving();

						const { saveResult, pendingSave } = await saveBlobExport(
							result.blob,
							fileName,
							smokeExportConfig.enabled ? smokeExportConfig.outputPath : null,
						);

						if (saveResult.canceled) {
							pendingExportSaveRef.current = pendingSave;
							setHasPendingExportSave(true);
							setExportError(
								"Save dialog canceled. Click Save Again to save without re-rendering.",
							);
							toast.info("Save canceled. You can save again without re-exporting.");
							keepExportDialogOpen = true;
						} else if (saveResult.success && saveResult.path) {
							if (smokeExportStartedAt !== null) {
								console.log(
									`[smoke-export] Completed in ${Math.round(performance.now() - smokeExportStartedAt)}ms (${saveResult.path})`,
								);
							}
							showExportSuccessToast(saveResult.path);
							setExportedFilePath(saveResult.path);
							if (smokeExportConfig.enabled) {
								window.close();
								return;
							}
						} else {
							setExportError(saveResult.message || "Failed to save GIF");
							toast.error(saveResult.message || "Failed to save GIF");
							if (smokeExportConfig.enabled) {
								window.close();
								return;
							}
						}
					} else {
						setExportError(result.error || "GIF export failed");
						toast.error(result.error || "GIF export failed");
						if (smokeExportConfig.enabled) {
							window.close();
							return;
						}
					}
				} else {
					// MP4 Export
					const quality = smokeExportConfig.enabled
						? (smokeExportConfig.quality ?? settings.quality ?? exportQuality)
						: (settings.quality ?? exportQuality);
					const encodingMode = smokeExportConfig.enabled
						? (smokeExportConfig.encodingMode ??
							settings.encodingMode ??
							exportEncodingMode)
						: (settings.encodingMode ?? exportEncodingMode);
					const selectedMp4FrameRate = smokeExportConfig.enabled
						? (smokeExportConfig.fps ?? settings.mp4FrameRate ?? mp4FrameRate)
						: (settings.mp4FrameRate ?? mp4FrameRate);
					const pipelineModel = smokeExportConfig.enabled
						? (smokeExportConfig.pipelineModel ?? "modern")
						: (settings.pipelineModel ?? exportPipelineModel);
					const useExperimentalNativeExport =
						pipelineModel === "modern" &&
						(smokeExportConfig.enabled ? smokeExportConfig.useNativeExport : true);
					const backendPreference =
						pipelineModel === "legacy"
							? "webcodecs"
							: smokeExportConfig.enabled
								? (smokeExportConfig.backendPreference ??
									(smokeExportConfig.useNativeExport ? "breeze" : "webcodecs"))
								: useExperimentalNativeExport
									? "auto"
									: (settings.backendPreference ?? exportBackendPreference);
					const supportedSourceDimensions =
						await ensureSupportedMp4SourceDimensions(selectedMp4FrameRate);
					const { width: exportWidth, height: exportHeight } =
						calculateMp4ExportDimensions(
							supportedSourceDimensions.width,
							supportedSourceDimensions.height,
							quality,
						);
					const bitrate = getMp4ExportBitrate({
						width: exportWidth,
						height: exportHeight,
						frameRate: selectedMp4FrameRate,
						quality,
						encodingMode,
						useModernNativeStaticLayout: useExperimentalNativeExport,
					});
					const sourceAudioTrackSettingsForExport =
						selectedClipId !== null
							? audio.selectedClipSourceAudioTrackSettings
							: audio.activeSourceAudioTrackSettings;

					const exporterConfig = {
						videoUrl: videoPath,
						width: exportWidth,
						height: exportHeight,
						frameRate: selectedMp4FrameRate,
						bitrate,
						codec: DEFAULT_MP4_CODEC,
						encodingMode,
						preferredEncoderPath: supportedSourceDimensions.encoderPath,
						preferredRenderBackend: smokeExportConfig.renderBackend,
						experimentalNativeExport: useExperimentalNativeExport,
						maxEncodeQueue: smokeExportConfig.maxEncodeQueue,
						maxDecodeQueue: smokeExportConfig.maxDecodeQueue,
						maxPendingFrames: smokeExportConfig.maxPendingFrames,
						wallpaper,
						trimRegions,
						speedRegions: effectiveSpeedRegions,
						showShadow: effectiveShadowIntensity > 0,
						shadowIntensity: effectiveShadowIntensity,
						backgroundBlur,
						zoomMotionBlur,
						zoomMotionBlurTuning,
						zoomTemporalMotionBlur,
						zoomMotionBlurSampleCount,
						zoomMotionBlurShutterFraction,
						connectZooms,
						zoomInDurationMs,
						zoomInOverlapMs,
						zoomOutDurationMs,
						connectedZoomGapMs,
						connectedZoomDurationMs,
						zoomInEasing,
						zoomOutEasing,
						connectedZoomEasing,
						borderRadius,
						padding,
						cropRegion,
						webcam,
						webcamUrl:
							resolvedWebcamVideoUrl ??
							(webcam.sourcePath ? toFileUrl(webcam.sourcePath) : null),
						annotationRegions,
						autoCaptions,
						autoCaptionSettings,
						zoomRegions: effectiveZoomRegions,
						cursorTelemetry: effectiveCursorTelemetry,
						showCursor: effectiveShowCursor,
						cursorStyle,
						cursorSize,
						cursorSmoothing,
						cursorSpringStiffnessMultiplier,
						cursorSpringDampingMultiplier,
						cursorSpringMassMultiplier,
						cameraSpringStiffnessMultiplier,
						cameraSpringDampingMultiplier,
						cameraSpringMassMultiplier,
						zoomSmoothness,
						zoomClassicMode,
						cursorMotionBlur,
						cursorClickBounce,
						cursorClickBounceDuration,
						cursorSway,
						frame,
						audioRegions,
						clipRegions,
						sourceAudioFallbackPaths: audio.sourceAudioFallbackPaths,
						sourceAudioFallbackStartDelayMsByPath:
							audio.sourceAudioFallbackStartDelayMsByPath,
						sourceAudioTrackSettings: sourceAudioTrackSettingsForExport,
						previewWidth,
						previewHeight,
						onProgress: (progress: ExportProgress) => {
							recordSmokeProgress(progress);
							setExportProgress(progress);
						},
					};

					const exporter =
						pipelineModel === "modern"
							? new ModernVideoExporter({
									...exporterConfig,
									backendPreference,
								})
							: new VideoExporter(exporterConfig);

					exporterRef.current = exporter;
					const result = await exporter.export();
					const smokeExportElapsedMs =
						smokeExportStartedAt !== null
							? Math.round(performance.now() - smokeExportStartedAt)
							: undefined;

					if (result.success && (result.blob || result.tempFilePath)) {
						const timestamp = Date.now();
						const fileName = `export-${timestamp}.mp4`;
						markExportAsSaving();

						let saveResult: {
							success: boolean;
							path?: string;
							message?: string;
							canceled?: boolean;
						};
						let pendingOnCancel: PendingExportSave;

						if (result.tempFilePath) {
							// Preferred path: main process already holds the finished MP4 on
							// disk, so we just ask it to move the temp file into place. This
							// avoids ever allocating a multi-GiB ArrayBuffer in the renderer.
							saveResult = await window.electronAPI.finalizeExportedVideo({
								tempPath: result.tempFilePath,
								fileName,
								outputPath:
									smokeExportConfig.enabled && smokeExportConfig.outputPath
										? smokeExportConfig.outputPath
										: null,
							});
							pendingOnCancel = { fileName, tempFilePath: result.tempFilePath };
						} else if (result.blob) {
							// Legacy fallback: some export paths still surface a Blob, but in
							// Electron we stream it into a temp file first so save/finalize
							// never requires a giant renderer ArrayBuffer.
							const blobSave = await saveBlobExport(
								result.blob,
								fileName,
								smokeExportConfig.enabled ? smokeExportConfig.outputPath : null,
							);
							saveResult = blobSave.saveResult;
							pendingOnCancel = blobSave.pendingSave;
						} else {
							saveResult = { success: false, message: "Export produced no output" };
							pendingOnCancel = { fileName };
						}

						if (saveResult.canceled) {
							if (smokeExportConfig.enabled) {
								await writeSmokeExportReport(smokeExportConfig.outputPath, {
									success: false,
									phase: "save",
									format: "mp4",
									pipelineModel,
									backendPreference,
									encodingMode,
									shadowIntensity: effectiveShadowIntensity,
									elapsedMs: smokeExportElapsedMs,
									error: "Save canceled",
									progressSamples: smokeProgressSamples,
									metrics: result.metrics,
								});
							}
							pendingExportSaveRef.current = pendingOnCancel;
							setHasPendingExportSave(true);
							setExportError(
								"Save dialog canceled. Click Save Again to save without re-rendering.",
							);
							toast.info("Save canceled. You can save again without re-exporting.");
							keepExportDialogOpen = true;
						} else if (saveResult.success && saveResult.path) {
							if (smokeExportConfig.enabled) {
								await writeSmokeExportReport(smokeExportConfig.outputPath, {
									success: true,
									phase: "saved",
									format: "mp4",
									pipelineModel,
									backendPreference,
									encodingMode,
									shadowIntensity: effectiveShadowIntensity,
									elapsedMs: smokeExportElapsedMs,
									outputPath: saveResult.path,
									progressSamples: smokeProgressSamples,
									metrics: result.metrics,
								});
							}
							if (smokeExportStartedAt !== null) {
								console.log(
									`[smoke-export] Completed in ${Math.round(performance.now() - smokeExportStartedAt)}ms (${saveResult.path})`,
								);
							}
							showExportSuccessToast(saveResult.path);
							setExportedFilePath(saveResult.path);
							if (smokeExportConfig.enabled) {
								window.close();
								return;
							}
						} else {
							if (smokeExportConfig.enabled) {
								await writeSmokeExportReport(smokeExportConfig.outputPath, {
									success: false,
									phase: "save",
									format: "mp4",
									pipelineModel,
									backendPreference,
									encodingMode,
									shadowIntensity: effectiveShadowIntensity,
									elapsedMs: smokeExportElapsedMs,
									error: saveResult.message || "Failed to save video",
									progressSamples: smokeProgressSamples,
									metrics: result.metrics,
								});
							}
							setExportError(saveResult.message || "Failed to save video");
							showExportErrorToast(saveResult.message || "Failed to save video");
							// Keep the pending-save entry so the user can retry without
							// re-rendering. The temp file is still on disk (the main
							// process only moves/deletes it on success) and the
							// ArrayBuffer fallback still references its in-memory blob.
							if (pendingOnCancel.tempFilePath || pendingOnCancel.arrayBuffer) {
								pendingExportSaveRef.current = pendingOnCancel;
								setHasPendingExportSave(true);
								keepExportDialogOpen = true;
							}
							if (smokeExportConfig.enabled) {
								window.close();
								return;
							}
						}
					} else {
						if (smokeExportConfig.enabled) {
							await writeSmokeExportReport(smokeExportConfig.outputPath, {
								success: false,
								phase: "export",
								format: "mp4",
								pipelineModel,
								backendPreference,
								encodingMode,
								shadowIntensity: effectiveShadowIntensity,
								elapsedMs: smokeExportElapsedMs,
								error: result.error || "Export failed",
								progressSamples: smokeProgressSamples,
								metrics: result.metrics,
							});
						}
						setExportError(result.error || "Export failed");
						showExportErrorToast(result.error || "Export failed");
						keepExportDialogOpen = true;
						if (smokeExportConfig.enabled) {
							window.close();
							return;
						}
					}
				}

				if (wasPlaying) {
					videoPlaybackRef.current?.play();
				} else {
					video.currentTime = restoreTime;
				}
			} catch (error) {
				console.error("Export error:", error);
				const errorMessage = error instanceof Error ? error.message : "Unknown error";
				if (smokeExportConfig.enabled) {
					await writeSmokeExportReport(smokeExportConfig.outputPath, {
						success: false,
						phase: "exception",
						format: settings.format,
						elapsedMs:
							smokeExportStartedAt !== null
								? Math.round(performance.now() - smokeExportStartedAt)
								: undefined,
						error: errorMessage,
					});
				}
				setExportError(errorMessage);
				showExportErrorToast(`Export failed: ${errorMessage}`);
				keepExportDialogOpen = true;
				if (smokeExportConfig.enabled) {
					window.close();
				}
			} finally {
				extensionHost.emitEvent({ type: "export:complete" });
				setIsExporting(false);
				exporterRef.current = null;
				setShowExportDropdown(keepExportDialogOpen);
				remountPreview();
			}
		},
		[
			clearPendingExportSave,
			videoPath,
			wallpaper,
			trimRegions,
			shadowIntensity,
			backgroundBlur,
			zoomMotionBlur,
			zoomMotionBlurTuning,
			zoomTemporalMotionBlur,
			zoomMotionBlurSampleCount,
			zoomMotionBlurShutterFraction,
			connectZooms,
			zoomInDurationMs,
			zoomInOverlapMs,
			zoomOutDurationMs,
			connectedZoomGapMs,
			connectedZoomDurationMs,
			zoomInEasing,
			zoomOutEasing,
			connectedZoomEasing,
			effectiveShowCursor,
			cursorStyle,
			effectiveCursorTelemetry,
			cursorSize,
			cursorSmoothing,
			cursorSpringStiffnessMultiplier,
			cursorSpringDampingMultiplier,
			cursorSpringMassMultiplier,
			cameraSpringStiffnessMultiplier,
			cameraSpringDampingMultiplier,
			cameraSpringMassMultiplier,
			zoomSmoothness,
			zoomClassicMode,
			cursorMotionBlur,
			cursorClickBounce,
			cursorClickBounceDuration,
			cursorSway,
			audioRegions,
			audio.sourceAudioFallbackPaths,
			audio.sourceAudioFallbackStartDelayMsByPath,
			audio.activeSourceAudioTrackSettings,
			audio.selectedClipSourceAudioTrackSettings,
			exportEncodingMode,
			exportBackendPreference,
			exportPipelineModel,
			borderRadius,
			padding,
			cropRegion,
			webcam,
			resolvedWebcamVideoUrl,
			annotationRegions,
			autoCaptions,
			autoCaptionSettings,
			isPlaying,
			exportQuality,
			effectiveZoomRegions,
			ensureSupportedMp4SourceDimensions,
			markExportAsSaving,
			mp4FrameRate,
			remountPreview,
			showExportSuccessToast,
			smokeExportConfig.backendPreference,
			smokeExportConfig.renderBackend,
			smokeExportConfig.enabled,
			smokeExportConfig.useNativeExport,
			smokeExportConfig.maxDecodeQueue,
			smokeExportConfig.maxEncodeQueue,
			smokeExportConfig.maxPendingFrames,
			smokeExportConfig.outputPath,
			smokeExportConfig.pipelineModel,
			smokeExportConfig.shadowIntensity,
			effectiveSpeedRegions,
			frame,
			selectedClipId,
			smokeExportConfig.encodingMode,
			smokeExportConfig.fps,
			smokeExportConfig.quality,
			saveBlobExport,
		],
	);

	useSmokeExportController({
		enabled: smokeExportConfig.enabled,
		projectPath: smokeExportConfig.projectPath ?? null,
		outputPath: smokeExportConfig.outputPath ?? null,
		error,
		videoPath,
		videoSourcePath,
		cursorTelemetrySourcePath,
		loading,
		isPreviewReady,
		duration,
		encodingMode: smokeExportConfig.encodingMode ?? "balanced",
		onWriteSmokeReport: writeSmokeExportReport,
		onRunExport: (settings) => void handleExport(settings),
		onCloseWindow: () => window.close(),
	});

	const handleRetrySaveExport = useCallback(async () => {
		const pendingSave = pendingExportSaveRef.current;
		if (!pendingSave) {
			return;
		}

		let saveResult: {
			success: boolean;
			path?: string;
			message?: string;
			canceled?: boolean;
		};

		if (pendingSave.tempFilePath) {
			saveResult = await window.electronAPI.finalizeExportedVideo({
				tempPath: pendingSave.tempFilePath,
				fileName: pendingSave.fileName,
				outputPath: null,
			});
		} else if (pendingSave.arrayBuffer) {
			saveResult = await window.electronAPI.saveExportedVideo(
				pendingSave.arrayBuffer,
				pendingSave.fileName,
			);
		} else {
			saveResult = { success: false, message: "No pending export to save" };
		}

		if (saveResult.canceled) {
			setExportError("Save dialog canceled. Click Save Again to save without re-rendering.");
			toast.info("Save canceled. You can try again.");
			return;
		}

		if (saveResult.success && saveResult.path) {
			// finalizeExportedVideo already moved the temp file into place, so the
			// pending-save entry no longer refers to a file on disk. Flip the flag
			// directly to avoid clearPendingExportSave issuing a spurious discard.
			pendingExportSaveRef.current = null;
			setHasPendingExportSave(false);
			setExportError(null);
			setExportedFilePath(saveResult.path);
			showExportSuccessToast(saveResult.path);
			setShowExportDropdown(true);
			return;
		}

		const errorMessage = saveResult.message || "Failed to save video";
		setExportError(errorMessage);
		toast.error(errorMessage);
	}, [showExportSuccessToast]);

	const handleOpenCropEditor = useCallback(() => {
		cropSnapshotRef.current = { ...cropRegion };
		setShowCropModal(true);
	}, [cropRegion]);

	const handleCloseCropEditor = useCallback(() => {
		setShowCropModal(false);
	}, []);

	const handleCancelCropEditor = useCallback(() => {
		if (cropSnapshotRef.current) {
			setCropRegion(cropSnapshotRef.current);
		}
		setShowCropModal(false);
	}, []);

	const isCropped = useMemo(() => {
		const top = Math.round(cropRegion.y * 100);
		const left = Math.round(cropRegion.x * 100);
		const bottom = Math.round((1 - cropRegion.y - cropRegion.height) * 100);
		const right = Math.round((1 - cropRegion.x - cropRegion.width) * 100);
		return top > 0 || left > 0 || bottom > 0 || right > 0;
	}, [cropRegion]);

	const openLightningIssues = useCallback(async () => {
		await openExternalLink(
			RECORDLY_ISSUES_URL,
			t("editor.feedback.openFailed", "Failed to open link."),
		);
	}, [t]);

	const exportUi = useExportUiController({
		videoPath,
		videoElement: videoPlaybackRef.current?.video ?? null,
		hasPendingExportSave,
		exportFormat,
		exportEncodingMode,
		mp4FrameRate,
		exportBackendPreference,
		exportPipelineModel,
		exportQuality,
		gifFrameRate,
		gifLoop,
		gifSizePreset,
		isExporting,
		exportProgress,
		exportedFilePath,
		onRunExport: handleExport,
		onClearPendingExportSave: clearPendingExportSave,
		onCancelExporter: () => exporterRef.current?.cancel(),
		onSetExportProgress: setExportProgress,
		onSetExportError: setExportError,
		onSetExportedFilePath: setExportedFilePath,
		onSetIsExporting: setIsExporting,
		onOpenLightningIssues: openLightningIssues,
		t,
	});
	const {
		showExportDropdown,
		setShowExportDropdown,
		handleOpenExportDropdown,
		handleStartExportFromDropdown,
		handleCancelExport,
		handleExportDropdownClose,
		revealExportedFile,
		isExportSaving,
		isExportPreparing,
		isRenderingAudio,
		exportFinalizingProgress,
		isExportFinalSaveIndeterminate,
		isLightningExportInProgress,
		shouldSuspendPreviewRendering,
		isLegacyExportInProgress,
		exportRenderSpeedLabel,
		exportRuntimeLabel,
		exportNativeSkipLabel,
		exportPercentLabel,
	} = exportUi;

	const projectBrowser = (
		<ProjectBrowserDialog
			open={projectBrowserOpen}
			onOpenChange={setProjectBrowserOpen}
			entries={projectLibraryEntries}
			anchorRef={error ? projectBrowserFallbackTriggerRef : projectBrowserTriggerRef}
			onOpenProject={(projectPath) => {
				void handleOpenProjectFromLibrary(projectPath);
			}}
		/>
	);
	const nativeCaptureUnavailableDialog = (
		<Dialog
			open={nativeCaptureUnavailableModalOpen}
			onOpenChange={setNativeCaptureUnavailableModalOpen}
		>
			<DialogContent className="max-w-md bg-editor-dialog border-foreground/10 text-foreground">
				<DialogHeader>
					<DialogTitle>
						{t(
							"editor.nativeCaptureUnavailable.title",
							"Nothing’s broken, but we won’t be able to render an animated cursor overlay.",
						)}
					</DialogTitle>
					<DialogDescription className="text-muted-foreground">
						{t(
							"editor.nativeCaptureUnavailable.description",
							"Your device does not support native capture. This could be for a variety of reasons we haven’t figured out yet. This doesn’t break Recordly, but it does make cursor smoothing impossible.",
						)}
					</DialogDescription>
				</DialogHeader>
				<DialogFooter>
					<Button onClick={() => setNativeCaptureUnavailableModalOpen(false)}>
						{t("editor.nativeCaptureUnavailable.confirm", "Okay")}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);

	if (loading) {
		return (
			<div className="flex h-screen items-center justify-center bg-background">
				<div className="text-foreground">Loading video...</div>
				{projectBrowser}
				{nativeCaptureUnavailableDialog}
				<Toaster className="pointer-events-auto" />
			</div>
		);
	}
	if (error) {
		return (
			<div className="flex h-screen items-center justify-center bg-background">
				<div className="flex flex-col items-center gap-3">
					<div className="text-destructive">{error}</div>
					<button
						ref={projectBrowserFallbackTriggerRef}
						type="button"
						onClick={handleOpenProjectBrowser}
						className="rounded-[5px] bg-neutral-800 px-3 py-1.5 text-sm font-semibold text-white shadow-[0_14px_32px_rgba(0,0,0,0.18)] transition-colors hover:bg-neutral-700 dark:bg-white dark:text-black dark:hover:bg-white/90"
					>
						Open Projects
					</button>
				</div>
				{projectBrowser}
				{nativeCaptureUnavailableDialog}
				<Toaster className="pointer-events-auto" />
			</div>
		);
	}

	return (
		<div className="flex flex-col h-screen bg-editor-bg text-foreground overflow-hidden selection:bg-[#2563EB]/30">
			<EditorHeader>
				<div
					className={`flex items-center gap-1.5 justify-self-start ${headerLeftControlsPaddingClass}`}
					style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
				>
					<Button
						ref={projectBrowserTriggerRef}
						type="button"
						variant="ghost"
						size="sm"
						onClick={handleOpenProjectBrowser}
						className={APP_HEADER_ICON_BUTTON_CLASS}
						title={t("editor.project.projects", "Open projects")}
						aria-label={t("editor.project.projects", "Open projects")}
					>
						<FolderOpen className="h-4 w-4" />
					</Button>
					<DiscordLinkButton />
					<FeedbackDialog />
					<div className="ml-1 h-5 w-px bg-foreground/10" />
					<Button
						type="button"
						variant="ghost"
						onClick={handleUndo}
						disabled={!canUndo}
						className="inline-flex h-8 w-8 items-center justify-center rounded-[5px] border border-foreground/10 bg-foreground/5 p-0 text-foreground transition-colors hover:bg-foreground/10 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
						title={t("common.actions.undo", "Undo")}
						aria-label={t("common.actions.undo", "Undo")}
					>
						<Undo2 className="h-4 w-4" />
					</Button>
					<Button
						type="button"
						variant="ghost"
						onClick={handleRedo}
						disabled={!canRedo}
						className="inline-flex h-8 w-8 items-center justify-center rounded-[5px] border border-foreground/10 bg-foreground/5 p-0 text-foreground transition-colors hover:bg-foreground/10 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
						title={t("common.actions.redo", "Redo")}
						aria-label={t("common.actions.redo", "Redo")}
					>
						<Redo2 className="h-4 w-4" />
					</Button>
				</div>
				<div
					className="absolute left-1/2 flex min-w-0 -translate-x-1/2 items-center justify-center"
					style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
				>
					{isEditingProjectName ? (
						<form
							onSubmit={(event) => void handleProjectNameSubmit(event)}
							className="flex max-w-[min(52vw,460px)] items-baseline gap-1 rounded-[7px] border border-foreground/10 bg-editor-panel/[0.88] px-2.5 py-1 shadow-[0_10px_28px_rgba(0,0,0,0.18)]"
						>
							{hasUnsavedChanges ? (
								<span className="mt-[1px] size-2 shrink-0 rounded-full bg-[#2563EB]" />
							) : null}
							<input
								ref={projectNameInputRef}
								type="text"
								value={projectNameDraft}
								onChange={(event) => setProjectNameDraft(event.target.value)}
								onBlur={() => {
									if (!isSavingProjectName) {
										closeProjectNameEditor();
									}
								}}
								onKeyDown={(event) => {
									if (event.key === "Escape") {
										event.preventDefault();
										closeProjectNameEditor();
									}
								}}
								disabled={isSavingProjectName}
								className="min-w-[10ch] max-w-[min(40vw,360px)] bg-transparent text-sm font-semibold tracking-tight text-foreground/95 outline-none placeholder:text-muted-foreground/60 disabled:cursor-wait"
								style={{ width: `${Math.max(projectNameDraft.length, 10)}ch` }}
								aria-label={t("editor.project.renameInput", "Project name")}
							/>
							<span className="shrink-0 text-xs font-medium tracking-tight text-muted-foreground/70">
								.recordly
							</span>
						</form>
					) : (
						<button
							type="button"
							onClick={() => setIsEditingProjectName(true)}
							className="inline-flex max-w-[min(52vw,460px)] items-baseline gap-1 rounded-[7px] px-2.5 py-1 transition-colors hover:bg-foreground/5"
							title={t("editor.project.renameTitle", "Rename project")}
							aria-label={t("editor.project.renameTitle", "Rename project")}
						>
							{hasUnsavedChanges ? (
								<span className="mt-[1px] size-2 shrink-0 rounded-full bg-[#2563EB]" />
							) : null}
							<span className="truncate text-sm font-semibold tracking-tight text-foreground/90">
								{projectDisplayName}
							</span>
							<span className="shrink-0 text-xs font-medium tracking-tight text-muted-foreground/70">
								.recordly
							</span>
						</button>
					)}
				</div>
				<div
					className="flex items-center justify-self-end pr-3"
					style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
				>
					<PresetManager t={t} />
					<div
						aria-hidden="true"
						className="mx-2 h-4 w-px shrink-0 bg-foreground/10 opacity-0"
					/>
					<EditorExportMenu
						open={showExportDropdown}
						onOpenChange={setShowExportDropdown}
						onOpenClick={handleOpenExportDropdown}
						isExporting={isExporting}
						exportError={exportError}
						exportedFilePath={exportedFilePath}
						hasPendingExportSave={hasPendingExportSave}
						onCancelExport={handleCancelExport}
						onRetrySaveExport={handleRetrySaveExport}
						onClose={handleExportDropdownClose}
						onRevealExportedFile={revealExportedFile}
						isLightningExportInProgress={isLightningExportInProgress}
						isLegacyExportInProgress={isLegacyExportInProgress}
						onOpenLightningIssues={openLightningIssues}
						isExportPreparing={isExportPreparing}
						isExportSaving={isExportSaving}
						isExportFinalSaveIndeterminate={isExportFinalSaveIndeterminate}
						isRenderingAudio={isRenderingAudio}
						exportProgressPercentage={
							isRenderingAudio
								? (exportProgress?.audioProgress ?? 0) * 100
								: (exportFinalizingProgress ?? exportProgress?.percentage ?? 8)
						}
						exportPercentLabel={exportPercentLabel}
						exportRenderSpeedLabel={exportRenderSpeedLabel}
						exportRuntimeLabel={exportRuntimeLabel}
						exportNativeSkipLabel={exportNativeSkipLabel}
						exportSettingsMenuProps={{
							exportFormat,
							onExportFormatChange: setExportFormat,
							exportEncodingMode,
							onExportEncodingModeChange: setExportEncodingMode,
							mp4FrameRate,
							onMp4FrameRateChange: setMp4FrameRate,
							exportPipelineModel,
							onExportPipelineModelChange: setExportPipelineModel,
							exportQuality,
							onExportQualityChange: setExportQuality,
							gifFrameRate,
							onGifFrameRateChange: setGifFrameRate,
							gifLoop,
							onGifLoopChange: setGifLoop,
							gifSizePreset,
							onGifSizePresetChange: setGifSizePreset,
							mp4OutputDimensions,
							gifOutputDimensions,
							onExport: handleStartExportFromDropdown,
						}}
						labels={{
							export: t("common.actions.export", "Export"),
							exporting: t("editor.exportStatus.exporting", "Exporting"),
							renderingFile: t(
								"editor.exportStatus.renderingFile",
								"Rendering your file.",
							),
							cancel: t("common.actions.cancel"),
							processingAudioEdits: t(
								"editor.export.processingAudioEdits",
								"Processing audio with speed/overlay edits",
							),
							exportIssue: t("editor.exportStatus.issue", "Export issue"),
							saveAgain: t("editor.actions.saveAgain", "Save Again"),
							close: t("common.actions.close", "Close"),
							exportComplete: t("editor.exportStatus.complete", "Export complete"),
							savedSuccessfully: t(
								"editor.exportStatus.savedSuccessfully",
								"Your file was saved successfully.",
							),
							showInFolder: t("editor.actions.showInFolder", "Show In Folder"),
							done: "Done",
						}}
					/>
				</div>
			</EditorHeader>

			<div className="relative flex min-h-0 flex-1 flex-col gap-3 p-4">
				<div className="flex min-h-0 flex-1 gap-3 relative z-10">
					<EditorSidebar editorSectionButtons={editorSectionButtons} t={t} renderPanel={({ onUploadWebcam, onClearWebcam }) =>
							activeEffectSection === "extensions" ? (
								<ExtensionManager />
							) : (
								<SettingsPanel
								panelMode="editor"
								activeEffectSection={activeEffectSection}
								selected={wallpaper}
								onWallpaperChange={setWallpaper}
								selectedZoomDepth={
									selectedZoomId
										? zoomRegions.find((z) => z.id === selectedZoomId)?.depth
										: null
								}
								onZoomDepthChange={(depth) =>
									selectedZoomId && handleZoomDepthChange(depth)
								}
								selectedZoomId={selectedZoomId}
								selectedZoomMode={
									selectedZoomId
										? (zoomRegions.find((z) => z.id === selectedZoomId)?.mode ??
											"auto")
										: null
								}
								onZoomModeChange={(mode) =>
									selectedZoomId && handleZoomModeChange(mode)
								}
								onZoomDelete={handleZoomDelete}
								selectedClipId={selectedClipId}
								selectedClipSpeed={
									selectedClipId
										? clipRegions.find((c) => c.id === selectedClipId)?.speed ?? 1
										: null
								}
								selectedClipMuted={
									selectedClipId
										? clipRegions.find((c) => c.id === selectedClipId)?.muted ??
											false
										: null
								}
								selectedClipShowSourceAudio={
									selectedClipId
										? clipRegions.find((c) => c.id === selectedClipId)
												?.showSourceAudio ?? false
										: null
								}
								onClipSpeedChange={handleClipSpeedChange}
								onClipMutedChange={handleClipMutedChange}
								onClipShowSourceAudioChange={handleClipShowSourceAudioChange}
								onClipDelete={handleClipDelete}
								hasClipSourceAudio={hasClipSourceAudio}
								sourceAudioTrackMeta={audio.sourceAudioTrackMeta}
								sourceAudioTrackSettings={audio.selectedClipSourceAudioTrackSettings}
								onSourceAudioTrackVolumeChange={
									audio.onSelectedClipSourceAudioTrackVolumeChange
								}
								onSourceAudioTrackNormalizeChange={
									audio.onSelectedClipSourceAudioTrackNormalizeChange
								}
								selectedAudioId={selectedAudioId}
									selectedAudioVolume={
										selectedAudioId
											? (audioRegions.find((r) => r.id === selectedAudioId)
													?.volume ?? null)
											: null
									}
									selectedAudioNormalize={
										selectedAudioId
											? (audioRegions.find((r) => r.id === selectedAudioId)
													?.normalize ?? false)
											: null
									}
									onAudioVolumeChange={handleAudioVolumeChange}
									onAudioNormalizeChange={handleAudioNormalizeChange}
									onAudioDelete={handleAudioDelete}
								shadowIntensity={shadowIntensity}
								onShadowChange={setShadowIntensity}
								backgroundBlur={backgroundBlur}
								onBackgroundBlurChange={setBackgroundBlur}
								zoomMotionBlurTuning={zoomMotionBlurTuning}
								onZoomMotionBlurTuningChange={setZoomMotionBlurTuning}
								zoomTemporalMotionBlur={zoomTemporalMotionBlur}
								onZoomTemporalMotionBlurChange={setZoomTemporalMotionBlur}
								zoomMotionBlurSampleCount={zoomMotionBlurSampleCount}
								onZoomMotionBlurSampleCountChange={setZoomMotionBlurSampleCount}
								zoomMotionBlurShutterFraction={zoomMotionBlurShutterFraction}
								onZoomMotionBlurShutterFractionChange={
									setZoomMotionBlurShutterFraction
								}
								autoApplyFreshRecordingAutoZooms={autoApplyFreshRecordingAutoZooms}
								onAutoApplyFreshRecordingAutoZoomsChange={
									setAutoApplyFreshRecordingAutoZooms
								}
								connectZooms={connectZooms}
								onConnectZoomsChange={setConnectZooms}
								zoomInDurationMs={zoomInDurationMs}
								onZoomInDurationMsChange={setZoomInDurationMs}
								zoomInOverlapMs={zoomInOverlapMs}
								onZoomInOverlapMsChange={setZoomInOverlapMs}
								zoomOutDurationMs={zoomOutDurationMs}
								onZoomOutDurationMsChange={setZoomOutDurationMs}
								connectedZoomGapMs={connectedZoomGapMs}
								onConnectedZoomGapMsChange={setConnectedZoomGapMs}
								connectedZoomDurationMs={connectedZoomDurationMs}
								onConnectedZoomDurationMsChange={setConnectedZoomDurationMs}
								zoomInEasing={zoomInEasing}
								onZoomInEasingChange={setZoomInEasing}
								zoomOutEasing={zoomOutEasing}
								onZoomOutEasingChange={setZoomOutEasing}
								connectedZoomEasing={connectedZoomEasing}
								onConnectedZoomEasingChange={setConnectedZoomEasing}
								showCursor={effectiveShowCursor}
								onShowCursorChange={handleShowCursorChange}
								loopCursor={loopCursor}
								onLoopCursorChange={setLoopCursor}
								cursorStyle={cursorStyle}
								onCursorStyleChange={setCursorStyle}
								cursorSize={cursorSize}
								onCursorSizeChange={setCursorSize}
								cursorSmoothing={cursorSmoothing}
								onCursorSmoothingChange={setCursorSmoothing}
								cursorSpringStiffnessMultiplier={cursorSpringStiffnessMultiplier}
								onCursorSpringStiffnessMultiplierChange={
									setCursorSpringStiffnessMultiplier
								}
								cursorSpringDampingMultiplier={cursorSpringDampingMultiplier}
								onCursorSpringDampingMultiplierChange={
									setCursorSpringDampingMultiplier
								}
								cursorSpringMassMultiplier={cursorSpringMassMultiplier}
								onCursorSpringMassMultiplierChange={setCursorSpringMassMultiplier}
								cameraSpringStiffnessMultiplier={cameraSpringStiffnessMultiplier}
								onCameraSpringStiffnessMultiplierChange={
									setCameraSpringStiffnessMultiplier
								}
								cameraSpringDampingMultiplier={cameraSpringDampingMultiplier}
								onCameraSpringDampingMultiplierChange={
									setCameraSpringDampingMultiplier
								}
								cameraSpringMassMultiplier={cameraSpringMassMultiplier}
								onCameraSpringMassMultiplierChange={setCameraSpringMassMultiplier}
								zoomClassicMode={zoomClassicMode}
								onZoomClassicModeChange={setZoomClassicMode}
								cursorMotionBlur={cursorMotionBlur}
								onCursorMotionBlurChange={setCursorMotionBlur}
								cursorClickBounce={cursorClickBounce}
								onCursorClickBounceChange={setCursorClickBounce}
								cursorClickBounceDuration={cursorClickBounceDuration}
								onCursorClickBounceDurationChange={setCursorClickBounceDuration}
								cursorSway={cursorSway}
								onCursorSwayChange={setCursorSway}
								borderRadius={borderRadius}
								onBorderRadiusChange={setBorderRadius}
								webcam={webcam}
								webcamPreviewSrc={webcam.sourcePath ? resolvedWebcamVideoUrl : null}
								webcamPreviewCurrentTime={currentTime}
								webcamPreviewPlaying={isPlaying}
								onWebcamChange={setWebcam}
								onUploadWebcam={onUploadWebcam}
								onClearWebcam={onClearWebcam}
								padding={padding}
								onPaddingChange={setPadding}
								frame={frame}
								onFrameChange={setFrame}
								cropRegion={cropRegion}
								onCropChange={setCropRegion}
								aspectRatio={aspectRatio}
								onAspectRatioChange={setAspectRatio}
								selectedAnnotationId={selectedAnnotationId}
								annotationRegions={annotationRegions}
								autoCaptions={autoCaptions}
								autoCaptionSettings={autoCaptionSettings}
								whisperExecutablePath={whisperExecutablePath}
								whisperModelPath={whisperModelPath}
								whisperModelDownloadStatus={whisperModelDownloadStatus}
								whisperModelDownloadProgress={whisperModelDownloadProgress}
								isGeneratingCaptions={isGeneratingCaptions}
								onAutoCaptionSettingsChange={setAutoCaptionSettings}
								onPickWhisperExecutable={handlePickWhisperExecutable}
								onPickWhisperModel={handlePickWhisperModel}
								onGenerateAutoCaptions={handleGenerateAutoCaptions}
								onClearAutoCaptions={handleClearAutoCaptions}
								onDownloadWhisperSmallModel={handleDownloadWhisperSmallModel}
								onDeleteWhisperSmallModel={handleDeleteWhisperSmallModel}
								nativeCaptureUnavailableSession={sessionNativeCaptureUnavailable}
								onOpenNativeCaptureUnavailableModal={() =>
									setNativeCaptureUnavailableModalOpen(true)
								}
								onAnnotationContentChange={handleAnnotationContentChange}
								onAnnotationTypeChange={handleAnnotationTypeChange}
								onAnnotationStyleChange={handleAnnotationStyleChange}
								onAnnotationFigureDataChange={handleAnnotationFigureDataChange}
								onAnnotationBlurIntensityChange={
									handleAnnotationBlurIntensityChange
								}
								onAnnotationBlurColorChange={handleAnnotationBlurColorChange}
								onAnnotationDelete={handleAnnotationDelete}
							/>
							)
						}
					/>
					<div className="flex min-h-0 flex-1 flex-col gap-3">
						<EditorPreviewArea onOpenCropEditor={handleOpenCropEditor}
							isCropped={isCropped}
							fallbackVideoAspectRatio={
								videoPlaybackRef.current?.video?.videoHeight
									? (videoPlaybackRef.current.video.videoWidth /
										videoPlaybackRef.current.video.videoHeight)
									: 16 / 9
							}
						>
							<VideoPlayback
												key={`${videoPath || "no-video"}:${previewVersion}`}
												aspectRatio={aspectRatio}
												ref={videoPlaybackRef}
												videoPath={videoPath || ""}
												onDurationChange={setDuration}
												onPreviewReadyChange={setIsPreviewReady}
												onTimeUpdate={setCurrentTime}
												currentTime={currentTime}
												onPlayStateChange={setIsPlaying}
												onError={setError}
												wallpaper={wallpaper}
												zoomRegions={effectiveZoomRegions}
												selectedZoomId={selectedZoomId}
												onSelectZoom={handleSelectZoom}
												onZoomFocusChange={handleZoomFocusChange}
												isPlaying={isPlaying}
												showShadow={shadowIntensity > 0}
												shadowIntensity={shadowIntensity}
												backgroundBlur={backgroundBlur}
												connectZooms={connectZooms}
												zoomInDurationMs={zoomInDurationMs}
												zoomInOverlapMs={zoomInOverlapMs}
												zoomOutDurationMs={zoomOutDurationMs}
												connectedZoomGapMs={connectedZoomGapMs}
												connectedZoomDurationMs={connectedZoomDurationMs}
												zoomInEasing={zoomInEasing}
												zoomOutEasing={zoomOutEasing}
												connectedZoomEasing={connectedZoomEasing}
												borderRadius={borderRadius}
												padding={padding}
												frame={frame}
												cropRegion={cropRegion}
												webcam={webcam}
												webcamVideoPath={
													webcam.sourcePath
														? resolvedWebcamVideoUrl
														: null
												}
												trimRegions={trimRegions}
												speedRegions={effectiveSpeedRegions}
												annotationRegions={annotationRegions}
												autoCaptions={autoCaptions}
												autoCaptionSettings={autoCaptionSettings}
												selectedAnnotationId={selectedAnnotationId}
												onSelectAnnotation={handleSelectAnnotation}
												onAnnotationPositionChange={
													handleAnnotationPositionChange
												}
												onAnnotationSizeChange={handleAnnotationSizeChange}
												cursorTelemetry={effectiveCursorTelemetry}
												showCursor={effectiveShowCursor}
												cursorStyle={cursorStyle}
												cursorSize={cursorSize}
												cursorSmoothing={cursorSmoothing}
												cursorSpringStiffnessMultiplier={
													cursorSpringStiffnessMultiplier
												}
												cursorSpringDampingMultiplier={
													cursorSpringDampingMultiplier
												}
												cursorSpringMassMultiplier={
													cursorSpringMassMultiplier
												}
												cameraSpringStiffnessMultiplier={
													cameraSpringStiffnessMultiplier
												}
												cameraSpringDampingMultiplier={
													cameraSpringDampingMultiplier
												}
												cameraSpringMassMultiplier={
													cameraSpringMassMultiplier
												}
												zoomSmoothness={zoomSmoothness}
												zoomClassicMode={zoomClassicMode}
												zoomMotionBlur={zoomMotionBlur}
												zoomMotionBlurTuning={zoomMotionBlurTuning}
												cursorMotionBlur={cursorMotionBlur}
												cursorClickBounce={cursorClickBounce}
												cursorClickBounceDuration={
													cursorClickBounceDuration
												}
												cursorSway={cursorSway}
												volume={
													audio.shouldMutePreviewVideo || audio.isCurrentClipMuted
														? 0
														: Math.max(
																0,
																Math.min(
																	1,
																	previewVolume * audio.embeddedSourcePreviewGain,
																),
															)
												}
												suspendRendering={shouldSuspendPreviewRendering}
							/>
						</EditorPreviewArea>
						<EditorTimelineToolbar
							onAddAnnotation={() => {
								const nextTrackIndex =
									annotationRegions.length > 0
										? Math.max(...annotationRegions.map((r) => r.trackIndex ?? 0)) + 1
										: 0;
								timelineRef.current?.addAnnotation(nextTrackIndex);
							}}
							onAddAudio={() => {
								const nextTrackIndex =
									audioRegions.length > 0
										? Math.max(...audioRegions.map((region) => region.trackIndex ?? 0)) + 1
										: 0;
								timelineRef.current?.addAudio(nextTrackIndex);
							}}
							onAddZoom={() => timelineRef.current?.addZoom()}
							onSuggestZooms={() => timelineRef.current?.suggestZooms()}
							onSplitClip={() => timelineRef.current?.splitClip()}
							timelinePlayheadTimeLabel={formatTime(timelinePlayheadTime)}
							timelineDurationLabel={formatTime(timelineDuration)}
							isPlaying={isPlaying}
							onSkipBack={() => {
								const currentMs = timelinePlayheadTime * 1000;
								const kfs = timelineRef.current?.keyframes ?? [];
								const prev = [...kfs].reverse().find((k) => k.time < currentMs - 50);
								handleSeek(prev ? prev.time / 1000 : Math.max(0, timelinePlayheadTime - 5));
							}}
							onTogglePlayPause={togglePlayPause}
							onSkipForward={() => {
								const currentMs = timelinePlayheadTime * 1000;
								const kfs = timelineRef.current?.keyframes ?? [];
								const next = kfs.find((k) => k.time > currentMs + 50);
								handleSeek(
									next ? next.time / 1000 : Math.min(timelineDuration, timelinePlayheadTime + 5),
								);
							}}
							timelineCollapsed={timelineCollapsed}
							onToggleTimelineCollapsed={toggleTimelineCollapsed}
							previewVolume={previewVolume}
							onToggleMute={() => setPreviewVolume(previewVolume <= 0.001 ? 1 : 0)}
							onPreviewVolumeChange={setPreviewVolume}
							labels={{
								addLayer: t("editor.toolbar.addLayer"),
								annotation: t("timeline.annotation.label"),
								audio: t("timeline.audio.label"),
								splitClip: t("editor.toolbar.splitClip"),
								addZoom: t("timeline.zoom.addZoom"),
								suggestZooms: t("timeline.zoom.suggestZooms"),
								skipBack: t("editor.playback.skipBack"),
								skipForward: t("editor.playback.skipForward"),
								expandTimeline: t("editor.timeline.expand"),
								collapseTimeline: t("editor.timeline.collapse"),
								muteUnmute: t("editor.playback.muteUnmute"),
								play: "Play",
								pause: "Pause",
							}}
						/>
					</div>
				</div>
				<EditorTimelineArea>
					<TimelineEditor
						ref={timelineRef}
						videoDuration={timelineDuration}
						currentTime={currentTime}
						playheadTime={timelinePlayheadTime}
						onSeek={handleTimelineSeek}
						videoPath={videoPath}
						videoSourcePath={videoSourcePath}
						cursorTelemetrySourcePath={cursorTelemetrySourcePath}
						cursorTelemetry={normalizedCursorTelemetry}
						autoSuggestZoomsTrigger={autoSuggestZoomsTrigger}
						onAutoSuggestZoomsConsumed={handleAutoSuggestZoomsConsumed}
						disableSuggestedZooms={!autoApplyFreshRecordingAutoZooms}
						zoomRegions={zoomRegions}
						onZoomAdded={handleZoomAdded}
						onZoomSuggested={handleZoomSuggested}
						onZoomSpanChange={handleZoomSpanChange}
						onZoomDelete={handleZoomDelete}
						selectedZoomId={selectedZoomId}
						onSelectZoom={handleSelectZoom}
						trimRegions={trimRegions}
						clipRegions={clipRegions}
						onClipSplit={handleClipSplit}
						onClipSpanChange={handleClipSpanChange}
						selectedClipId={selectedClipId}
						onSelectClip={handleSelectClip}
						audioRegions={audioRegions}
						onAudioAdded={handleAudioAdded}
						onAudioSpanChange={handleAudioSpanChange}
						onAudioDelete={handleAudioDelete}
						selectedAudioId={selectedAudioId}
						onSelectAudio={handleSelectAudio}
						annotationRegions={annotationRegions}
						onAnnotationAdded={handleAnnotationAdded}
						onAnnotationSpanChange={handleAnnotationSpanChange}
						onAnnotationDelete={handleAnnotationDelete}
						selectedAnnotationId={selectedAnnotationId}
						onSelectAnnotation={handleSelectAnnotation}
						showSourceAudioTrack={clipRegions.some((c) => c.showSourceAudio)}
						sourceAudioTrackSettings={audio.activeSourceAudioTrackSettings}
						getSourceAudioTrackSettingsForClip={
							audio.getSourceAudioTrackSettingsForClip
						}
						onSourceAudioAvailabilityChange={(available) => {
							setHasClipSourceAudio(available);
						}}
						onSourceAudioTracksMetaChange={(tracks) => {
							audio.onSourceAudioTracksMetaChange(tracks);
						}}
					/>
				</EditorTimelineArea>
			</div>

			{showCropModal ? (
				<>
					<div
						className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
						onClick={handleCancelCropEditor}
					/>
					<div className="fixed left-1/2 top-1/2 z-[60] max-h-[90vh] w-[90vw] max-w-5xl -translate-x-1/2 -translate-y-1/2 overflow-auto rounded-2xl border border-foreground/10 bg-editor-dialog p-8 shadow-2xl animate-in zoom-in-95 duration-200">
						<div className="mb-6 flex items-center justify-between">
							<div>
								<span className="text-xl font-bold text-foreground">
									{t("settings.crop.title")}
								</span>
								<p className="mt-2 text-sm text-muted-foreground">
									{t("settings.crop.instruction")}
								</p>
							</div>
							<Button
								variant="ghost"
								size="icon"
								onClick={handleCancelCropEditor}
								className="text-muted-foreground hover:bg-foreground/10 hover:text-foreground"
							>
								<X className="h-5 w-5" />
							</Button>
						</div>
						<CropControl
							videoElement={videoPlaybackRef.current?.video || null}
							cropRegion={cropRegion}
							onCropChange={setCropRegion}
							aspectRatio={aspectRatio}
						/>
						<div className="mt-6 flex justify-end">
							<Button
								onClick={handleCloseCropEditor}
								size="lg"
								className="bg-[#2563EB] text-white hover:bg-[#2563EB]/90"
							>
								{t("common.actions.done")}
							</Button>
						</div>
					</div>
				</>
			) : null}

			{projectBrowser}
			{nativeCaptureUnavailableDialog}

			<Toaster className="pointer-events-auto" />
		</div>
	);
}
