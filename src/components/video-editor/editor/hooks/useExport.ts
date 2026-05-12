import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
	calculateOutputDimensions,
	type ExportBackendPreference,
	type ExportEncodingMode,
	type ExportFormat,
	type ExportMp4FrameRate,
	type ExportPipelineModel,
	type ExportProgress,
	type ExportQuality,
	type ExportSettings,
	GIF_SIZE_PRESETS,
	type GifFrameRate,
	type GifSizePreset,
} from "@/lib/exporter";
import {
	canUseInMemoryExportSaveFallback,
	describeBlockedInMemoryExportSave,
} from "@/lib/exporter/exportSavePolicy";

export interface UseExportOptions<TConfig, TProgress> {
	initialConfig: TConfig;
	initialProgress: TProgress;
	initialError?: string | null;
	initialIsExporting?: boolean;
}

export interface UseExportResult<TConfig, TProgress> {
	config: TConfig;
	setConfig: (next: TConfig) => void;
	updateConfig: (patch: Partial<TConfig>) => void;
	progress: TProgress;
	setProgress: (next: TProgress | ((prev: TProgress) => TProgress)) => void;
	error: string | null;
	setError: (next: string | null) => void;
	isExporting: boolean;
	setIsExporting: (next: boolean) => void;
	resetFeedback: () => void;
}

export function useExport<TConfig, TProgress>(
	options: UseExportOptions<TConfig, TProgress>,
): UseExportResult<TConfig, TProgress> {
	const [config, setConfigState] = useState<TConfig>(options.initialConfig);
	const [progress, setProgressState] = useState<TProgress>(options.initialProgress);
	const [error, setErrorState] = useState<string | null>(options.initialError ?? null);
	const [isExporting, setIsExportingState] = useState<boolean>(options.initialIsExporting ?? false);

	const setConfig = useCallback((next: TConfig) => {
		setConfigState(next);
	}, []);

	const updateConfig = useCallback((patch: Partial<TConfig>) => {
		setConfigState((prev) => ({ ...prev, ...patch }));
	}, []);

	const setProgress = useCallback((next: TProgress | ((prev: TProgress) => TProgress)) => {
		setProgressState((prev) => (typeof next === "function" ? (next as (prev: TProgress) => TProgress)(prev) : next));
	}, []);

	const setError = useCallback((next: string | null) => {
		setErrorState(next);
	}, []);

	const setIsExporting = useCallback((next: boolean) => {
		setIsExportingState(next);
	}, []);

	const resetFeedback = useCallback(() => {
		setProgressState(options.initialProgress);
		setErrorState(null);
	}, [options.initialProgress]);

	return useMemo(
		() => ({
			config,
			setConfig,
			updateConfig,
			progress,
			setProgress,
			error,
			setError,
			isExporting,
			setIsExporting,
			resetFeedback,
		}),
		[
			config,
			setConfig,
			updateConfig,
			progress,
			setProgress,
			error,
			setError,
			isExporting,
			setIsExporting,
			resetFeedback,
		],
	);
}

type UseExportUiControllerOptions = {
	videoPath: string | null;
	videoElement: HTMLVideoElement | null;
	hasPendingExportSave: boolean;
	exportFormat: ExportFormat;
	exportEncodingMode: ExportEncodingMode;
	mp4FrameRate: ExportMp4FrameRate;
	exportBackendPreference: ExportBackendPreference;
	exportPipelineModel: ExportPipelineModel;
	exportQuality: ExportQuality;
	gifFrameRate: GifFrameRate;
	gifLoop: boolean;
	gifSizePreset: GifSizePreset;
	isExporting: boolean;
	exportProgress: ExportProgress | null;
	exportedFilePath: string | undefined;
	onRunExport: (settings: ExportSettings) => void;
	onClearPendingExportSave: () => void;
	onCancelExporter: () => void;
	onSetExportProgress: (progress: ExportProgress | null) => void;
	onSetExportError: (error: string | null) => void;
	onSetExportedFilePath: (path: string | undefined) => void;
	onSetIsExporting: (value: boolean) => void;
	onOpenLightningIssues: () => Promise<void>;
	t: (key: string, fallback?: string, vars?: Record<string, string | number>) => string;
};

