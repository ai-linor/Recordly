import { useCallback } from "react";
import { extensionHost } from "@/lib/extensions";
import {
	clampFocusToDepth,
	DEFAULT_ANNOTATION_POSITION,
	DEFAULT_ANNOTATION_SIZE,
	DEFAULT_ANNOTATION_STYLE,
	DEFAULT_AUTO_ZOOM_DEPTH,
	DEFAULT_FIGURE_DATA,
	type AnnotationRegion,
	type AudioRegion,
	type ClipRegion,
	type EditorEffectSection,
	type FigureData,
	type SpeedRegion,
	type ZoomDepth,
	type ZoomFocus,
	type ZoomMode,
	type ZoomRegion,
} from "@/components/video-editor/types";
import type { Span } from "dnd-timeline";

type UseTimelineActionsParams = {
	videoPath: string | null;
	pendingFreshRecordingAutoZoomPathRef: React.MutableRefObject<string | null>;
	autoSuggestedVideoPathRef: React.MutableRefObject<string | null>;
	nextZoomIdRef: React.MutableRefObject<number>;
	nextClipIdRef: React.MutableRefObject<number>;
	nextAudioIdRef: React.MutableRefObject<number>;
	nextAnnotationIdRef: React.MutableRefObject<number>;
	nextAnnotationZIndexRef: React.MutableRefObject<number>;
	zoomRegions: ZoomRegion[];
	clipRegions: ClipRegion[];
	selectedZoomId: string | null;
	selectedClipId: string | null;
	selectedAnnotationId: string | null;
	selectedAudioId: string | null;
	onSetActiveEffectSection: React.Dispatch<React.SetStateAction<EditorEffectSection>>;
	onSetZoomRegions: React.Dispatch<React.SetStateAction<ZoomRegion[]>>;
	onSetClipRegions: React.Dispatch<React.SetStateAction<ClipRegion[]>>;
	onSetSpeedRegions: React.Dispatch<React.SetStateAction<SpeedRegion[]>>;
	onSetAnnotationRegions: React.Dispatch<React.SetStateAction<AnnotationRegion[]>>;
	onSetAudioRegions: React.Dispatch<React.SetStateAction<AudioRegion[]>>;
	onSetSelectedZoomId: (id: string | null) => void;
	onSetSelectedClipId: (id: string | null) => void;
	onSetSelectedAnnotationId: (id: string | null) => void;
	onSetSelectedAudioId: (id: string | null) => void;
};

