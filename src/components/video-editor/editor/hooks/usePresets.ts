import { useCallback, useMemo, useState } from "react";
import {
	loadEditorPresets,
	saveEditorPresets,
	type EditorPreset,
	type EditorPresetSnapshot,
} from "@/components/video-editor/editorPreferences";

export interface UsePresetsResult {
	presets: EditorPreset[];
	savePreset: (name: string, snapshot: EditorPresetSnapshot) => EditorPreset | null;
	deletePreset: (id: string) => boolean;
	applyPreset: (id: string) => EditorPresetSnapshot | null;
}

export function usePresets(): UsePresetsResult {
	const [presets, setPresets] = useState<EditorPreset[]>(() => loadEditorPresets());

	const savePreset = useCallback((name: string, snapshot: EditorPresetSnapshot) => {
		const normalizedName = name.trim().replace(/\s+/g, " ");
		if (normalizedName.length === 0) {
			return null;
		}

		const now = new Date().toISOString();
		const created: EditorPreset = {
			id: crypto.randomUUID(),
			name: normalizedName,
			createdAt: now,
			updatedAt: now,
			snapshot,
		};

		let saved = false;
		setPresets((prev) => {
			const next = [created, ...prev].sort((left, right) =>
				right.updatedAt.localeCompare(left.updatedAt),
			);
			saved = saveEditorPresets(next);
			return saved ? next : prev;
		});

		return saved ? created : null;
	}, []);

	const deletePreset = useCallback((id: string) => {
		let removed = false;
		let persisted = false;
		setPresets((prev) => {
			const next = prev.filter((preset) => preset.id !== id);
			removed = next.length !== prev.length;
			if (!removed) {
				return prev;
			}
			persisted = saveEditorPresets(next);
			return persisted ? next : prev;
		});
		return removed && persisted;
	}, []);

	const applyPreset = useCallback(
		(id: string) => presets.find((preset) => preset.id === id)?.snapshot ?? null,
		[presets],
	);

	return useMemo(
		() => ({
			presets,
			savePreset,
			deletePreset,
			applyPreset,
		}),
		[presets, savePreset, deletePreset, applyPreset],
	);
}
