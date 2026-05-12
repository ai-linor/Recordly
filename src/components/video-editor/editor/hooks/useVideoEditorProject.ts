import { type MutableRefObject, type RefObject, useCallback, useMemo } from "react";
import {
	createProjectData,
	deriveNextId,
	type EditorProjectData,
	fromFileUrl,
	normalizeProjectEditor,
	stripPersistedDevMotionBlurSettings,
	validateProjectData,
} from "../../projectPersistence";
import type { ClipRegion, WebcamOverlaySettings } from "../../types";
import type { VideoPlaybackRef } from "../../VideoPlayback";
import { useProjectController, type UseProjectResult } from "./useProject";

type TimelineStateLike = {
	replaceState: (next: {
		zoomRegions: any[];
		clipRegions: any[];
		speedRegions: any[];
		annotationRegions: any[];
		audioRegions: any[];
		autoCaptions: any[];
		selectedZoomId: string | null;
		selectedClipId: string | null;
		selectedAnnotationId: string | null;
		selectedAudioId: string | null;
	}) => void;
};

type EditorRefs = {
	videoPlaybackRef: RefObject<VideoPlaybackRef | null>;
	pendingFreshRecordingAutoZoomPathRef: MutableRefObject<string | null>;
	clipInitializedRef: MutableRefObject<boolean>;
	autoFullTrackClipIdRef: MutableRefObject<string | null>;
	autoFullTrackClipEndMsRef: MutableRefObject<number | null>;
	nextZoomIdRef: MutableRefObject<number>;
	nextClipIdRef: MutableRefObject<number>;
	nextAudioIdRef: MutableRefObject<number>;
	nextAnnotationIdRef: MutableRefObject<number>;
	nextAnnotationZIndexRef: MutableRefObject<number>;
};

type EditorRuntime = {
	currentProjectPath: string | null;
	currentSourcePath: string | null;
	lastSavedProjectId: string | null;
	currentPersistedEditorState: any;
	webcamTimeOffsetMs: number;
	resolveVideoUrl: (sourcePath: string) => Promise<string>;
	applySessionPresentation: (
		session:
			| {
					hideOverlayCursorByDefault?: boolean;
					nativeCaptureUnavailable?: boolean;
			  }
			| null
			| undefined,
	) => void;
	buildPersistedEditorState: (editor: any) => any;
	captureProjectThumbnail: () => Promise<string | null | undefined>;
	remountPreview: () => void;
};

type EditorSetters = {
	setIsPlaying: (next: boolean) => void;
	setCurrentTime: (next: number) => void;
	setDuration: (next: number) => void;
	setError: (next: string | null) => void;
	setVideoSourcePath: (next: string) => void;
	setVideoPath: (next: string) => void;
	setCurrentProjectPath: (next: string | null) => void;
	setWallpaper: (next: any) => void;
	setShadowIntensity: (next: any) => void;
	setBackgroundBlur: (next: any) => void;
	setZoomMotionBlur: (next: any) => void;
	setZoomMotionBlurTuning: (next: any) => void;
	setZoomTemporalMotionBlur: (next: any) => void;
	setZoomMotionBlurSampleCount: (next: any) => void;
	setZoomMotionBlurShutterFraction: (next: any) => void;
	setConnectZooms: (next: any) => void;
	setZoomInDurationMs: (next: any) => void;
	setZoomInOverlapMs: (next: any) => void;
	setZoomOutDurationMs: (next: any) => void;
	setConnectedZoomGapMs: (next: any) => void;
	setConnectedZoomDurationMs: (next: any) => void;
	setZoomInEasing: (next: any) => void;
	setZoomOutEasing: (next: any) => void;
	setConnectedZoomEasing: (next: any) => void;
	setShowCursor: (next: any) => void;
	setLoopCursor: (next: any) => void;
	setCursorStyle: (next: any) => void;
	setCursorSize: (next: any) => void;
	setCursorSmoothing: (next: any) => void;
	setCursorSpringStiffnessMultiplier: (next: any) => void;
	setCursorSpringDampingMultiplier: (next: any) => void;
	setCursorSpringMassMultiplier: (next: any) => void;
	setCameraSpringStiffnessMultiplier: (next: any) => void;
	setCameraSpringDampingMultiplier: (next: any) => void;
	setCameraSpringMassMultiplier: (next: any) => void;
	setZoomSmoothness: (next: any) => void;
	setZoomClassicMode: (next: any) => void;
	setCursorMotionBlur: (next: any) => void;
	setCursorClickBounce: (next: any) => void;
	setCursorClickBounceDuration: (next: any) => void;
	setCursorSway: (next: any) => void;
	setBorderRadius: (next: any) => void;
	setPadding: (next: any) => void;
	setFrame: (next: any) => void;
	setCropRegion: (next: any) => void;
	setWebcam: (next: WebcamOverlaySettings) => void;
	setTrimRegions: (next: any) => void;
	setSourceAudioTrackSettingsByClip: (next: any) => void;
	setDefaultSourceAudioTrackSettings: (next: any) => void;
	setAutoCaptionSettings: (next: any) => void;
	setAspectRatio: (next: any) => void;
	setExportEncodingMode: (next: any) => void;
	setExportBackendPreference: (next: any) => void;
	setExportPipelineModel: (next: any) => void;
	setExportQuality: (next: any) => void;
	setMp4FrameRate: (next: any) => void;
	setExportFormat: (next: any) => void;
	setGifFrameRate: (next: any) => void;
	setGifLoop: (next: any) => void;
	setGifSizePreset: (next: any) => void;
	setLastSavedSnapshot: (next: any) => void;
};

