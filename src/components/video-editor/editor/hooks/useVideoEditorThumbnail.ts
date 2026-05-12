import { type RefObject, useCallback } from "react";
import { FrameRenderer } from "@/lib/exporter";
import { getClipSourceEndMs, type SpeedRegion } from "../../types";
import type {
	AnnotationRegion,
	AutoCaptionSettings,
	CaptionCue,
	ClipRegion,
	CropRegion,
	CursorStyle,
	CursorTelemetryPoint,
	Padding,
	WebcamOverlaySettings,
	ZoomMotionBlurTuning,
	ZoomRegion,
	ZoomTransitionEasing,
} from "../../types";
import { toFileUrl } from "../../projectPersistence";
import type { VideoPlaybackRef } from "../../VideoPlayback";

type ThumbnailRenderState = {
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
	borderRadius: number;
	padding: Padding;
	cropRegion: CropRegion;
	webcam: WebcamOverlaySettings;
	resolvedWebcamVideoUrl: string | null;
	zoomRegions: ZoomRegion[];
	annotationRegions: AnnotationRegion[];
	autoCaptions: CaptionCue[];
	autoCaptionSettings: AutoCaptionSettings;
	clipRegions: ClipRegion[];
	speedRegions: SpeedRegion[];
	cursorTelemetry: CursorTelemetryPoint[];
	effectiveShowCursor: boolean;
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
};

type UseVideoEditorThumbnailArgs = {
	videoPlaybackRef: RefObject<VideoPlaybackRef | null>;
	currentTime: number;
	renderState: ThumbnailRenderState;
};

type CaptureProjectThumbnailArgs = {
	previewHandle: VideoPlaybackRef | null;
	currentTime: number;
	renderState: ThumbnailRenderState;
};