export function useExportUiController(options: UseExportUiControllerOptions) {
	const [showExportDropdown, setShowExportDropdown] = useState(false);

	const handleOpenExportDropdown = useCallback(() => {
		if (!options.videoPath) {
			toast.error("No video loaded");
			return;
		}
		if (options.hasPendingExportSave) {
			setShowExportDropdown(true);
			options.onSetExportError(
				"Save dialog canceled. Click Save Again to save without re-rendering.",
			);
			return;
		}
		setShowExportDropdown(true);
		options.onSetExportProgress(null);
		options.onSetExportError(null);
	}, [options]);

	const handleStartExportFromDropdown = useCallback(() => {
		const video = options.videoElement;
		if (!options.videoPath) {
			toast.error("No video loaded");
			return;
		}
		if (!video) {
			toast.error("Video not ready");
			return;
		}
		const sourceWidth = video.videoWidth || 1920;
		const sourceHeight = video.videoHeight || 1080;
		const gifDimensions = calculateOutputDimensions(
			sourceWidth,
			sourceHeight,
			options.gifSizePreset,
			GIF_SIZE_PRESETS,
		);
		const settings: ExportSettings = {
			format: options.exportFormat,
			encodingMode: options.exportFormat === "mp4" ? options.exportEncodingMode : undefined,
			mp4FrameRate: options.exportFormat === "mp4" ? options.mp4FrameRate : undefined,
			backendPreference:
				options.exportFormat === "mp4" ? options.exportBackendPreference : undefined,
			pipelineModel:
				options.exportFormat === "mp4" ? options.exportPipelineModel : undefined,
			quality: options.exportFormat === "mp4" ? options.exportQuality : undefined,
			gifConfig:
				options.exportFormat === "gif"
					? {
							frameRate: options.gifFrameRate,
							loop: options.gifLoop,
							sizePreset: options.gifSizePreset,
							width: gifDimensions.width,
							height: gifDimensions.height,
						}
					: undefined,
		};
		options.onSetExportError(null);
		options.onSetExportedFilePath(undefined);
		setShowExportDropdown(true);
		options.onRunExport(settings);
	}, [options]);

	const handleCancelExport = useCallback(() => {
		options.onCancelExporter();
		toast.info("Export canceled");
		options.onClearPendingExportSave();
		setShowExportDropdown(false);
		options.onSetIsExporting(false);
		options.onSetExportProgress(null);
		options.onSetExportError(null);
		options.onSetExportedFilePath(undefined);
	}, [options]);

	const handleExportDropdownClose = useCallback(() => {
		options.onClearPendingExportSave();
		setShowExportDropdown(false);
		options.onSetExportProgress(null);
		options.onSetExportError(null);
		options.onSetExportedFilePath(undefined);
	}, [options]);

	const revealExportedFile = useCallback(async () => {
		if (!options.exportedFilePath) return;
		try {
			const result = await window.electronAPI.revealInFolder(options.exportedFilePath);
			if (!result.success) {
				toast.error(result.error || result.message || "Failed to reveal item in folder.");
			}
		} catch (error) {
			toast.error(`Failed to reveal item in folder: ${String(error)}`);
		}
	}, [options]);

	const isExportSaving = options.exportProgress?.phase === "saving";
	const isExportPreparing =
		options.isExporting &&
		(!options.exportProgress || options.exportProgress.phase === "preparing");
	const isExportFinalizing = options.exportProgress?.phase === "finalizing";
	const isRenderingAudio =
		isExportFinalizing && typeof options.exportProgress?.audioProgress === "number";
	const exportFinalizingProgress = isExportFinalizing
		? Math.min(
				typeof options.exportProgress?.renderProgress === "number"
					? options.exportProgress.renderProgress
					: (options.exportProgress?.percentage ?? 100),
				100,
			)
		: null;
	const exportFinalizingPercent = isExportFinalizing
		? Math.round(exportFinalizingProgress ?? 100)
		: null;
	const isExportMuxingAndSaving =
		isExportFinalizing &&
		options.exportFormat === "mp4" &&
		options.exportPipelineModel === "modern" &&
		!isRenderingAudio;
	const isExportFinalSaveIndeterminate =
		isExportMuxingAndSaving && (exportFinalizingPercent ?? 0) >= 98;
	const isLightningExportInProgress =
		options.exportFormat === "mp4" &&
		options.exportPipelineModel === "modern" &&
		(options.isExporting || options.exportProgress !== null);
	const shouldSuspendPreviewRendering =
		options.isExporting &&
		options.exportFormat === "mp4" &&
		options.exportPipelineModel === "modern";
	const isLegacyExportInProgress =
		options.exportFormat === "mp4" &&
		options.exportPipelineModel === "legacy" &&
		(options.isExporting || options.exportProgress !== null);
	const exportRenderSpeedLabel =
		!isExportPreparing &&
		!isExportFinalizing &&
		!isExportSaving &&
		typeof options.exportProgress?.renderFps === "number" &&
		Number.isFinite(options.exportProgress.renderFps) &&
		options.exportProgress.renderFps > 0
			? options.t("editor.exportStatus.renderSpeed", "Render speed {{fps}} FPS", {
					fps: options.exportProgress.renderFps.toFixed(1),
				})
			: null;
	const exportRuntimeLabel = useMemo(() => {
		const renderBackend = options.exportProgress?.renderBackend;
		const encodeBackend = options.exportProgress?.encodeBackend;
		const encoderName = options.exportProgress?.encoderName;
		if (!renderBackend && !encodeBackend && !encoderName) return null;
		const rendererLabel =
			renderBackend === "webgpu" ? "WebGPU" : renderBackend === "webgl" ? "WebGL" : null;
		const encoderLabel =
			encodeBackend === "ffmpeg"
				? "Breeze"
				: encodeBackend === "webcodecs"
					? "WebCodecs"
					: null;
		const pathLabel =
			rendererLabel && encoderLabel
				? `${rendererLabel} + ${encoderLabel}`
				: (rendererLabel ?? encoderLabel);
		if (!pathLabel) return encoderName ?? null;
		return encoderName ? `${pathLabel} (${encoderName})` : pathLabel;
	}, [options]);
	const exportNativeSkipReasons =
		options.exportProgress?.nativeStaticLayoutSkipReasons &&
		options.exportProgress.nativeStaticLayoutSkipReasons.length > 0
			? options.exportProgress.nativeStaticLayoutSkipReasons
			: options.exportProgress?.nativeStaticLayoutSkipReason
				? [options.exportProgress.nativeStaticLayoutSkipReason]
				: [];
	const exportNativeSkipLabel =
		exportNativeSkipReasons.length > 0
			? `Native skipped: ${exportNativeSkipReasons[0]}${
					exportNativeSkipReasons.length > 1
						? ` (+${exportNativeSkipReasons.length - 1} more)`
						: ""
				}`
			: null;
	const exportPercentLabel = options.exportProgress
		? isExportPreparing
			? options.t("editor.exportStatus.preparing", "Preparing export...")
			: isExportSaving
				? options.t("editor.exportStatus.saving", "Opening save dialog...")
				: isRenderingAudio
					? options.t("editor.exportStatus.renderingAudio", "Rendering audio {{percent}}%", {
							percent: Math.round((options.exportProgress.audioProgress ?? 0) * 100),
						})
					: isExportFinalizing
						? options.exportFormat === "mp4" && options.exportPipelineModel === "modern"
							? isExportFinalSaveIndeterminate
								? options.t(
										"editor.exportStatus.muxingAndSaving",
										"Muxing audio and saving file...",
									)
								: options.t(
										"editor.exportStatus.muxingAndSavingPercent",
										"Muxing and saving {{percent}}%",
										{ percent: exportFinalizingPercent ?? 100 },
									)
							: options.t("editor.exportStatus.finalizingPercent", "Finalizing {{percent}}%", {
									percent: exportFinalizingPercent ?? 100,
								})
						: options.t("editor.exportStatus.completePercent", "{{percent}}% complete", {
								percent: Math.round(options.exportProgress.percentage),
							})
		: options.t("editor.exportStatus.preparing", "Preparing export...");

	return {
		showExportDropdown,
		setShowExportDropdown,
		handleOpenExportDropdown,
		handleStartExportFromDropdown,
		handleCancelExport,
		handleExportDropdownClose,
		revealExportedFile,
		isExportSaving,
		isExportPreparing,
		isExportFinalizing,
		isRenderingAudio,
		exportFinalizingProgress,
		exportFinalizingPercent,
		isExportMuxingAndSaving,
		isExportFinalSaveIndeterminate,
		isLightningExportInProgress,
		shouldSuspendPreviewRendering,
		isLegacyExportInProgress,
		exportRenderSpeedLabel,
		exportRuntimeLabel,
		exportNativeSkipLabel,
		exportPercentLabel,
	};
}

