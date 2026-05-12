import { useCallback, useMemo, useState } from "react";

export interface UsePlaybackOptions {
	initialTime?: number;
	initialDuration?: number;
	initialIsPlaying?: boolean;
	initialVolume?: number;
	initialMuted?: boolean;
}

export interface UsePlaybackResult {
	currentTime: number;
	duration: number;
	isPlaying: boolean;
	volume: number;
	isMuted: boolean;
	setDuration: (nextDuration: number) => void;
	play: () => void;
	pause: () => void;
	togglePlayPause: () => void;
	seek: (nextTime: number) => void;
	skip: (deltaMs: number) => void;
	setVolume: (nextVolume: number) => void;
	toggleMute: () => void;
}

function clamp(value: number, min: number, max: number) {
	return Math.min(max, Math.max(min, value));
}

export function usePlayback(options: UsePlaybackOptions = {}): UsePlaybackResult {
	const [currentTime, setCurrentTime] = useState(options.initialTime ?? 0);
	const [duration, setDurationState] = useState(options.initialDuration ?? 0);
	const [isPlaying, setIsPlaying] = useState(options.initialIsPlaying ?? false);
	const [volume, setVolumeState] = useState(clamp(options.initialVolume ?? 1, 0, 1));
	const [isMuted, setIsMuted] = useState(options.initialMuted ?? false);

	const setDuration = useCallback((nextDuration: number) => {
		const safeDuration = Math.max(0, nextDuration);
		setDurationState(safeDuration);
		setCurrentTime((prev) => clamp(prev, 0, safeDuration));
	}, []);

	const play = useCallback(() => {
		setIsPlaying(true);
	}, []);

	const pause = useCallback(() => {
		setIsPlaying(false);
	}, []);

	const togglePlayPause = useCallback(() => {
		setIsPlaying((prev) => !prev);
	}, []);

	const seek = useCallback(
		(nextTime: number) => {
			setCurrentTime(clamp(nextTime, 0, duration));
		},
		[duration],
	);

	const skip = useCallback(
		(deltaMs: number) => {
			setCurrentTime((prev) => clamp(prev + deltaMs, 0, duration));
		},
		[duration],
	);

	const setVolume = useCallback((nextVolume: number) => {
		setVolumeState(clamp(nextVolume, 0, 1));
	}, []);

	const toggleMute = useCallback(() => {
		setIsMuted((prev) => !prev);
	}, []);

	return useMemo(
		() => ({
			currentTime,
			duration,
			isPlaying,
			volume,
			isMuted,
			setDuration,
			play,
			pause,
			togglePlayPause,
			seek,
			skip,
			setVolume,
			toggleMute,
		}),
		[
			currentTime,
			duration,
			isPlaying,
			volume,
			isMuted,
			setDuration,
			play,
			pause,
			togglePlayPause,
			seek,
			skip,
			setVolume,
			toggleMute,
		],
	);
}
