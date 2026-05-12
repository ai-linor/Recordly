import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

export interface EditorProjectFile {
	projectId: string;
	projectName: string;
	videoPath: string;
	projectPath: string | null;
	path?: string;
	name?: string;
	updatedAt?: number;
	thumbnailPath?: string | null;
	isCurrent?: boolean;
	isInProjectsDirectory?: boolean;
}

export interface UseProjectOptions<TSnapshot> {
	initialProject?: Partial<EditorProjectFile>;
	initialSnapshot: TSnapshot;
	autosaveDelayMs?: number;
	onSave?: (payload: { project: EditorProjectFile; snapshot: TSnapshot }) => Promise<void> | void;
	onLoad?: (
		projectPath: string,
	) => Promise<{ project: EditorProjectFile; snapshot: TSnapshot } | null>;
	onRefreshLibrary?: () => Promise<EditorProjectFile[]>;
}

export interface UseProjectResult<TSnapshot> {
	project: EditorProjectFile;
	isDirty: boolean;
	isSaving: boolean;
	saveError: string | null;
	lastSavedAt: string | null;
	projectLibrary: EditorProjectFile[];
	updateProject: (patch: Partial<EditorProjectFile>, options?: { markDirty?: boolean }) => void;
	registerSnapshotProvider: (provider: () => TSnapshot) => void;
	saveProject: () => Promise<boolean>;
	loadProject: (projectPath: string) => Promise<TSnapshot | null>;
	addToLibrary: (entry: EditorProjectFile) => void;
	setProjectLibrary: (entries: EditorProjectFile[]) => void;
	removeFromLibrary: (projectId: string) => void;
	refreshProjectLibrary: () => Promise<EditorProjectFile[]>;
	markDirty: () => void;
	clearDirty: () => void;
}

function getProjectErrorMessage(error: unknown): string {
	if (error instanceof Error) {
		return error.message;
	}
	if (typeof error === "string") {
		return error.replace(/^Error:\s*/i, "");
	}
	return "Something went wrong";
}

export interface UseProjectControllerOptions<TSnapshot, TProjectData> {
	projectManager: UseProjectResult<TSnapshot>;
	projectDisplayName: string;
	currentSourcePath: string | null;
	currentProjectPath: string | null;
	currentProjectSnapshot: TProjectData | null;
	currentPersistedEditorState: TProjectData extends { editor: infer TEditor } ? TEditor : never;
	lastSavedProjectId: string | null;
	captureProjectThumbnail: () => Promise<string | null | undefined>;
	remountPreview: () => void;
	setCurrentProjectPath: (path: string | null) => void;
	setLastSavedSnapshot: (snapshot: TProjectData | null) => void;
	createProjectData: (
		sourcePath: string,
		editorState: TProjectData extends { editor: infer TEditor } ? TEditor : never,
		projectId: string | null,
	) => TProjectData;
	cloneStructured: <T>(value: T) => T;
	applyLoadedProject: (candidate: unknown, path?: string | null) => Promise<boolean>;
	onMenuLoadProject: (handler: () => void) => (() => void) | undefined;
	onMenuSaveProject: (handler: () => void) => (() => void) | undefined;
	onMenuSaveProjectAs: (handler: () => void) => (() => void) | undefined;
	onRequestSaveBeforeClose: (
		handler: () => Promise<boolean>,
	) => (() => void) | undefined;
}

