import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
	type EditorPreset,
	type EditorPresetSnapshot,
	serializeEditorPresetSnapshot,
} from "../../editorPreferences";
import { usePresets } from "./usePresets";

type TranslateFn = (key: string, fallback: string, params?: Record<string, string>) => string;

type PresetSetters = {
	[K in keyof EditorPresetSnapshot]: (value: EditorPresetSnapshot[K]) => void;
};

type UseVideoEditorPresetsArgs = {
	t: TranslateFn;
	presetState: EditorPresetSnapshot;
	presetSetters: PresetSetters;
};

type UseVideoEditorPresetsResult = {
	editorPresets: EditorPreset[];
	activeEditorPresetId: string | null;
	presetPopoverOpen: boolean;
	setPresetPopoverOpen: (open: boolean) => void;
	presetNameDraft: string;
	setPresetNameDraft: (next: string) => void;
	currentEditorPreset: EditorPreset | null;
	handleApplyEditorPreset: (presetId: string) => void;
	handleSaveEditorPreset: (name: string) => boolean;
	handleDeleteEditorPreset: (presetId: string) => void;
	handleSavePresetSubmit: () => void;
};

function cloneSnapshot(snapshot: EditorPresetSnapshot): EditorPresetSnapshot {
	return {
		...snapshot,
		zoomMotionBlurTuning: { ...snapshot.zoomMotionBlurTuning },
		padding: { ...snapshot.padding },
		webcam: { ...snapshot.webcam },
		autoCaptionSettings: { ...snapshot.autoCaptionSettings },
	};
}

