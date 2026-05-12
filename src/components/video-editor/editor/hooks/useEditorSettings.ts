import { useCallback, useMemo, useState } from "react";
import {
	DEFAULT_CONNECTED_ZOOM_DURATION_MS,
	DEFAULT_CONNECTED_ZOOM_EASING,
	DEFAULT_CONNECTED_ZOOM_GAP_MS,
	DEFAULT_CURSOR_MOTION_BLUR,
	DEFAULT_CURSOR_SIZE,
	DEFAULT_CURSOR_SMOOTHING,
	DEFAULT_CURSOR_STYLE,
	DEFAULT_PADDING,
	DEFAULT_ZOOM_IN_DURATION_MS,
	DEFAULT_ZOOM_IN_EASING,
	DEFAULT_ZOOM_IN_OVERLAP_MS,
	DEFAULT_ZOOM_OUT_DURATION_MS,
	DEFAULT_ZOOM_OUT_EASING,
	type CursorStyle,
	type Padding,
	type ZoomTransitionEasing,
} from "@/components/video-editor/types";

export interface EditorSettingsState {
	wallpaper: string;
	shadowIntensity: number;
	backgroundBlur: number;
	borderRadius: number;
	padding: Padding;
	cursorStyle: CursorStyle;
	cursorSize: number;
	cursorSmoothing: number;
	cursorMotionBlur: number;
	zoomInDurationMs: number;
	zoomInOverlapMs: number;
	zoomOutDurationMs: number;
	connectedZoomGapMs: number;
	connectedZoomDurationMs: number;
	zoomInEasing: ZoomTransitionEasing;
	zoomOutEasing: ZoomTransitionEasing;
	connectedZoomEasing: ZoomTransitionEasing;
}

export type PartialEditorSettingsState = Partial<EditorSettingsState>;

export interface UseEditorSettingsResult {
	settings: EditorSettingsState;
	updateSettings: (partial: PartialEditorSettingsState) => void;
	resetSettings: () => void;
}

const DEFAULT_SETTINGS: EditorSettingsState = {
	wallpaper: "",
	shadowIntensity: 0.67,
	backgroundBlur: 0,
	borderRadius: 22,
	padding: DEFAULT_PADDING,
	cursorStyle: DEFAULT_CURSOR_STYLE,
	cursorSize: DEFAULT_CURSOR_SIZE,
	cursorSmoothing: DEFAULT_CURSOR_SMOOTHING,
	cursorMotionBlur: DEFAULT_CURSOR_MOTION_BLUR,
	zoomInDurationMs: DEFAULT_ZOOM_IN_DURATION_MS,
	zoomInOverlapMs: DEFAULT_ZOOM_IN_OVERLAP_MS,
	zoomOutDurationMs: DEFAULT_ZOOM_OUT_DURATION_MS,
	connectedZoomGapMs: DEFAULT_CONNECTED_ZOOM_GAP_MS,
	connectedZoomDurationMs: DEFAULT_CONNECTED_ZOOM_DURATION_MS,
	zoomInEasing: DEFAULT_ZOOM_IN_EASING,
	zoomOutEasing: DEFAULT_ZOOM_OUT_EASING,
	connectedZoomEasing: DEFAULT_CONNECTED_ZOOM_EASING,
};

export function useEditorSettings(
	initialSettings: PartialEditorSettingsState = {},
): UseEditorSettingsResult {
	const mergedInitial = useMemo(
		() => ({ ...DEFAULT_SETTINGS, ...initialSettings }),
		[initialSettings],
	);
	const [settings, setSettings] = useState<EditorSettingsState>(mergedInitial);

	const updateSettings = useCallback((partial: PartialEditorSettingsState) => {
		setSettings((prev) => ({ ...prev, ...partial }));
	}, []);

	const resetSettings = useCallback(() => {
		setSettings(mergedInitial);
	}, [mergedInitial]);

	return useMemo(
		() => ({
			settings,
			updateSettings,
			resetSettings,
		}),
		[settings, updateSettings, resetSettings],
	);
}