type InitializeEditorProjectStateOptions = {
	smokeExportEnabled: boolean;
	smokeExportProjectPath: string | null;
	smokeExportInputPath: string | null;
	smokeExportWebcamInputPath: string | null;
	smokeExportWebcamShadow: number | undefined;
	smokeExportWebcamSize: number | undefined;
	devOpenRecordingInputPath: string | null;
	devOpenRecordingWebcamInputPath: string | null;
	autoApplyFreshRecordingAutoZooms: boolean;
	initialEditorPreferences: {
		padding: unknown;
		borderRadius: number;
		aspectRatio: unknown;
		exportFormat: unknown;
		mp4FrameRate: unknown;
		exportQuality: unknown;
		exportEncodingMode: unknown;
		exportBackendPreference: unknown;
		exportPipelineModel: unknown;
		gifFrameRate: unknown;
		gifLoop: boolean;
		gifSizePreset: unknown;
	};
	fromFileUrl: (value: string) => string;
	resolveVideoUrl: (value: string) => Promise<string>;
	applyLoadedProject: (candidate: unknown, path?: string | null) => Promise<boolean>;
	applySessionPresentation: (session: any) => void;
	setVideoSourcePath: (value: string) => void;
	setVideoPath: (value: string) => void;
	setCurrentProjectPath: (value: string | null) => void;
	setLastSavedSnapshot: (value: null) => void;
	setPendingFreshRecordingAutoZoomPath: (value: string | null) => void;
	setWebcam: (update: (prev: any) => any) => void;
	setError: (value: string | null) => void;
	setLoading: (value: boolean) => void;
	setPadding: (value: any) => void;
	setBorderRadius: (value: number) => void;
	setAspectRatio: (value: any) => void;
	setExportFormat: (value: any) => void;
	setMp4FrameRate: (value: any) => void;
	setExportQuality: (value: any) => void;
	setExportEncodingMode: (value: any) => void;
	setExportBackendPreference: (value: any) => void;
	setExportPipelineModel: (value: any) => void;
	setGifFrameRate: (value: any) => void;
	setGifLoop: (value: boolean) => void;
	setGifSizePreset: (value: any) => void;
	defaultWebcamTimeOffsetMs: number;
};

