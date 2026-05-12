import { UserCircle as User } from "@phosphor-icons/react";
import { motion } from "motion/react";
import { useCallback } from "react";
import type React from "react";
import { toast } from "sonner";
import { useEditorSidebarState } from "@/components/video-editor/editor/hooks/useVideoEditorStore";
import { ExtensionIcon } from "@/components/video-editor/ExtensionIcon";
import type { EditorEffectSection } from "@/components/video-editor/types";

export type EditorSidebarSection = {
	id: EditorEffectSection;
	label: string;
	icon: React.ComponentType<{ className?: string; weight?: "fill" | "regular" }> | string;
	extensionPath?: string | null;
};

type EditorSidebarProps = {
	editorSectionButtons: EditorSidebarSection[];
	t: (key: string, fallback?: string) => string;
	renderPanel: (helpers: {
		onUploadWebcam: () => Promise<void>;
		onClearWebcam: () => Promise<void>;
	}) => React.ReactNode;
};

export function EditorSidebar({
	editorSectionButtons,
	t,
	renderPanel,
}: EditorSidebarProps) {
	const {
		activeEffectSection,
		setActiveEffectSection,
		setWebcam,
		syncRecordingSessionWebcam,
		defaultWebcamTimeOffsetMs,
	} = useEditorSidebarState();

	const handleUploadWebcam = useCallback(async () => {
		if (!setWebcam || !syncRecordingSessionWebcam) {
			return;
		}
		const result = await window.electronAPI.openVideoFilePicker();
		if (!result.success || !result.path) {
			return;
		}

		setWebcam((prev) => ({
			...prev,
			enabled: true,
			sourcePath: result.path ?? null,
			timeOffsetMs: defaultWebcamTimeOffsetMs,
		}));

		await syncRecordingSessionWebcam(result.path, defaultWebcamTimeOffsetMs);
		toast.success(t("settings.effects.webcamFootageAdded"));
	}, [defaultWebcamTimeOffsetMs, setWebcam, syncRecordingSessionWebcam, t]);

	const handleClearWebcam = useCallback(async () => {
		if (!setWebcam || !syncRecordingSessionWebcam) {
			return;
		}
		setWebcam((prev) => ({
			...prev,
			enabled: false,
			sourcePath: null,
			timeOffsetMs: defaultWebcamTimeOffsetMs,
		}));

		await syncRecordingSessionWebcam(null);
		toast.success(t("settings.effects.webcamFootageRemoved"));
	}, [defaultWebcamTimeOffsetMs, setWebcam, syncRecordingSessionWebcam, t]);

	return (
		<div className="flex flex-shrink-0 gap-1.5">
			<div className="flex flex-shrink-0 flex-col items-center gap-0.5 px-2 py-2">
				{editorSectionButtons.map((section) => {
					const isActive = activeEffectSection === section.id;
					return (
						<div key={section.id} className="flex items-center">
							<motion.button
								type="button"
								onClick={() => setActiveEffectSection(section.id)}
								title={section.label}
								className="group relative flex h-9 w-9 items-center justify-center rounded-lg outline-none focus:outline-none focus-visible:outline-none"
								animate={{ opacity: isActive ? 1 : 0.55 }}
								transition={{ duration: 0.14 }}
							>
								{isActive && (
									<motion.span
										layoutId="rail-active-bg"
										className="absolute inset-0 rounded-lg bg-foreground/[0.08]"
										transition={{ type: "spring", stiffness: 450, damping: 35 }}
									/>
								)}
								<motion.span
									className="relative z-10"
									animate={{
										color: isActive ? "#2563EB" : "hsl(var(--foreground))",
									}}
									transition={{ duration: 0.14 }}
								>
									{typeof section.icon === "string" ? (
										<ExtensionIcon
											icon={section.icon}
											extensionPath={section.extensionPath}
											className="h-[27px] w-[27px]"
										/>
									) : (
										<section.icon
											className="h-[27px] w-[27px]"
											weight={isActive ? "fill" : "regular"}
										/>
									)}
								</motion.span>
							</motion.button>
							<div className="ml-1.5 h-1.5 w-1.5 flex-shrink-0">
								{isActive && (
									<motion.span
										layoutId="rail-active-dot"
										className="block h-1.5 w-1.5 rounded-full bg-[#2563EB]"
										initial={{ opacity: 0, scale: 0.5 }}
										animate={{ opacity: 1, scale: 1 }}
										exit={{ opacity: 0, scale: 0.5 }}
										transition={{ type: "spring", stiffness: 500, damping: 32 }}
									/>
								)}
							</div>
						</div>
					);
				})}
				<div className="mt-auto flex flex-col items-center gap-0.5 pt-3">
					<motion.button
						type="button"
						onClick={() => toast.info("Account coming soon")}
						title="Account"
						className="group relative flex h-9 w-9 items-center justify-center rounded-lg text-foreground/55 outline-none transition hover:text-foreground focus:outline-none focus-visible:outline-none"
						whileHover={{ opacity: 1 }}
						initial={{ opacity: 0.55 }}
					>
						<motion.span className="absolute inset-0 rounded-lg bg-foreground/[0.04] opacity-0 transition group-hover:opacity-100" />
						<User className="relative z-10 h-[22px] w-[22px]" />
					</motion.button>
				</div>
			</div>
			{renderPanel({
				onUploadWebcam: handleUploadWebcam,
				onClearWebcam: handleClearWebcam,
			})}
		</div>
	);
}
