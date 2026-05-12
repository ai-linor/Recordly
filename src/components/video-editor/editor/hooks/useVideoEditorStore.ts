import { create } from "zustand";
import type React from "react";
import type { AspectRatio } from "@/utils/aspectRatioUtils";
import type { EditorPresetSnapshot } from "@/components/video-editor/editorPreferences";
import type { EditorEffectSection, WebcamOverlaySettings } from "@/components/video-editor/types";

export type PresetSetters = {
	[K in keyof EditorPresetSnapshot]: (value: EditorPresetSnapshot[K]) => void;
};

type WebcamSetter = React.Dispatch<React.SetStateAction<WebcamOverlaySettings>>;

type VideoEditorStoreState = {
	activeEffectSection: EditorEffectSection;
	timelineCollapsed: boolean;
	aspectRatio: AspectRatio;
	presetState: EditorPresetSnapshot | null;
	presetSetters: PresetSetters | null;
	defaultWebcamTimeOffsetMs: number;
	setWebcam: WebcamSetter | null;
	syncRecordingSessionWebcam: ((webcamPath: string | null, timeOffsetMs?: number) => Promise<void>) | null;

	setActiveEffectSection: React.Dispatch<React.SetStateAction<EditorEffectSection>>;
	setTimelineCollapsed: (next: boolean) => void;
	toggleTimelineCollapsed: () => void;
	setAspectRatio: (next: AspectRatio) => void;
	syncUiState: (patch: Partial<Pick<VideoEditorStoreState, "activeEffectSection" | "timelineCollapsed" | "aspectRatio">>) => void;
	syncPresetBindings: (presetState: EditorPresetSnapshot, presetSetters: PresetSetters) => void;
	syncSidebarBindings: (args: {
		defaultWebcamTimeOffsetMs: number;
		setWebcam: WebcamSetter;
		syncRecordingSessionWebcam: (webcamPath: string | null, timeOffsetMs?: number) => Promise<void>;
	}) => void;
};

export const useVideoEditorStore = create<VideoEditorStoreState>((set) => ({
	activeEffectSection: "scene",
	timelineCollapsed: false,
	aspectRatio: "native",
	presetState: null,
	presetSetters: null,
	defaultWebcamTimeOffsetMs: 0,
	setWebcam: null,
	syncRecordingSessionWebcam: null,

	setActiveEffectSection: (next) =>
		set((state) => ({
			activeEffectSection:
				typeof next === "function"
					? (next as (prev: EditorEffectSection) => EditorEffectSection)(state.activeEffectSection)
					: next,
		})),
	setTimelineCollapsed: (next) => set({ timelineCollapsed: next }),
	toggleTimelineCollapsed: () =>
		set((state) => ({
			timelineCollapsed: !state.timelineCollapsed,
		})),
	setAspectRatio: (next) => set({ aspectRatio: next }),
	syncUiState: (patch) => set(patch),
	syncPresetBindings: (presetState, presetSetters) => set({ presetState, presetSetters }),
	syncSidebarBindings: (args) =>
		set({
			defaultWebcamTimeOffsetMs: args.defaultWebcamTimeOffsetMs,
			setWebcam: args.setWebcam,
			syncRecordingSessionWebcam: args.syncRecordingSessionWebcam,
		}),
}));

export function useEditorUiState() {
	return useVideoEditorStore((state) => ({
		activeEffectSection: state.activeEffectSection,
		timelineCollapsed: state.timelineCollapsed,
		aspectRatio: state.aspectRatio,
		setActiveEffectSection: state.setActiveEffectSection,
		setTimelineCollapsed: state.setTimelineCollapsed,
		toggleTimelineCollapsed: state.toggleTimelineCollapsed,
		setAspectRatio: state.setAspectRatio,
	}));
}

export function useEditorPresetState() {
	return useVideoEditorStore((state) => ({
		presetState: state.presetState,
		presetSetters: state.presetSetters,
	}));
}

export function useEditorSidebarState() {
	return useVideoEditorStore((state) => ({
		activeEffectSection: state.activeEffectSection,
		setActiveEffectSection: state.setActiveEffectSection,
		defaultWebcamTimeOffsetMs: state.defaultWebcamTimeOffsetMs,
		setWebcam: state.setWebcam,
		syncRecordingSessionWebcam: state.syncRecordingSessionWebcam,
	}));
}