export function useProjectBootstrapController() {
	const initializeEditorProjectState = useCallback(
		async (options: InitializeEditorProjectStateOptions) => {
			try {
				if (options.smokeExportEnabled && options.smokeExportProjectPath) {
					const projectResult = await window.electronAPI.openProjectFileAtPath(
						options.smokeExportProjectPath,
					);
					if (!projectResult.success || !projectResult.project) {
						options.setError(
							`Smoke export failed to load project ${options.smokeExportProjectPath}: ${
								projectResult.error || projectResult.message || "unknown error"
							}`,
						);
						return;
					}
					const restored = await options.applyLoadedProject(
						projectResult.project,
						projectResult.path ?? options.smokeExportProjectPath,
					);
					if (!restored) {
						options.setError(
							`Smoke export could not apply project ${options.smokeExportProjectPath}`,
						);
						return;
					}
					options.setError(null);
					return;
				}

				if (!options.smokeExportEnabled && options.devOpenRecordingInputPath) {
					const sourcePath = options.fromFileUrl(options.devOpenRecordingInputPath);
					const sourceVideoUrl = await options.resolveVideoUrl(sourcePath);
					const webcamSourcePath = options.devOpenRecordingWebcamInputPath
						? options.fromFileUrl(options.devOpenRecordingWebcamInputPath)
						: null;
					options.setVideoSourcePath(sourcePath);
					options.setVideoPath(sourceVideoUrl);
					options.setCurrentProjectPath(null);
					options.setLastSavedSnapshot(null);
					options.setPendingFreshRecordingAutoZoomPath(
						options.autoApplyFreshRecordingAutoZooms ? sourceVideoUrl : null,
					);
					options.setWebcam((prev) => ({
						...prev,
						enabled: Boolean(webcamSourcePath),
						sourcePath: webcamSourcePath,
						timeOffsetMs: options.defaultWebcamTimeOffsetMs,
					}));
					options.setError(null);
					return;
				}

				if (options.smokeExportEnabled) {
					if (!options.smokeExportInputPath) {
						options.setError("Smoke export input path is missing.");
						return;
					}
					const sourcePath = options.fromFileUrl(options.smokeExportInputPath);
					const sourceVideoUrl = await options.resolveVideoUrl(sourcePath);
					const smokeWebcamSourcePath = options.smokeExportWebcamInputPath
						? options.fromFileUrl(options.smokeExportWebcamInputPath)
						: null;
					options.setVideoSourcePath(sourcePath);
					options.setVideoPath(sourceVideoUrl);
					options.setCurrentProjectPath(null);
					options.setLastSavedSnapshot(null);
					options.setPendingFreshRecordingAutoZoomPath(null);
					options.setWebcam((prev) => ({
						...prev,
						enabled: !!smokeWebcamSourcePath,
						sourcePath: smokeWebcamSourcePath,
						timeOffsetMs: options.defaultWebcamTimeOffsetMs,
						shadow:
							options.smokeExportWebcamShadow === undefined
								? prev.shadow
								: options.smokeExportWebcamShadow,
						size:
							options.smokeExportWebcamSize === undefined
								? prev.size
								: options.smokeExportWebcamSize,
					}));
					options.setError(null);
					return;
				}

				const currentProjectResult = await window.electronAPI.loadCurrentProjectFile();
				if (currentProjectResult.success && currentProjectResult.project) {
					const restored = await options.applyLoadedProject(
						currentProjectResult.project,
						currentProjectResult.path ?? null,
					);
					if (restored) {
						options.setPadding(options.initialEditorPreferences.padding);
						options.setBorderRadius(options.initialEditorPreferences.borderRadius);
						options.setAspectRatio(options.initialEditorPreferences.aspectRatio);
						options.setExportFormat(options.initialEditorPreferences.exportFormat);
						options.setMp4FrameRate(options.initialEditorPreferences.mp4FrameRate);
						options.setExportQuality(options.initialEditorPreferences.exportQuality);
						options.setExportEncodingMode(
							options.initialEditorPreferences.exportEncodingMode,
						);
						options.setExportBackendPreference(
							options.initialEditorPreferences.exportBackendPreference,
						);
						options.setExportPipelineModel(
							options.initialEditorPreferences.exportPipelineModel,
						);
						options.setGifFrameRate(options.initialEditorPreferences.gifFrameRate);
						options.setGifLoop(options.initialEditorPreferences.gifLoop);
						options.setGifSizePreset(options.initialEditorPreferences.gifSizePreset);
						return;
					}
				}

				const sessionResult = await window.electronAPI.getCurrentRecordingSession?.();
				if (sessionResult?.success && sessionResult.session?.videoPath) {
					const sourcePath = options.fromFileUrl(sessionResult.session.videoPath);
					const sourceVideoUrl = await options.resolveVideoUrl(sourcePath);
					options.setVideoSourcePath(sourcePath);
					options.setVideoPath(sourceVideoUrl);
					options.setCurrentProjectPath(null);
					options.setLastSavedSnapshot(null);
					options.setPendingFreshRecordingAutoZoomPath(
						options.autoApplyFreshRecordingAutoZooms ? sourceVideoUrl : null,
					);
					options.applySessionPresentation(sessionResult.session);
					options.setWebcam((prev) => ({
						...prev,
						enabled: Boolean(sessionResult.session?.webcamPath),
						sourcePath: sessionResult.session?.webcamPath ?? null,
						timeOffsetMs:
							sessionResult.session?.timeOffsetMs ??
							options.defaultWebcamTimeOffsetMs,
					}));
					return;
				}

				const result = await window.electronAPI.getCurrentVideoPath();
				if (result.success && result.path) {
					const sourcePath = options.fromFileUrl(result.path);
					const sourceVideoUrl = await options.resolveVideoUrl(sourcePath);
					options.setVideoSourcePath(sourcePath);
					options.setVideoPath(sourceVideoUrl);
					options.setCurrentProjectPath(null);
					options.setLastSavedSnapshot(null);
					options.setPendingFreshRecordingAutoZoomPath(null);
					options.applySessionPresentation(null);
					options.setWebcam((prev) => ({
						...prev,
						enabled: false,
						sourcePath: null,
						timeOffsetMs: options.defaultWebcamTimeOffsetMs,
					}));
				} else {
					options.setError("No video to load. Please record or select a video.");
				}
			} catch (err) {
				options.setError(`Error loading video: ${String(err)}`);
			} finally {
				options.setLoading(false);
			}
		},
		[],
	);

	return { initializeEditorProjectState };
}