type UseVideoEditorProjectArgs = {
	projectManager: UseProjectResult<EditorProjectData>;
	timelineState: TimelineStateLike;
	editorRefs: EditorRefs;
	editorRuntime: EditorRuntime;
	editorSetters: EditorSetters;
	projectDisplayName: string;
	cloneStructured: <T>(value: T) => T;
	onMenuLoadProject: (handler: () => void) => (() => void) | undefined;
	onMenuSaveProject: (handler: () => void) => (() => void) | undefined;
	onMenuSaveProjectAs: (handler: () => void) => (() => void) | undefined;
	onRequestSaveBeforeClose: (handler: () => Promise<boolean>) => (() => void) | undefined;
};

function applyLoadedProjectVisualSettings(editorSetters: EditorSetters, normalizedEditor: any) {
	editorSetters.setWallpaper(normalizedEditor.wallpaper);
	editorSetters.setShadowIntensity(normalizedEditor.shadowIntensity);
	editorSetters.setBackgroundBlur(normalizedEditor.backgroundBlur);
	editorSetters.setZoomMotionBlur(normalizedEditor.zoomMotionBlur);
	editorSetters.setZoomMotionBlurTuning({ ...normalizedEditor.zoomMotionBlurTuning });
	editorSetters.setZoomTemporalMotionBlur(normalizedEditor.zoomTemporalMotionBlur);
	editorSetters.setZoomMotionBlurSampleCount(normalizedEditor.zoomMotionBlurSampleCount);
	editorSetters.setZoomMotionBlurShutterFraction(normalizedEditor.zoomMotionBlurShutterFraction);
	editorSetters.setConnectZooms(normalizedEditor.connectZooms);
	editorSetters.setZoomInDurationMs(normalizedEditor.zoomInDurationMs);
	editorSetters.setZoomInOverlapMs(normalizedEditor.zoomInOverlapMs);
	editorSetters.setZoomOutDurationMs(normalizedEditor.zoomOutDurationMs);
	editorSetters.setConnectedZoomGapMs(normalizedEditor.connectedZoomGapMs);
	editorSetters.setConnectedZoomDurationMs(normalizedEditor.connectedZoomDurationMs);
	editorSetters.setZoomInEasing(normalizedEditor.zoomInEasing);
	editorSetters.setZoomOutEasing(normalizedEditor.zoomOutEasing);
	editorSetters.setConnectedZoomEasing(normalizedEditor.connectedZoomEasing);
	editorSetters.setShowCursor(normalizedEditor.showCursor);
	editorSetters.setLoopCursor(normalizedEditor.loopCursor);
	editorSetters.setCursorStyle(normalizedEditor.cursorStyle);
	editorSetters.setCursorSize(normalizedEditor.cursorSize);
	editorSetters.setCursorSmoothing(normalizedEditor.cursorSmoothing);
	editorSetters.setCursorSpringStiffnessMultiplier(
		normalizedEditor.cursorSpringStiffnessMultiplier,
	);
	editorSetters.setCursorSpringDampingMultiplier(normalizedEditor.cursorSpringDampingMultiplier);
	editorSetters.setCursorSpringMassMultiplier(normalizedEditor.cursorSpringMassMultiplier);
	editorSetters.setCameraSpringStiffnessMultiplier(
		normalizedEditor.cameraSpringStiffnessMultiplier,
	);
	editorSetters.setCameraSpringDampingMultiplier(normalizedEditor.cameraSpringDampingMultiplier);
	editorSetters.setCameraSpringMassMultiplier(normalizedEditor.cameraSpringMassMultiplier);
	editorSetters.setZoomSmoothness(normalizedEditor.zoomSmoothness);
	editorSetters.setZoomClassicMode(normalizedEditor.zoomClassicMode);
	editorSetters.setCursorMotionBlur(normalizedEditor.cursorMotionBlur);
	editorSetters.setCursorClickBounce(normalizedEditor.cursorClickBounce);
	editorSetters.setCursorClickBounceDuration(normalizedEditor.cursorClickBounceDuration);
	editorSetters.setCursorSway(normalizedEditor.cursorSway);
	editorSetters.setBorderRadius(normalizedEditor.borderRadius);
	editorSetters.setPadding(normalizedEditor.padding);
	editorSetters.setFrame(normalizedEditor.frame);
	editorSetters.setCropRegion(normalizedEditor.cropRegion);
	editorSetters.setWebcam(normalizedEditor.webcam);
	editorSetters.setTrimRegions(normalizedEditor.trimRegions);
	editorSetters.setSourceAudioTrackSettingsByClip(
		normalizedEditor.sourceAudioTrackSettingsByClip ?? {},
	);
	editorSetters.setDefaultSourceAudioTrackSettings(
		normalizedEditor.defaultSourceAudioTrackSettings ?? {},
	);
	editorSetters.setAutoCaptionSettings(normalizedEditor.autoCaptionSettings);
	editorSetters.setAspectRatio(normalizedEditor.aspectRatio);
}