type UseSmokeExportControllerOptions = {
	enabled: boolean;
	projectPath: string | null;
	outputPath: string | null;
	error: string | null;
	videoPath: string | null;
	videoSourcePath: string | null;
	cursorTelemetrySourcePath: string | null;
	loading: boolean;
	isPreviewReady: boolean;
	duration: number;
	encodingMode: ExportEncodingMode;
	onWriteSmokeReport: (outputPath: string | null, payload: Record<string, unknown>) => Promise<void>;
	onRunExport: (settings: ExportSettings) => void;
	onCloseWindow: () => void;
};

const SMOKE_EXPORT_READY_TIMEOUT_MS = 45000;

export function useSmokeExportController(options: UseSmokeExportControllerOptions) {
	const smokeExportStartedRef = useRef(false);
	const smokeExportReadyStateRef = useRef<Record<string, unknown>>({});

	useEffect(() => {
		smokeExportReadyStateRef.current = {
			cursorTelemetrySourcePath: options.cursorTelemetrySourcePath,
			duration: options.duration,
			hasVideoPath: Boolean(options.videoPath),
			isPreviewReady: options.isPreviewReady,
			loading: options.loading,
			projectPath: options.projectPath ?? null,
			videoSourcePath: options.videoSourcePath,
		};
	}, [
		options.cursorTelemetrySourcePath,
		options.duration,
		options.isPreviewReady,
		options.loading,
		options.projectPath,
		options.videoPath,
		options.videoSourcePath,
	]);

	useEffect(() => {
		if (!options.enabled) return;
		const timeoutId = window.setTimeout(() => {
			if (smokeExportStartedRef.current) return;
			smokeExportStartedRef.current = true;
			void options
				.onWriteSmokeReport(options.outputPath, {
					success: false,
					phase: "ready",
					error: `Smoke export did not become ready within ${SMOKE_EXPORT_READY_TIMEOUT_MS}ms.`,
					readyState: smokeExportReadyStateRef.current,
				})
				.finally(() => options.onCloseWindow());
		}, SMOKE_EXPORT_READY_TIMEOUT_MS);
		return () => window.clearTimeout(timeoutId);
	}, [options]);

	useEffect(() => {
		if (!options.enabled || smokeExportStartedRef.current) return;
		if (options.error) {
			smokeExportStartedRef.current = true;
			void options
				.onWriteSmokeReport(options.outputPath, {
					success: false,
					phase: "load",
					error: options.error,
					readyState: smokeExportReadyStateRef.current,
				})
				.finally(() => options.onCloseWindow());
			return;
		}
		if (!options.videoPath || options.loading || !options.isPreviewReady || options.duration <= 0) {
			return;
		}
		if (
			options.projectPath &&
			options.videoSourcePath &&
			options.cursorTelemetrySourcePath !== options.videoSourcePath
		) {
			return;
		}
		smokeExportStartedRef.current = true;
		options.onRunExport({
			format: "mp4",
			quality: "good",
			encodingMode: options.encodingMode ?? "balanced",
		});
	}, [options]);
}

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
		} catch {}
		throw error;
	}
}