export function useProjectController<TSnapshot, TProjectData>(
	options: UseProjectControllerOptions<TSnapshot, TProjectData>,
) {
	const [projectBrowserOpen, setProjectBrowserOpen] = useState(false);
	const [isEditingProjectName, setIsEditingProjectName] = useState(false);
	const [projectNameDraft, setProjectNameDraft] = useState("");
	const [isSavingProjectName, setIsSavingProjectName] = useState(false);
	const [projectSaveQueue, setProjectSaveQueue] = useState<Promise<void>>(Promise.resolve());

	useEffect(() => {
		if (!isEditingProjectName) {
			setProjectNameDraft(options.projectDisplayName);
		}
	}, [isEditingProjectName, options.projectDisplayName]);

	const queueProjectSave = useCallback((task: () => Promise<boolean>) => {
		const run = projectSaveQueue.catch(() => undefined).then(task);
		setProjectSaveQueue(run.then(() => undefined).catch(() => undefined));
		return run;
	}, [projectSaveQueue]);

	const saveProject = useCallback(
		async (forceSaveAs: boolean, saveOpts?: { silent?: boolean }) => {
			return queueProjectSave(async () => {
				if (!options.currentSourcePath) {
					if (!saveOpts?.silent) {
						toast.error("No video loaded");
					}
					return false;
				}

				try {
					const projectData =
						options.currentProjectSnapshot &&
						(options.currentProjectSnapshot as { videoPath?: string }).videoPath ===
							options.currentSourcePath
							? options.currentProjectSnapshot
							: options.createProjectData(
									options.currentSourcePath,
									options.currentPersistedEditorState,
									options.lastSavedProjectId,
								);

					const fileNameBase =
						options.currentSourcePath
							.split(/[\\/]/)
							.pop()
							?.replace(/\.[^.]+$/, "") || `project-${Date.now()}`;
					let targetProjectPath = forceSaveAs
						? undefined
						: (options.currentProjectPath ?? undefined);

					if (!forceSaveAs && !targetProjectPath) {
						const activeProjectResult = await window.electronAPI.loadCurrentProjectFile();
						if (activeProjectResult.success && activeProjectResult.path) {
							targetProjectPath = activeProjectResult.path;
							options.setCurrentProjectPath(activeProjectResult.path);
						}
					}

					const thumbnailDataUrl = await options.captureProjectThumbnail();
					const result = await window.electronAPI.saveProjectFile(
						projectData as never,
						fileNameBase,
						targetProjectPath,
						thumbnailDataUrl,
					);

					if (result.canceled) {
						if (!saveOpts?.silent) {
							toast.info("Project save canceled");
						}
						return false;
					}
					if (!result.success) {
						if (!saveOpts?.silent) {
							toast.error(result.message || "Failed to save project");
						}
						return false;
					}

					if (result.path) {
						options.setCurrentProjectPath(result.path);
					}
					options.setLastSavedSnapshot(
						options.cloneStructured(
							options.createProjectData(
								(options.currentSourcePath as string),
								(options.currentPersistedEditorState as never),
								result.projectId ??
									((projectData as { projectId?: string | null }).projectId ?? null),
							),
						),
					);
					await options.projectManager.refreshProjectLibrary();

					if (!saveOpts?.silent) {
						toast.success(`Project saved to ${result.path}`);
					}
					return true;
				} finally {
					options.remountPreview();
				}
			});
		},
		[options, queueProjectSave],
	);

	const saveProjectWithName = useCallback(
		async (projectName: string) => {
			const trimmedProjectName = projectName.trim();
			if (!trimmedProjectName) {
				toast.error("Project name is required");
				return false;
			}
			if (!options.currentSourcePath) {
				toast.error("No video loaded");
				return false;
			}

			try {
				const projectData =
					options.currentProjectSnapshot &&
					(options.currentProjectSnapshot as { videoPath?: string }).videoPath ===
						options.currentSourcePath
						? options.currentProjectSnapshot
						: options.createProjectData(
								options.currentSourcePath,
								options.currentPersistedEditorState,
								options.lastSavedProjectId,
							);
				const thumbnailDataUrl = await options.captureProjectThumbnail();
				const result = await window.electronAPI.saveProjectFileNamed(
					projectData as never,
					trimmedProjectName,
					thumbnailDataUrl,
				);
				if (result.canceled) {
					toast.info("Project save canceled");
					return false;
				}
				if (!result.success) {
					toast.error(result.message || "Failed to save project");
					return false;
				}
				if (result.path) {
					options.setCurrentProjectPath(result.path);
				}
				options.setLastSavedSnapshot(
					options.cloneStructured(
						options.createProjectData(
							options.currentSourcePath,
							options.currentPersistedEditorState,
							result.projectId ??
								((projectData as { projectId?: string | null }).projectId ?? null),
						),
					),
				);
				await options.projectManager.refreshProjectLibrary();
				toast.success(result.path ? `Project saved to ${result.path}` : "Project saved");
				return true;
			} finally {
				options.remountPreview();
			}
		},
		[options],
	);

	const closeProjectNameEditor = useCallback(() => {
		setProjectNameDraft(options.projectDisplayName);
		setIsEditingProjectName(false);
	}, [options.projectDisplayName]);

	const handleProjectNameSubmit = useCallback(
		async (event?: React.FormEvent<HTMLFormElement>) => {
			event?.preventDefault();
			const trimmedProjectName = projectNameDraft.trim();
			if (!trimmedProjectName) {
				closeProjectNameEditor();
				return;
			}
			setIsSavingProjectName(true);
			let saved = false;
			try {
				saved = await saveProjectWithName(trimmedProjectName);
			} catch (error) {
				toast.error(getProjectErrorMessage(error));
			} finally {
				setIsSavingProjectName(false);
			}
			if (saved) {
				setIsEditingProjectName(false);
			}
		},
		[closeProjectNameEditor, projectNameDraft, saveProjectWithName],
	);

	const handleOpenProjectFromLibrary = useCallback(
		async (projectPath: string) => {
			const loadedProject = await options.projectManager.loadProject(projectPath);
			if (!loadedProject) {
				toast.error("Failed to load project");
				return;
			}
			const restored = await options.applyLoadedProject(loadedProject, projectPath);
			if (!restored) {
				toast.error("Invalid project file format");
				return;
			}
			setProjectBrowserOpen(false);
			await options.projectManager.refreshProjectLibrary();
			toast.success(`Project loaded from ${projectPath}`);
		},
		[options],
	);

	const handleOpenProjectBrowser = useCallback(async () => {
		if (projectBrowserOpen) {
			setProjectBrowserOpen(false);
			return;
		}
		await options.projectManager.refreshProjectLibrary();
		setProjectBrowserOpen(true);
	}, [options.projectManager, projectBrowserOpen]);

	const handleSaveProject = useCallback(async () => {
		await saveProject(false);
	}, [saveProject]);

	const handleSaveProjectAs = useCallback(async () => {
		const saved = await saveProject(true);
		if (saved) {
			setProjectBrowserOpen(false);
		}
	}, [saveProject]);

	useEffect(() => {
		const removeLoadListener = options.onMenuLoadProject(() => {
			void handleOpenProjectBrowser();
		});
		const removeSaveListener = options.onMenuSaveProject(() => {
			void handleSaveProject();
		});
		const removeSaveAsListener = options.onMenuSaveProjectAs(() => {
			void handleSaveProjectAs();
		});
		return () => {
			removeLoadListener?.();
			removeSaveListener?.();
			removeSaveAsListener?.();
		};
	}, [handleOpenProjectBrowser, handleSaveProject, handleSaveProjectAs, options]);

	useEffect(() => {
		const cleanup = options.onRequestSaveBeforeClose(async () => saveProject(false));
		return () => cleanup?.();
	}, [options, saveProject]);

	return {
		projectBrowserOpen,
		setProjectBrowserOpen,
		isEditingProjectName,
		setIsEditingProjectName,
		projectNameDraft,
		setProjectNameDraft,
		isSavingProjectName,
		closeProjectNameEditor,
		handleProjectNameSubmit,
		handleOpenProjectFromLibrary,
		handleOpenProjectBrowser,
		handleSaveProject,
		handleSaveProjectAs,
		saveProject,
		saveProjectWithName,
	};
}