function applyLoadedProjectExportSettings(editorSetters: EditorSetters, normalizedEditor: any) {
	editorSetters.setExportEncodingMode(normalizedEditor.exportEncodingMode);
	editorSetters.setExportBackendPreference(normalizedEditor.exportBackendPreference);
	editorSetters.setExportPipelineModel(normalizedEditor.exportPipelineModel);
	editorSetters.setExportQuality(normalizedEditor.exportQuality);
	editorSetters.setMp4FrameRate(normalizedEditor.mp4FrameRate);
	editorSetters.setExportFormat(normalizedEditor.exportFormat);
	editorSetters.setGifFrameRate(normalizedEditor.gifFrameRate);
	editorSetters.setGifLoop(normalizedEditor.gifLoop);
	editorSetters.setGifSizePreset(normalizedEditor.gifSizePreset);
}

function applyLoadedProjectTimeline(
	timelineState: TimelineStateLike,
	editorRefs: EditorRefs,
	normalizedEditor: any,
) {
	timelineState.replaceState({
		zoomRegions: normalizedEditor.zoomRegions,
		clipRegions: normalizedEditor.clipRegions,
		speedRegions: normalizedEditor.speedRegions,
		annotationRegions: normalizedEditor.annotationRegions,
		audioRegions: normalizedEditor.audioRegions,
		autoCaptions: normalizedEditor.autoCaptions,
		selectedZoomId: null,
		selectedClipId: null,
		selectedAnnotationId: null,
		selectedAudioId: null,
	});

	editorRefs.clipInitializedRef.current = normalizedEditor.clipRegions.length > 0;
	editorRefs.autoFullTrackClipIdRef.current = null;
	editorRefs.autoFullTrackClipEndMsRef.current = null;
	editorRefs.nextZoomIdRef.current = deriveNextId(
		"zoom",
		normalizedEditor.zoomRegions.map((region: { id: string }) => region.id),
	);
	editorRefs.nextClipIdRef.current = deriveNextId(
		"clip",
		normalizedEditor.clipRegions.map((region: ClipRegion) => region.id),
	);
	editorRefs.nextAudioIdRef.current = deriveNextId(
		"audio",
		normalizedEditor.audioRegions.map((region: { id: string }) => region.id),
	);
	editorRefs.nextAnnotationIdRef.current = deriveNextId(
		"annotation",
		normalizedEditor.annotationRegions.map((region: { id: string }) => region.id),
	);
	editorRefs.nextAnnotationZIndexRef.current =
		normalizedEditor.annotationRegions.reduce(
			(max: number, region: { zIndex: number }) => Math.max(max, region.zIndex),
			0,
		) + 1;
}