async function captureProjectThumbnail({
	previewHandle,
	currentTime,
	renderState,
}: CaptureProjectThumbnailArgs): Promise<string | null> {
	const previewVideo = previewHandle?.video ?? null;
	const previewCanvas = previewHandle?.app?.canvas ?? null;

	if (previewHandle && previewVideo && previewVideo.paused) {
		try {
			await previewHandle.refreshFrame();
			await new Promise((resolve) => requestAnimationFrame(() => resolve(undefined)));
		} catch (thumbnailRefreshError) {
			console.warn(
				"Unable to refresh preview frame before thumbnail capture:",
				thumbnailRefreshError,
			);
		}
	}

	const canvas = document.createElement("canvas");
	const targetWidth = 320;
	const targetHeight = 180;
	canvas.width = targetWidth;
	canvas.height = targetHeight;

	const context = canvas.getContext("2d");
	if (!context) {
		return null;
	}

	context.imageSmoothingEnabled = true;
	context.imageSmoothingQuality = "high";
	const editorBgHsl = getComputedStyle(document.documentElement)
		.getPropertyValue("--editor-bg")
		.trim();
	context.fillStyle = editorBgHsl ? `hsl(${editorBgHsl})` : "#111113";
	context.fillRect(0, 0, targetWidth, targetHeight);

	const previewWidth = previewHandle?.containerRef.current?.clientWidth || 1920;
	const previewHeight = previewHandle?.containerRef.current?.clientHeight || 1080;
	const frameTimestampUs = Math.max(0, Math.round(currentTime * 1_000_000));

	if (previewVideo && previewVideo.videoWidth > 0 && previewVideo.videoHeight > 0) {
		let videoFrame: VideoFrame | null = null;
		let frameRenderer: FrameRenderer | null = null;

		try {
			videoFrame = new VideoFrame(previewVideo, { timestamp: frameTimestampUs });
			frameRenderer = new FrameRenderer({
				width: targetWidth,
				height: targetHeight,
				wallpaper: renderState.wallpaper,
				zoomRegions: renderState.zoomRegions,
				showShadow: renderState.shadowIntensity > 0,
				shadowIntensity: renderState.shadowIntensity,
				backgroundBlur: renderState.backgroundBlur,
				zoomMotionBlur: renderState.zoomMotionBlur,
				zoomMotionBlurTuning: renderState.zoomMotionBlurTuning,
				zoomTemporalMotionBlur: renderState.zoomTemporalMotionBlur,
				zoomMotionBlurSampleCount: renderState.zoomMotionBlurSampleCount,
				zoomMotionBlurShutterFraction: renderState.zoomMotionBlurShutterFraction,
				connectZooms: renderState.connectZooms,
				zoomInDurationMs: renderState.zoomInDurationMs,
				zoomInOverlapMs: renderState.zoomInOverlapMs,
				zoomOutDurationMs: renderState.zoomOutDurationMs,
				connectedZoomGapMs: renderState.connectedZoomGapMs,
				connectedZoomDurationMs: renderState.connectedZoomDurationMs,
				zoomInEasing: renderState.zoomInEasing,
				zoomOutEasing: renderState.zoomOutEasing,
				connectedZoomEasing: renderState.connectedZoomEasing,
				borderRadius: renderState.borderRadius,
				padding: renderState.padding,
				cropRegion: renderState.cropRegion,
				webcam: renderState.webcam,
				webcamUrl:
					renderState.resolvedWebcamVideoUrl ??
					(renderState.webcam.sourcePath ? toFileUrl(renderState.webcam.sourcePath) : null),
				videoWidth: previewVideo.videoWidth,
				videoHeight: previewVideo.videoHeight,
				annotationRegions: renderState.annotationRegions,
				autoCaptions: renderState.autoCaptions,
				autoCaptionSettings: renderState.autoCaptionSettings,
				speedRegions: (() => {
					const clipDerived: SpeedRegion[] = renderState.clipRegions
						.filter((clip) => clip.speed !== 1)
						.map((clip) => ({
							id: `clip-speed-${clip.id}`,
							startMs: clip.startMs,
							endMs: getClipSourceEndMs(clip),
							speed: clip.speed as SpeedRegion["speed"],
						}));
					if (clipDerived.length === 0) return renderState.speedRegions;
					const result = [...renderState.speedRegions];
					for (const clipSpeed of clipDerived) {
						const overlaps = renderState.speedRegions.some(
							(speedRegion) =>
								speedRegion.endMs > clipSpeed.startMs &&
								speedRegion.startMs < clipSpeed.endMs,
						);
						if (!overlaps) {
							result.push(clipSpeed);
						}
					}
					return result;
				})(),
				previewWidth,
				previewHeight,
				cursorTelemetry: renderState.cursorTelemetry,
				showCursor: renderState.effectiveShowCursor,
				cursorStyle: renderState.cursorStyle,
				cursorSize: renderState.cursorSize,
				cursorSmoothing: renderState.cursorSmoothing,
				cursorSpringStiffnessMultiplier: renderState.cursorSpringStiffnessMultiplier,
				cursorSpringDampingMultiplier: renderState.cursorSpringDampingMultiplier,
				cursorSpringMassMultiplier: renderState.cursorSpringMassMultiplier,
				cameraSpringStiffnessMultiplier: renderState.cameraSpringStiffnessMultiplier,
				cameraSpringDampingMultiplier: renderState.cameraSpringDampingMultiplier,
				cameraSpringMassMultiplier: renderState.cameraSpringMassMultiplier,
				zoomSmoothness: renderState.zoomSmoothness,
				zoomClassicMode: renderState.zoomClassicMode,
				cursorMotionBlur: renderState.cursorMotionBlur,
				cursorClickBounce: renderState.cursorClickBounce,
				cursorClickBounceDuration: renderState.cursorClickBounceDuration,
				cursorSway: renderState.cursorSway,
			});
			await frameRenderer.initialize();
			await frameRenderer.renderFrame(videoFrame, frameTimestampUs);
			return frameRenderer.getCanvas().toDataURL("image/png");
		} catch (thumbnailRenderError) {
			console.warn("Unable to render thumbnail from composed frame:", thumbnailRenderError);
		} finally {
			videoFrame?.close();
			frameRenderer?.destroy();
		}
	}

	const drawableSource =
		previewCanvas && previewCanvas.width > 0 && previewCanvas.height > 0
			? previewCanvas
			: previewVideo && previewVideo.videoWidth > 0 && previewVideo.videoHeight > 0
				? previewVideo
				: null;

	if (!drawableSource) {
		return null;
	}

	const sourceWidth =
		drawableSource instanceof HTMLVideoElement
			? drawableSource.videoWidth
			: drawableSource.width;
	const sourceHeight =
		drawableSource instanceof HTMLVideoElement
			? drawableSource.videoHeight
			: drawableSource.height;

	if (sourceWidth <= 0 || sourceHeight <= 0) {
		return null;
	}

	const scale = Math.min(targetWidth / sourceWidth, targetHeight / sourceHeight);
	const drawWidth = Math.round(sourceWidth * scale);
	const drawHeight = Math.round(sourceHeight * scale);
	const offsetX = Math.round((targetWidth - drawWidth) / 2);
	const offsetY = Math.round((targetHeight - drawHeight) / 2);

	try {
		context.drawImage(drawableSource, offsetX, offsetY, drawWidth, drawHeight);
		return canvas.toDataURL("image/png");
	} catch (thumbnailError) {
		console.warn("Unable to capture project thumbnail:", thumbnailError);
		return null;
	}
}

export function useVideoEditorThumbnail({
	videoPlaybackRef,
	currentTime,
	renderState,
}: UseVideoEditorThumbnailArgs) {
	return useCallback(
		() =>
			captureProjectThumbnail({
				previewHandle: videoPlaybackRef.current,
				currentTime,
				renderState,
			}),
		[currentTime, renderState, videoPlaybackRef],
	);
}
