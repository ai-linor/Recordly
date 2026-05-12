import { useCallback, useEffect } from "react";
import { toast } from "sonner";
import { resolveAutoCaptionSourcePath } from "@/components/video-editor/autoCaptionSource";
import { type AutoCaptionSettings, type CaptionCue } from "@/components/video-editor/types";

function getErrorMessage(error: unknown): string {
	if (error instanceof Error) {
		return error.message;
	}
	if (typeof error === "string") {
		return error.replace(/^Error:\s*/i, "");
	}
	return "Something went wrong";
}

type UseWhisperCaptionsParams = {
	videoPath: string | null;
	videoSourcePath: string | null;
	webcamSourcePath: string | null;
	autoCaptionSettings: AutoCaptionSettings;
	whisperExecutablePath: string | null;
	whisperModelPath: string | null;
	downloadedWhisperModelPath: string | null;
	whisperModelDownloadStatus: "idle" | "downloading" | "downloaded" | "error";
	isGeneratingCaptions: boolean;
	onSyncVideoSource: (sourcePath: string, webcamSourcePath: string | null) => Promise<void>;
	onResolveVideoUrl: (sourcePath: string) => Promise<string>;
	onSetVideoSourcePath: (path: string) => void;
	onSetVideoPath: (path: string) => void;
	onSetAutoCaptions: (cues: CaptionCue[]) => void;
	onSetAutoCaptionSettings: React.Dispatch<React.SetStateAction<AutoCaptionSettings>>;
	onSetWhisperExecutablePath: (path: string | null) => void;
	onSetWhisperModelPath: React.Dispatch<React.SetStateAction<string | null>>;
	onSetDownloadedWhisperModelPath: (path: string | null) => void;
	onSetWhisperModelDownloadStatus: (status: "idle" | "downloading" | "downloaded" | "error") => void;
	onSetWhisperModelDownloadProgress: (progress: number) => void;
	onSetIsGeneratingCaptions: (value: boolean) => void;
};

