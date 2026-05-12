import { useCallback, useMemo, useState } from "react";
import type {
	AnnotationRegion,
	AudioRegion,
	CaptionCue,
	ClipRegion,
	SpeedRegion,
	ZoomRegion,
} from "@/components/video-editor/types";

export interface TimelineState {
	zoomRegions: ZoomRegion[];
	clipRegions: ClipRegion[];
	speedRegions: SpeedRegion[];
	annotationRegions: AnnotationRegion[];
	audioRegions: AudioRegion[];
	autoCaptions: CaptionCue[];
	selectedZoomId: string | null;
	selectedClipId: string | null;
	selectedSpeedId: string | null;
	selectedAnnotationId: string | null;
	selectedAudioId: string | null;
}

export type TimelineStatePatch = Partial<TimelineState>;

export interface UseTimelineStateResult {
	state: TimelineState;
	updateState: (patch: TimelineStatePatch) => void;
	replaceState: (next: TimelineStatePatch) => void;
	resetState: () => void;
	undo: () => void;
	redo: () => void;
	canUndo: boolean;
	canRedo: boolean;
}

interface HistoryState {
	past: TimelineState[];
	present: TimelineState;
	future: TimelineState[];
}

const DEFAULT_TIMELINE_STATE: TimelineState = {
	zoomRegions: [],
	clipRegions: [],
	speedRegions: [],
	annotationRegions: [],
	audioRegions: [],
	autoCaptions: [],
	selectedZoomId: null,
	selectedClipId: null,
	selectedSpeedId: null,
	selectedAnnotationId: null,
	selectedAudioId: null,
};

function cloneState(state: TimelineState): TimelineState {
	if (typeof globalThis.structuredClone === "function") {
		return globalThis.structuredClone(state);
	}

	return JSON.parse(JSON.stringify(state)) as TimelineState;
}

export function useTimelineState(
	initialState: TimelineStatePatch = {},
	historyLimit = 100,
): UseTimelineStateResult {
	const mergedInitial = useMemo(
		() => ({ ...DEFAULT_TIMELINE_STATE, ...initialState }),
		[initialState],
	);
	const [history, setHistory] = useState<HistoryState>({
		past: [],
		present: mergedInitial,
		future: [],
	});

	const updateState = useCallback(
		(patch: TimelineStatePatch) => {
			setHistory((prev) => {
				const nextPresent = { ...prev.present, ...patch };
				if (JSON.stringify(nextPresent) === JSON.stringify(prev.present)) {
					return prev;
				}
				const nextPast = [...prev.past, cloneState(prev.present)].slice(-historyLimit);
				return {
					past: nextPast,
					present: nextPresent,
					future: [],
				};
			});
		},
		[historyLimit],
	);

	const replaceState = useCallback(
		(next: TimelineStatePatch) => {
			setHistory(() => ({
				past: [],
				present: {
					...DEFAULT_TIMELINE_STATE,
					...next,
				},
				future: [],
			}));
		},
		[],
	);

	const resetState = useCallback(() => {
		setHistory({
			past: [],
			present: mergedInitial,
			future: [],
		});
	}, [mergedInitial]);

	const undo = useCallback(() => {
		setHistory((prev) => {
			if (prev.past.length === 0) {
				return prev;
			}

			const previous = prev.past[prev.past.length - 1];
			const nextPast = prev.past.slice(0, -1);
			return {
				past: nextPast,
				present: previous,
				future: [cloneState(prev.present), ...prev.future],
			};
		});
	}, []);

	const redo = useCallback(() => {
		setHistory((prev) => {
			if (prev.future.length === 0) {
				return prev;
			}

			const [next, ...rest] = prev.future;
			return {
				past: [...prev.past, cloneState(prev.present)].slice(-historyLimit),
				present: next,
				future: rest,
			};
		});
	}, [historyLimit]);

	return useMemo(
		() => ({
			state: history.present,
			updateState,
			replaceState,
			resetState,
			undo,
			redo,
			canUndo: history.past.length > 0,
			canRedo: history.future.length > 0,
		}),
		[history, updateState, replaceState, resetState, undo, redo],
	);
}