export function useVideoEditorProject({
	projectManager,
	timelineState,
	editorRefs,
	editorRuntime,
	editorSetters,
	projectDisplayName,
	cloneStructured,
	onMenuLoadProject,
	onMenuSaveProject,
	onMenuSaveProjectAs,
	onRequestSaveBeforeClose,
}: UseVideoEditorProjectArgs) {
	const applyLoadedProject = useCallback(
		async (candidate: unknown, path?: string | null) => {
			if (!validateProjectData(candidate)) {
				return false;
			}

			const project = candidate;
			const sourcePath = fromFileUrl(project.videoPath);
			const normalizedEditor = normalizeProjectEditor(
				stripPersistedDevMotionBlurSettings(project.editor ?? {}),
			);

			try {
				editorRefs.videoPlaybackRef.current?.pause();
			} catch {
				// no-op
			}
			editorSetters.setIsPlaying(false);
			editorSetters.setCurrentTime(0);
			editorSetters.setDuration(0);

			editorSetters.setError(null);
			editorSetters.setVideoSourcePath(sourcePath);
			editorSetters.setVideoPath(await editorRuntime.resolveVideoUrl(sourcePath));
			editorSetters.setCurrentProjectPath(path ?? null);
			editorRefs.pendingFreshRecordingAutoZoomPathRef.current = null;
			if (normalizedEditor.webcam.sourcePath) {
				await window.electronAPI.setCurrentRecordingSession?.(
					{
						videoPath: sourcePath,
						webcamPath: normalizedEditor.webcam.sourcePath,
						timeOffsetMs: normalizedEditor.webcam.timeOffsetMs,
					},
					{
						preserveProjectPath: Boolean(path),
					},
				);
				const sessionResult = await window.electronAPI.getCurrentRecordingSession?.();
				editorRuntime.applySessionPresentation(
					sessionResult?.success ? sessionResult.session : null,
				);
			} else {
				await window.electronAPI.setCurrentVideoPath(sourcePath, {
					preserveProjectPath: Boolean(path),
				});
				editorRuntime.applySessionPresentation(null);
			}

			applyLoadedProjectVisualSettings(editorSetters, normalizedEditor);
			applyLoadedProjectExportSettings(editorSetters, normalizedEditor);
			applyLoadedProjectTimeline(timelineState, editorRefs, normalizedEditor);

			editorSetters.setLastSavedSnapshot(
				cloneStructured(
					createProjectData(
						sourcePath,
						editorRuntime.buildPersistedEditorState(normalizedEditor),
						project.projectId ?? null,
					),
				),
			);
			await projectManager.refreshProjectLibrary();
			return true;
		},
		[cloneStructured, editorRefs, editorRuntime, editorSetters, projectManager, timelineState],
	);

	const syncActiveVideoSource = useCallback(
		async (sourcePath: string, webcamPath?: string | null) => {
			if (webcamPath) {
				await window.electronAPI.setCurrentRecordingSession?.(
					{
						videoPath: sourcePath,
						webcamPath,
						timeOffsetMs: editorRuntime.webcamTimeOffsetMs,
					},
					{
						preserveProjectPath: Boolean(editorRuntime.currentProjectPath),
					},
				);
				return;
			}

			await window.electronAPI.setCurrentVideoPath(sourcePath, {
				preserveProjectPath: Boolean(editorRuntime.currentProjectPath),
			});
		},
		[editorRuntime.currentProjectPath, editorRuntime.webcamTimeOffsetMs],
	);

	const computedProjectSnapshot = useMemo(() => {
		if (!editorRuntime.currentSourcePath) {
			return null;
		}
		return createProjectData(
			editorRuntime.currentSourcePath,
			editorRuntime.currentPersistedEditorState,
			editorRuntime.lastSavedProjectId,
		);
	}, [
		editorRuntime.currentPersistedEditorState,
		editorRuntime.currentSourcePath,
		editorRuntime.lastSavedProjectId,
	]);

	const projectController = useProjectController({
		projectManager,
		projectDisplayName,
		currentSourcePath: editorRuntime.currentSourcePath,
		currentProjectPath: editorRuntime.currentProjectPath,
		currentProjectSnapshot: computedProjectSnapshot,
		currentPersistedEditorState: editorRuntime.currentPersistedEditorState,
		lastSavedProjectId: editorRuntime.lastSavedProjectId,
		captureProjectThumbnail: editorRuntime.captureProjectThumbnail,
		remountPreview: editorRuntime.remountPreview,
		setCurrentProjectPath: editorSetters.setCurrentProjectPath,
		setLastSavedSnapshot: editorSetters.setLastSavedSnapshot,
		createProjectData,
		cloneStructured,
		applyLoadedProject,
		onMenuLoadProject,
		onMenuSaveProject,
		onMenuSaveProjectAs,
		onRequestSaveBeforeClose,
	});

	return {
		applyLoadedProject,
		syncActiveVideoSource,
		projectController,
		currentProjectSnapshot: computedProjectSnapshot,
	};
}