export function useWhisperCaptions(params: UseWhisperCaptionsParams) {
	useEffect(() => {
		const unsubscribe = window.electronAPI.onWhisperSmallModelDownloadProgress((state) => {
			params.onSetWhisperModelDownloadStatus(state.status);
			params.onSetWhisperModelDownloadProgress(state.progress);
			if (state.status === "downloaded") {
				params.onSetDownloadedWhisperModelPath(state.path ?? null);
				params.onSetWhisperModelPath((currentPath) => currentPath ?? state.path ?? null);
			}
			if (state.status === "idle") {
				params.onSetDownloadedWhisperModelPath(null);
			}
			if (state.status === "error" && state.error) {
				toast.error(state.error);
			}
		});

		void (async () => {
			const result = await window.electronAPI.getWhisperSmallModelStatus();
			if (!result.success) {
				return;
			}

			if (result.exists && result.path) {
				params.onSetDownloadedWhisperModelPath(result.path);
				params.onSetWhisperModelPath((currentPath) => currentPath ?? result.path ?? null);
				params.onSetWhisperModelDownloadStatus("downloaded");
				params.onSetWhisperModelDownloadProgress(100);
				return;
			}

			params.onSetDownloadedWhisperModelPath(null);
			params.onSetWhisperModelDownloadStatus("idle");
			params.onSetWhisperModelDownloadProgress(0);
		})();

		return () => unsubscribe?.();
	}, []);

	const handlePickWhisperExecutable = useCallback(async () => {
		const result = await window.electronAPI.openWhisperExecutablePicker();
		if (!result.success || !result.path) {
			return;
		}
		params.onSetWhisperExecutablePath(result.path);
		toast.success("Whisper executable selected");
	}, [params]);

	const handleDownloadWhisperSmallModel = useCallback(async () => {
		if (params.whisperModelDownloadStatus === "downloading") {
			return;
		}

		params.onSetWhisperModelDownloadStatus("downloading");
		params.onSetWhisperModelDownloadProgress(0);
		const result = await window.electronAPI.downloadWhisperSmallModel();
		if (!result.success) {
			params.onSetWhisperModelDownloadStatus("error");
			toast.error(result.error || "Failed to download Whisper small model");
			return;
		}

		if (result.path) {
			params.onSetDownloadedWhisperModelPath(result.path);
			params.onSetWhisperModelPath(result.path);
		}
	}, [params]);

	const handlePickWhisperModel = useCallback(async () => {
		const result = await window.electronAPI.openWhisperModelPicker();
		if (!result.success || !result.path) {
			return;
		}
		params.onSetWhisperModelPath(result.path);
		toast.success("Whisper model selected");
	}, [params]);

	const handleDeleteWhisperSmallModel = useCallback(async () => {
		const result = await window.electronAPI.deleteWhisperSmallModel();
		if (!result.success) {
			toast.error(result.error || "Failed to delete Whisper small model");
			params.onSetWhisperModelDownloadStatus("idle");
			params.onSetWhisperModelDownloadProgress(0);
			return;
		}

		params.onSetWhisperModelPath((currentPath) =>
			currentPath === params.downloadedWhisperModelPath ? null : currentPath,
		);
		params.onSetDownloadedWhisperModelPath(null);
		params.onSetWhisperModelDownloadStatus("idle");
		params.onSetWhisperModelDownloadProgress(0);
		toast.success("Whisper small model deleted");
	}, [params]);

	const handleGenerateAutoCaptions = useCallback(async () => {
		if (params.isGeneratingCaptions) {
			return;
		}

		let sourcePath = resolveAutoCaptionSourcePath({
			videoSourcePath: params.videoSourcePath,
			videoPath: params.videoPath,
		});

		if (!sourcePath) {
			const sessionResult = await window.electronAPI.getCurrentRecordingSession?.();
			const currentVideoResult = await window.electronAPI.getCurrentVideoPath();
			sourcePath = resolveAutoCaptionSourcePath({
				recordingSessionVideoPath:
					sessionResult?.success && sessionResult.session?.videoPath
						? sessionResult.session.videoPath
						: null,
				currentVideoPath: currentVideoResult.success
					? (currentVideoResult.path ?? null)
					: null,
			});
		}

		if (!sourcePath) {
			toast.error("No source video is loaded");
			return;
		}

		if (sourcePath !== params.videoSourcePath) {
			params.onSetVideoSourcePath(sourcePath);
			params.onSetVideoPath(await params.onResolveVideoUrl(sourcePath));
		}

		await params.onSyncVideoSource(sourcePath, params.webcamSourcePath ?? null);

		if (!params.whisperModelPath) {
			toast.error("Select a Whisper model or download the small model first");
			return;
		}

		params.onSetIsGeneratingCaptions(true);
		try {
			const result = await window.electronAPI.generateAutoCaptions({
				videoPath: sourcePath,
				whisperExecutablePath: params.whisperExecutablePath ?? undefined,
				whisperModelPath: params.whisperModelPath,
				language: params.autoCaptionSettings.language,
			});

			if (!result.success || !result.cues) {
				toast.error(
					result.message || getErrorMessage(result.error) || "Failed to generate captions",
				);
				return;
			}

			params.onSetAutoCaptions(result.cues);
			params.onSetAutoCaptionSettings((prev) => ({ ...prev, enabled: true }));
			toast.success(result.message || `Generated ${result.cues.length} captions`);
		} catch (error) {
			toast.error(getErrorMessage(error));
		} finally {
			params.onSetIsGeneratingCaptions(false);
		}
	}, [params]);

	const handleClearAutoCaptions = useCallback(() => {
		params.onSetAutoCaptions([]);
		params.onSetAutoCaptionSettings((prev) => ({ ...prev, enabled: false }));
	}, [params]);

	return {
		handlePickWhisperExecutable,
		handleDownloadWhisperSmallModel,
		handlePickWhisperModel,
		handleDeleteWhisperSmallModel,
		handleGenerateAutoCaptions,
		handleClearAutoCaptions,
	};
}