export function useTimelineActions(params: UseTimelineActionsParams) {
	const handleSelectZoom = useCallback((id: string | null) => {
		params.onSetSelectedZoomId(id);
		if (id) {
			params.onSetActiveEffectSection("zoom");
			params.onSetSelectedAnnotationId(null);
			params.onSetSelectedAudioId(null);
		} else {
			params.onSetActiveEffectSection((s) => (s === "zoom" ? "scene" : s));
		}
	}, [params]);

	const handleSelectAnnotation = useCallback((id: string | null) => {
		params.onSetSelectedAnnotationId(id);
		if (id) {
			params.onSetSelectedZoomId(null);
			params.onSetSelectedAudioId(null);
		}
	}, [params]);

	const handleZoomAdded = useCallback((span: Span) => {
		const id = `zoom-${params.nextZoomIdRef.current++}`;
		const defaultDepth: ZoomDepth = 2;
		const newRegion: ZoomRegion = {
			id,
			startMs: Math.round(span.start),
			endMs: Math.round(span.end),
			depth: defaultDepth,
			focus: clampFocusToDepth({ cx: 0.5, cy: 0.5 }, defaultDepth),
			mode: "auto",
		};
		if (params.videoPath && params.pendingFreshRecordingAutoZoomPathRef.current === params.videoPath) {
			params.autoSuggestedVideoPathRef.current = params.videoPath;
			params.pendingFreshRecordingAutoZoomPathRef.current = null;
		}
		params.onSetZoomRegions((prev) => [...prev, newRegion]);
		params.onSetSelectedZoomId(id);
		params.onSetSelectedAnnotationId(null);
		extensionHost.emitEvent({ type: "timeline:region-added", data: { id, startMs: newRegion.startMs, endMs: newRegion.endMs } });
	}, [params]);

	const handleZoomSuggested = useCallback((span: Span, focus: ZoomFocus) => {
		const id = `zoom-${params.nextZoomIdRef.current++}`;
		const newRegion: ZoomRegion = {
			id,
			startMs: Math.round(span.start),
			endMs: Math.round(span.end),
			depth: DEFAULT_AUTO_ZOOM_DEPTH,
			focus: clampFocusToDepth(focus, DEFAULT_AUTO_ZOOM_DEPTH),
			mode: "auto",
		};
		if (params.videoPath && params.pendingFreshRecordingAutoZoomPathRef.current === params.videoPath) {
			params.autoSuggestedVideoPathRef.current = params.videoPath;
			params.pendingFreshRecordingAutoZoomPathRef.current = null;
		}
		params.onSetZoomRegions((prev) => [...prev, newRegion]);
		extensionHost.emitEvent({ type: "timeline:region-added", data: { id, startMs: newRegion.startMs, endMs: newRegion.endMs } });
	}, [params]);

	const handleZoomSpanChange = useCallback((id: string, span: Span) => {
		params.onSetZoomRegions((prev) => prev.map((region) => region.id === id ? { ...region, startMs: Math.round(span.start), endMs: Math.round(span.end) } : region));
	}, [params]);

	const handleZoomFocusChange = useCallback((id: string, focus: ZoomFocus) => {
		params.onSetZoomRegions((prev) => prev.map((region) => region.id === id ? { ...region, focus: clampFocusToDepth(focus, region.depth) } : region));
	}, [params]);

	const handleZoomDepthChange = useCallback((depth: ZoomDepth) => {
		if (!params.selectedZoomId) return;
		params.onSetZoomRegions((prev) => prev.map((region) => region.id === params.selectedZoomId ? { ...region, depth, focus: clampFocusToDepth(region.focus, depth) } : region));
	}, [params]);

	const handleZoomModeChange = useCallback((mode: ZoomMode) => {
		if (!params.selectedZoomId) return;
		params.onSetZoomRegions((prev) => prev.map((region) => (region.id === params.selectedZoomId ? { ...region, mode } : region)));
	}, [params]);

	const handleZoomDelete = useCallback((id: string) => {
		params.onSetZoomRegions((prev) => prev.filter((region) => region.id !== id));
		if (params.selectedZoomId === id) {
			params.onSetSelectedZoomId(null);
		}
		extensionHost.emitEvent({ type: "timeline:region-removed", data: { id } });
	}, [params]);

	const handleSelectClip = useCallback((id: string | null) => {
		params.onSetSelectedClipId(id);
		if (id) {
			params.onSetActiveEffectSection("clip");
			params.onSetSelectedZoomId(null);
			params.onSetSelectedAnnotationId(null);
			params.onSetSelectedAudioId(null);
		} else {
			params.onSetActiveEffectSection((s) => (s === "clip" ? "scene" : s));
		}
	}, [params]);

	const handleClipSplit = useCallback((splitMs: number) => {
		params.onSetClipRegions((prev) => {
			const target = prev.find((c) => splitMs > c.startMs && splitMs < c.endMs);
			if (!target) return prev;
			const leftId = `clip-${params.nextClipIdRef.current++}`;
			const rightId = `clip-${params.nextClipIdRef.current++}`;
			const left: ClipRegion = { id: leftId, startMs: target.startMs, endMs: Math.round(splitMs), speed: target.speed, muted: target.muted };
			const right: ClipRegion = { id: rightId, startMs: Math.round(splitMs), endMs: target.endMs, speed: target.speed, muted: target.muted };
			if (params.selectedClipId === target.id) params.onSetSelectedClipId(leftId);
			return prev.flatMap((c) => (c.id === target.id ? [left, right] : [c]));
		});
	}, [params]);

	const handleClipSpanChange = useCallback((id: string, span: Span) => {
		const oldClip = params.clipRegions.find((c) => c.id === id);
		const newStart = Math.round(span.start);
		const newEnd = Math.round(span.end);
		const removedSegments = oldClip ? [...(newStart > oldClip.startMs ? [{ startMs: oldClip.startMs, endMs: newStart }] : []), ...(newEnd < oldClip.endMs ? [{ startMs: newEnd, endMs: oldClip.endMs }] : [])] : [];

		if (oldClip) {
			const startDelta = newStart - oldClip.startMs;
			const endDelta = newEnd - oldClip.endMs;
			const isMove = Math.abs(startDelta - endDelta) < 1 && Math.abs(startDelta) > 0;
			if (isMove) {
				const delta = startDelta;
				params.onSetZoomRegions((prev) => prev.map((zoom) => (zoom.startMs < oldClip.endMs && zoom.endMs > oldClip.startMs ? { ...zoom, startMs: zoom.startMs + delta, endMs: zoom.endMs + delta } : zoom)));
			}
		}

		if (removedSegments.length > 0) {
			const removeTrimmedRegions = <T extends { startMs: number; endMs: number }>(regions: T[]): T[] => regions.filter((region) => !removedSegments.some((segment) => region.startMs < segment.endMs && region.endMs > segment.startMs));
			params.onSetZoomRegions((prev) => removeTrimmedRegions(prev));
			params.onSetAnnotationRegions((prev) => removeTrimmedRegions(prev));
			params.onSetSpeedRegions((prev) => removeTrimmedRegions(prev));
			params.onSetAudioRegions((prev) => removeTrimmedRegions(prev));
		}

		params.onSetClipRegions((prev) => prev.map((clip) => (clip.id === id ? { ...clip, startMs: newStart, endMs: newEnd } : clip)));
	}, [params]);

	const handleClipSpeedChange = useCallback((speed: number) => {
		if (!params.selectedClipId || !Number.isFinite(speed) || speed <= 0) return;
		const clip = params.clipRegions.find((c) => c.id === params.selectedClipId);
		if (!clip) return;
		const oldSpeed = Number.isFinite(clip.speed) && clip.speed > 0 ? clip.speed : 1;
		const sourceDurationMs = (clip.endMs - clip.startMs) * oldSpeed;
		const newEndMs = Math.round(clip.startMs + sourceDurationMs / speed);
		const scaleFactor = oldSpeed / speed;
		params.onSetClipRegions((prev) => prev.map((c) => (c.id === params.selectedClipId ? { ...c, speed, endMs: newEndMs } : c)));
		params.onSetZoomRegions((prev) => prev.map((zoom) => {
			if (zoom.startMs < clip.startMs || zoom.startMs >= clip.endMs) return zoom;
			return { ...zoom, startMs: Math.round(clip.startMs + (zoom.startMs - clip.startMs) * scaleFactor), endMs: Math.round(clip.startMs + (zoom.endMs - clip.startMs) * scaleFactor) };
		}));
	}, [params]);

	const handleClipMutedChange = useCallback((muted: boolean) => {
		if (!params.selectedClipId) return;
		params.onSetClipRegions((prev) => prev.map((clip) => (clip.id === params.selectedClipId ? { ...clip, muted } : clip)));
	}, [params]);

	const handleClipShowSourceAudioChange = useCallback((showSourceAudio: boolean) => {
		if (!params.selectedClipId) return;
		params.onSetClipRegions((prev) => prev.map((clip) => (clip.id === params.selectedClipId ? { ...clip, showSourceAudio } : clip)));
	}, [params]);

	const handleClipDelete = useCallback((id: string) => {
		const deletedClip = params.clipRegions.find((clip) => clip.id === id);
		params.onSetClipRegions((prev) => prev.filter((clip) => clip.id !== id));
		if (deletedClip) {
			const { startMs, endMs } = deletedClip;
			params.onSetZoomRegions((prev) => prev.filter((region) => region.endMs <= startMs || region.startMs >= endMs));
			params.onSetAnnotationRegions((prev) => prev.filter((region) => region.endMs <= startMs || region.startMs >= endMs));
			params.onSetSpeedRegions((prev) => prev.filter((region) => region.endMs <= startMs || region.startMs >= endMs));
			params.onSetAudioRegions((prev) => prev.filter((region) => region.endMs <= startMs || region.startMs >= endMs));
		}
		if (params.selectedClipId === id) params.onSetSelectedClipId(null);
	}, [params]);

	const handleSelectAudio = useCallback((id: string | null) => {
		params.onSetSelectedAudioId(id);
		if (id) {
			params.onSetSelectedZoomId(null);
			params.onSetSelectedAnnotationId(null);
			params.onSetActiveEffectSection("audio");
		}
	}, [params]);

	const handleAudioAdded = useCallback((span: Span, audioPath: string, trackIndex?: number) => {
		const id = `audio-${params.nextAudioIdRef.current++}`;
		const newRegion: AudioRegion = { id, startMs: Math.round(span.start), endMs: Math.round(span.end), audioPath, volume: 1, normalize: false, trackIndex };
		params.onSetAudioRegions((prev) => [...prev, newRegion]);
		params.onSetSelectedAudioId(id);
		params.onSetSelectedZoomId(null);
		params.onSetSelectedAnnotationId(null);
		params.onSetActiveEffectSection("audio");
	}, [params]);

	const handleAudioSpanChange = useCallback((id: string, span: Span, trackIndex?: number) => {
		const normalizedTrackIndex = typeof trackIndex === "number" && Number.isFinite(trackIndex) ? Math.max(0, Math.floor(trackIndex)) : undefined;
		params.onSetAudioRegions((prev) => prev.map((region) => region.id === id ? { ...region, startMs: Math.round(span.start), endMs: Math.round(span.end), ...(normalizedTrackIndex === undefined ? {} : { trackIndex: normalizedTrackIndex }) } : region));
	}, [params]);

	const handleAudioVolumeChange = useCallback((volume: number) => {
		if (!params.selectedAudioId || !Number.isFinite(volume)) return;
		const nextVolume = Math.max(0, Math.min(1, volume));
		params.onSetAudioRegions((prev) => prev.map((region) => region.id === params.selectedAudioId ? { ...region, volume: nextVolume } : region));
	}, [params]);

	const handleAudioDelete = useCallback((id: string) => {
		params.onSetAudioRegions((prev) => prev.filter((region) => region.id !== id));
		if (params.selectedAudioId === id) params.onSetSelectedAudioId(null);
	}, [params]);

	const handleAudioNormalizeChange = useCallback((normalize: boolean) => {
		if (!params.selectedAudioId) return;
		params.onSetAudioRegions((prev) => prev.map((region) => region.id === params.selectedAudioId ? { ...region, normalize } : region));
	}, [params]);

	const handleAnnotationAdded = useCallback((span: Span, trackIndex = 0) => {
		const id = `annotation-${params.nextAnnotationIdRef.current++}`;
		const zIndex = params.nextAnnotationZIndexRef.current++;
		const newRegion: AnnotationRegion = { id, startMs: Math.round(span.start), endMs: Math.round(span.end), type: "text", content: "Enter text...", position: { ...DEFAULT_ANNOTATION_POSITION }, size: { ...DEFAULT_ANNOTATION_SIZE }, style: { ...DEFAULT_ANNOTATION_STYLE }, zIndex, trackIndex };
		params.onSetAnnotationRegions((prev) => [...prev, newRegion]);
		params.onSetSelectedAnnotationId(id);
		params.onSetSelectedZoomId(null);
	}, [params]);

	const handleAnnotationSpanChange = useCallback((id: string, span: Span, trackIndex?: number) => {
		const normalizedTrackIndex = typeof trackIndex === "number" && Number.isFinite(trackIndex) ? Math.max(0, Math.floor(trackIndex)) : undefined;
		params.onSetAnnotationRegions((prev) => prev.map((region) => region.id === id ? { ...region, startMs: Math.round(span.start), endMs: Math.round(span.end), ...(normalizedTrackIndex === undefined ? {} : { trackIndex: normalizedTrackIndex }) } : region));
	}, [params]);

	const handleAnnotationDelete = useCallback((id: string) => {
		params.onSetAnnotationRegions((prev) => prev.filter((region) => region.id !== id));
		if (params.selectedAnnotationId === id) params.onSetSelectedAnnotationId(null);
	}, [params]);

	const handleAnnotationContentChange = useCallback((id: string, content: string) => {
		params.onSetAnnotationRegions((prev) => prev.map((region) => {
			if (region.id !== id) return region;
			if (region.type === "text") return { ...region, content, textContent: content };
			if (region.type === "image") return { ...region, content, imageContent: content };
			return { ...region, content };
		}));
	}, [params]);

	const handleAnnotationTypeChange = useCallback((id: string, type: AnnotationRegion["type"]) => {
		params.onSetAnnotationRegions((prev) => prev.map((region) => {
			if (region.id !== id) return region;
			const updatedRegion = { ...region, type };
			if (type === "text") updatedRegion.content = region.textContent || "Enter text...";
			else if (type === "image") updatedRegion.content = region.imageContent || "";
			else if (type === "figure") {
				updatedRegion.content = "";
				if (!region.figureData) updatedRegion.figureData = { ...DEFAULT_FIGURE_DATA };
			} else if (type === "blur") {
				updatedRegion.content = "";
				if (region.blurIntensity === undefined) updatedRegion.blurIntensity = 20;
			}
			return updatedRegion;
		}));
	}, [params]);

	const handleAnnotationStyleChange = useCallback((id: string, style: Partial<AnnotationRegion["style"]>) => {
		params.onSetAnnotationRegions((prev) => prev.map((region) => region.id === id ? { ...region, style: { ...region.style, ...style } } : region));
	}, [params]);

	const handleAnnotationFigureDataChange = useCallback((id: string, figureData: FigureData) => {
		params.onSetAnnotationRegions((prev) => prev.map((region) => (region.id === id ? { ...region, figureData } : region)));
	}, [params]);

	const handleAnnotationBlurIntensityChange = useCallback((id: string, blurIntensity: number) => {
		params.onSetAnnotationRegions((prev) => prev.map((region) => (region.id === id ? { ...region, blurIntensity } : region)));
	}, [params]);

	const handleAnnotationBlurColorChange = useCallback((id: string, blurColor: string) => {
		params.onSetAnnotationRegions((prev) => prev.map((region) => (region.id === id ? { ...region, blurColor } : region)));
	}, [params]);

	const handleAnnotationPositionChange = useCallback((id: string, position: { x: number; y: number }) => {
		params.onSetAnnotationRegions((prev) => prev.map((region) => (region.id === id ? { ...region, position } : region)));
	}, [params]);

	const handleAnnotationSizeChange = useCallback((id: string, size: { width: number; height: number }) => {
		params.onSetAnnotationRegions((prev) => prev.map((region) => (region.id === id ? { ...region, size } : region)));
	}, [params]);

	return {
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
	};
}