function normalizeProjectFile(input?: Partial<EditorProjectFile>): EditorProjectFile {
	return {
		projectId: input?.projectId ?? crypto.randomUUID(),
		projectName: input?.projectName ?? "Untitled Project",
		videoPath: input?.videoPath ?? "",
		projectPath: input?.projectPath ?? null,
	};
}

export function useProject<TSnapshot>(
	options: UseProjectOptions<TSnapshot>,
): UseProjectResult<TSnapshot> {
	const [project, setProject] = useState(() => normalizeProjectFile(options.initialProject));
	const [projectLibrary, setProjectLibrary] = useState<EditorProjectFile[]>([]);
	const [isDirty, setIsDirty] = useState(false);
	const [isSaving, setIsSaving] = useState(false);
	const [saveError, setSaveError] = useState<string | null>(null);
	const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
	const snapshotProviderRef = useRef<() => TSnapshot>(() => options.initialSnapshot);
	const autosaveDelayMs = options.autosaveDelayMs ?? 1200;

	const registerSnapshotProvider = useCallback((provider: () => TSnapshot) => {
		snapshotProviderRef.current = provider;
	}, []);

	const saveProject = useCallback(async () => {
		if (!options.onSave) {
			setIsDirty(false);
			return true;
		}

		setIsSaving(true);
		setSaveError(null);
		try {
			await options.onSave({
				project,
				snapshot: snapshotProviderRef.current(),
			});
			setIsDirty(false);
			setLastSavedAt(new Date().toISOString());
			return true;
		} catch (error) {
			setSaveError(error instanceof Error ? error.message : "Failed to save project");
			return false;
		} finally {
			setIsSaving(false);
		}
	}, [options, project]);

	const loadProject = useCallback(
		async (projectPath: string) => {
			if (!options.onLoad) {
				return null;
			}

			const loaded = await options.onLoad(projectPath);
			if (!loaded) {
				return null;
			}

			setProject(loaded.project);
			setIsDirty(false);
			setSaveError(null);
			return loaded.snapshot;
		},
		[options],
	);

	const updateProject = useCallback(
		(patch: Partial<EditorProjectFile>, options?: { markDirty?: boolean }) => {
			setProject((prev) => ({ ...prev, ...patch }));
			if (options?.markDirty ?? true) {
				setIsDirty(true);
			}
		},
		[],
	);

	const addToLibrary = useCallback((entry: EditorProjectFile) => {
		setProjectLibrary((prev) => {
			const deduped = prev.filter((item) => item.projectId !== entry.projectId);
			return [entry, ...deduped];
		});
	}, []);

	const removeFromLibrary = useCallback((projectId: string) => {
		setProjectLibrary((prev) => prev.filter((item) => item.projectId !== projectId));
	}, []);

	const setProjectLibraryEntries = useCallback((entries: EditorProjectFile[]) => {
		setProjectLibrary(entries);
	}, []);

	const refreshProjectLibrary = useCallback(async () => {
		if (!options.onRefreshLibrary) {
			return [];
		}

		try {
			const entries = await options.onRefreshLibrary();
			setProjectLibrary(entries);
			return entries;
		} catch {
			return [];
		}
	}, [options.onRefreshLibrary]);

	const markDirty = useCallback(() => {
		setIsDirty(true);
	}, []);

	const clearDirty = useCallback(() => {
		setIsDirty(false);
	}, []);

	useEffect(() => {
		if (!isDirty || !options.onSave) {
			return;
		}

		const timeout = globalThis.setTimeout(() => {
			void saveProject();
		}, autosaveDelayMs);

		return () => globalThis.clearTimeout(timeout);
	}, [isDirty, options.onSave, saveProject, autosaveDelayMs]);

	return useMemo(
		() => ({
			project,
			isDirty,
			isSaving,
			saveError,
			lastSavedAt,
			projectLibrary,
			updateProject,
			registerSnapshotProvider,
			saveProject,
			loadProject,
			addToLibrary,
			setProjectLibrary: setProjectLibraryEntries,
			removeFromLibrary,
			refreshProjectLibrary,
			markDirty,
			clearDirty,
		}),
		[
			project,
			isDirty,
			isSaving,
			saveError,
			lastSavedAt,
			projectLibrary,
			updateProject,
			registerSnapshotProvider,
			saveProject,
			loadProject,
			addToLibrary,
			setProjectLibraryEntries,
			removeFromLibrary,
			refreshProjectLibrary,
			markDirty,
			clearDirty,
		],
	);
}