export function useVideoEditorPresets(args: UseVideoEditorPresetsArgs): UseVideoEditorPresetsResult {
	const { t, presetState, presetSetters } = args;
	const { presets: editorPresets, savePreset, deletePreset, applyPreset } = usePresets();
	const [activeEditorPresetId, setActiveEditorPresetId] = useState<string | null>(null);
	const [presetPopoverOpen, setPresetPopoverOpen] = useState(false);
	const [presetNameDraft, setPresetNameDraft] = useState("");

	const captureEditorPresetSnapshot = useCallback(
		(): EditorPresetSnapshot => cloneSnapshot(presetState),
		[presetState],
	);

	const currentPresetSnapshot = useMemo(
		() => captureEditorPresetSnapshot(),
		[captureEditorPresetSnapshot],
	);
	const currentPresetSignature = useMemo(
		() => serializeEditorPresetSnapshot(currentPresetSnapshot),
		[currentPresetSnapshot],
	);
	const currentEditorPreset = useMemo(
		() => editorPresets.find((preset) => preset.id === activeEditorPresetId) ?? null,
		[activeEditorPresetId, editorPresets],
	);

	useEffect(() => {
		const activePreset = currentEditorPreset;
		if (
			activePreset &&
			serializeEditorPresetSnapshot(activePreset.snapshot) === currentPresetSignature
		) {
			return;
		}

		const matchingPreset =
			editorPresets.find(
				(preset) => serializeEditorPresetSnapshot(preset.snapshot) === currentPresetSignature,
			) ?? null;
		const nextActivePresetId = matchingPreset?.id ?? null;
		if (nextActivePresetId !== activeEditorPresetId) {
			setActiveEditorPresetId(nextActivePresetId);
		}
	}, [activeEditorPresetId, currentEditorPreset, currentPresetSignature, editorPresets]);

	useEffect(() => {
		if (!presetPopoverOpen) {
			setPresetNameDraft("");
		}
	}, [presetPopoverOpen]);

	const applyEditorPresetSnapshot = useCallback(
		(snapshot: EditorPresetSnapshot) => {
			const next = cloneSnapshot(snapshot);
			presetSetters.wallpaper(next.wallpaper);
			presetSetters.shadowIntensity(next.shadowIntensity);
			presetSetters.backgroundBlur(next.backgroundBlur);
			presetSetters.zoomMotionBlur(next.zoomMotionBlur);
			presetSetters.zoomMotionBlurTuning(next.zoomMotionBlurTuning);
			presetSetters.zoomTemporalMotionBlur(next.zoomTemporalMotionBlur);
			presetSetters.zoomMotionBlurSampleCount(next.zoomMotionBlurSampleCount);
			presetSetters.zoomMotionBlurShutterFraction(next.zoomMotionBlurShutterFraction);
			presetSetters.connectZooms(next.connectZooms);
			presetSetters.zoomInDurationMs(next.zoomInDurationMs);
			presetSetters.zoomInOverlapMs(next.zoomInOverlapMs);
			presetSetters.zoomOutDurationMs(next.zoomOutDurationMs);
			presetSetters.connectedZoomGapMs(next.connectedZoomGapMs);
			presetSetters.connectedZoomDurationMs(next.connectedZoomDurationMs);
			presetSetters.zoomInEasing(next.zoomInEasing);
			presetSetters.zoomOutEasing(next.zoomOutEasing);
			presetSetters.connectedZoomEasing(next.connectedZoomEasing);
			presetSetters.showCursor(next.showCursor);
			presetSetters.loopCursor(next.loopCursor);
			presetSetters.cursorStyle(next.cursorStyle);
			presetSetters.cursorSize(next.cursorSize);
			presetSetters.cursorSmoothing(next.cursorSmoothing);
			presetSetters.cursorSpringStiffnessMultiplier(next.cursorSpringStiffnessMultiplier);
			presetSetters.cursorSpringDampingMultiplier(next.cursorSpringDampingMultiplier);
			presetSetters.cursorSpringMassMultiplier(next.cursorSpringMassMultiplier);
			presetSetters.cameraSpringStiffnessMultiplier(next.cameraSpringStiffnessMultiplier);
			presetSetters.cameraSpringDampingMultiplier(next.cameraSpringDampingMultiplier);
			presetSetters.cameraSpringMassMultiplier(next.cameraSpringMassMultiplier);
			presetSetters.cursorMotionBlur(next.cursorMotionBlur);
			presetSetters.cursorClickBounce(next.cursorClickBounce);
			presetSetters.cursorClickBounceDuration(next.cursorClickBounceDuration);
			presetSetters.cursorSway(next.cursorSway);
			presetSetters.borderRadius(next.borderRadius);
			presetSetters.padding(next.padding);
			presetSetters.frame(next.frame);
			presetSetters.webcam(next.webcam);
			presetSetters.aspectRatio(next.aspectRatio);
			presetSetters.exportEncodingMode(next.exportEncodingMode);
			presetSetters.exportBackendPreference(next.exportBackendPreference);
			presetSetters.exportPipelineModel(next.exportPipelineModel);
			presetSetters.exportQuality(next.exportQuality);
			presetSetters.mp4FrameRate(next.mp4FrameRate);
			presetSetters.exportFormat(next.exportFormat);
			presetSetters.gifFrameRate(next.gifFrameRate);
			presetSetters.gifLoop(next.gifLoop);
			presetSetters.gifSizePreset(next.gifSizePreset);
			presetSetters.autoCaptionSettings(next.autoCaptionSettings);
			presetSetters.whisperExecutablePath(next.whisperExecutablePath);
			presetSetters.whisperModelPath(next.whisperModelPath);
		},
		[presetSetters],
	);

	const handleApplyEditorPreset = useCallback(
		(presetId: string) => {
			const snapshot = applyPreset(presetId);
			const preset = editorPresets.find((item) => item.id === presetId) ?? null;
			if (!snapshot || !preset) {
				return;
			}

			setActiveEditorPresetId(preset.id);
			applyEditorPresetSnapshot(snapshot);
			toast.success(
				t("editor.presets.toasts.applied", 'Applied preset "{{name}}"', {
					name: preset.name,
				}),
			);
		},
		[applyEditorPresetSnapshot, applyPreset, editorPresets, t],
	);

	const handleSaveEditorPreset = useCallback(
		(name: string) => {
			const normalizedName = name.trim().replace(/\s+/g, " ");
			if (normalizedName.length === 0) {
				toast.error(t("editor.presets.errors.nameRequired", "Enter a preset name."));
				return false;
			}

			const hasDuplicateName = editorPresets.some(
				(preset) => preset.name.toLocaleLowerCase() === normalizedName.toLocaleLowerCase(),
			);
			if (hasDuplicateName) {
				toast.error(
					t(
						"editor.presets.errors.duplicateName",
						"A preset with that name already exists.",
					),
				);
				return false;
			}

			const snapshot = captureEditorPresetSnapshot();
			const createdPreset = savePreset(normalizedName, snapshot);
			if (!createdPreset) {
				toast.error(
					t(
						"editor.presets.errors.saveFailed",
						"Could not save that preset. Check your browser storage settings and try again.",
					),
				);
				return false;
			}

			setActiveEditorPresetId(createdPreset.id);
			toast.success(
				t("editor.presets.toasts.saved", 'Saved preset "{{name}}"', {
					name: normalizedName,
				}),
			);
			return true;
		},
		[captureEditorPresetSnapshot, editorPresets, savePreset, t],
	);

	const handleDeleteEditorPreset = useCallback(
		(presetId: string) => {
			const preset = editorPresets.find((item) => item.id === presetId);
			if (!preset) {
				return;
			}

			if (!deletePreset(presetId)) {
				toast.error(
					t(
						"editor.presets.errors.deleteFailed",
						"Could not delete that preset. Check your browser storage settings and try again.",
					),
				);
				return;
			}

			if (preset.id === activeEditorPresetId) {
				setActiveEditorPresetId(null);
			}
			toast.success(
				t("editor.presets.toasts.deleted", 'Deleted preset "{{name}}"', {
					name: preset.name,
				}),
			);
		},
		[activeEditorPresetId, deletePreset, editorPresets, t],
	);

	const handleSavePresetSubmit = useCallback(() => {
		const didSave = handleSaveEditorPreset(presetNameDraft);
		if (didSave) {
			setPresetNameDraft("");
		}
	}, [handleSaveEditorPreset, presetNameDraft]);

	return {
		editorPresets,
		activeEditorPresetId,
		presetPopoverOpen,
		setPresetPopoverOpen,
		presetNameDraft,
		setPresetNameDraft,
		currentEditorPreset,
		handleApplyEditorPreset,
		handleSaveEditorPreset,
		handleDeleteEditorPreset,
		handleSavePresetSubmit,
	};
}