export function useExportExecutionController(options: any) {
	const exporterRef = useRef<any>(null);
	const pendingExportSaveRef = useRef<any>(null);
	const [hasPendingExportSave, setHasPendingExportSave] = useState(false);

	const clearPendingExportSave = useCallback(() => {
		const pending = pendingExportSaveRef.current;
		pendingExportSaveRef.current = null;
		setHasPendingExportSave(false);
		if (pending?.tempFilePath && typeof window !== "undefined") {
			void window.electronAPI.discardExportedTemp?.(pending.tempFilePath);
		}
	}, []);

	const markExportAsSaving = useCallback(() => {
		options.setExportProgress((previous: any) => ({
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
	}, [options]);

	const saveBlobExport = useCallback(async (blob: Blob, fileName: string, outputPath: string | null = null) => {
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
					pendingSave: { fileName, tempFilePath },
				};
			}
		} catch (error) {
			streamError = error;
		}
		if (!canUseInMemoryExportSaveFallback({ blobSize: blob.size, extension, hasExportStreamApi })) {
			const message = describeBlockedInMemoryExportSave({ blobSize: blob.size, extension });
			console.error("[export] Refusing in-memory blob save fallback", { fileName, streamError });
			throw new Error(message);
		}
		const arrayBuffer = await blob.arrayBuffer();
		return {
			saveResult: outputPath
				? await window.electronAPI.writeExportedVideoToPath(arrayBuffer, outputPath)
				: await window.electronAPI.saveExportedVideo(arrayBuffer, fileName),
			pendingSave: { fileName, arrayBuffer },
		};
	}, []);

	const handleExport = useCallback(async (settings: ExportSettings) => {
		if (!options.videoPath) return toast.error("No video loaded");
		const video = options.videoPlaybackRef.current?.video;
		if (!video) return toast.error("Video not ready");
		options.setIsExporting(true);
		options.setExportProgress(null);
		options.setExportError(null);
		clearPendingExportSave();
		options.onEmitExportEvent?.({ type: "export:start" });
		let keepExportDialogOpen = false;
		try {
			const wasPlaying = options.isPlaying;
			const restoreTime = video.currentTime;
			if (wasPlaying) options.videoPlaybackRef.current?.pause();
			const result = await options.runExportPipeline({
				settings,
				video,
				exporterRef,
				saveBlobExport,
				markExportAsSaving,
				setHasPendingExportSave,
				pendingExportSaveRef,
				setKeepExportDialogOpen: (v: boolean) => {
					keepExportDialogOpen = v;
				},
				setExportProgress: options.setExportProgress,
				setExportError: options.setExportError,
				setExportedFilePath: options.setExportedFilePath,
				showExportSuccessToast: options.showExportSuccessToast,
				showExportErrorToast: options.showExportErrorToast,
				writeSmokeExportReport: options.writeSmokeExportReport,
				closeWindow: options.closeWindow,
			});
			if (result?.restorePlayback) {
				if (wasPlaying) options.videoPlaybackRef.current?.play();
				else video.currentTime = restoreTime;
			}
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : "Unknown error";
			options.setExportError(errorMessage);
			options.showExportErrorToast(`Export failed: ${errorMessage}`);
			keepExportDialogOpen = true;
		} finally {
			options.onEmitExportEvent?.({ type: "export:complete" });
			options.setIsExporting(false);
			exporterRef.current = null;
			options.setShowExportDropdown(keepExportDialogOpen);
			options.remountPreview();
		}
	}, [options, clearPendingExportSave, markExportAsSaving, saveBlobExport]);

	const handleRetrySaveExport = useCallback(async () => {
		const pendingSave = pendingExportSaveRef.current;
		if (!pendingSave) return;
		let saveResult: any;
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
			options.setExportError("Save dialog canceled. Click Save Again to save without re-rendering.");
			toast.info("Save canceled. You can try again.");
			return;
		}
		if (saveResult.success && saveResult.path) {
			pendingExportSaveRef.current = null;
			setHasPendingExportSave(false);
			options.setExportError(null);
			options.setExportedFilePath(saveResult.path);
			options.showExportSuccessToast(saveResult.path);
			options.setShowExportDropdown(true);
			return;
		}
		const errorMessage = saveResult.message || "Failed to save video";
		options.setExportError(errorMessage);
		toast.error(errorMessage);
	}, [options]);

	const cancelExport = useCallback(() => {
		exporterRef.current?.cancel?.();
	}, []);

	useEffect(() => {
		return () => {
			exporterRef.current?.cancel?.();
			exporterRef.current = null;
			const pending = pendingExportSaveRef.current;
			pendingExportSaveRef.current = null;
			if (pending?.tempFilePath && typeof window !== "undefined") {
				void window.electronAPI.discardExportedTemp?.(pending.tempFilePath);
			}
		};
	}, []);

	return {
		handleExport,
		handleRetrySaveExport,
		clearPendingExportSave,
		hasPendingExportSave,
		cancelExport,
		setHasPendingExportSave,
		setPendingExportSaveRef: (value: any) => {
			pendingExportSaveRef.current = value;
		},
	};
}
