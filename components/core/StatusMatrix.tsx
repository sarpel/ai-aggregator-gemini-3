import React, { useCallback, useState } from "react";
import { DEFAULT_MODELS } from "../../config";
import { type ModelConfig, type ModelResponse, ModelStatus } from "../../types";
import ModelAvatar from "../ui/ModelAvatar";
import ModelDetailsModal from "./ModelDetailsModal";

interface StatusMatrixProps {
	activeModels: string[];
	modelResponses: Record<string, ModelResponse>;
	modelConfigs?: ModelConfig[];
}

interface ModelCardProps {
	model: ModelConfig;
	isActive: boolean;
	response?: ModelResponse;
	onSelect: (id: string) => void;
}

const MAX_PREVIEW_LENGTH = 220;

function createModelPreview(
	response: ModelResponse | undefined,
	status: ModelStatus,
	isError: boolean,
): string {
	if (!response) {
		return "";
	}

	if (isError && response.error) {
		return `Error: ${response.error}`;
	}

	const text = response.text.trim();
	if (text.length <= MAX_PREVIEW_LENGTH) {
		return text;
	}

	return text.slice(-MAX_PREVIEW_LENGTH).trimStart();
}

const ModelCard: React.FC<ModelCardProps> = React.memo(
	({ model, isActive, response, onSelect }) => {
		const status = isActive
			? response?.status || ModelStatus.IDLE
			: ModelStatus.IDLE;
		const hasData = isActive && (response?.text.length || 0) > 0;
		const isCompleted = status === ModelStatus.COMPLETED;
		const isError =
			status === ModelStatus.ERROR || status === ModelStatus.TIMEOUT;

		let overlayClass = "";
		let overlayStyle = {};

		if (status === ModelStatus.STREAMING) {
			overlayClass = "bg-green-500/20 animate-pulse-green";
		} else if (status === ModelStatus.TIMEOUT || status === ModelStatus.ERROR) {
			overlayClass = "bg-red-500/20 animate-pulse-red";
		} else if (status === ModelStatus.CONNECTING) {
			overlayClass = "bg-yellow-500/20 animate-delayed-fade-in";
			overlayStyle = {
				animation:
					"delayedFadeIn 0.1s linear 30s forwards, pulseYellow 2s cubic-bezier(0.4, 0, 0.6, 1) infinite 30s",
			};
		}

		return (
			<button
				type="button"
				disabled={!isActive}
				onClick={() => isActive && onSelect(model.id)}
				className={`relative p-3 border transition-all duration-300 overflow-hidden group flex flex-col text-left disabled:cursor-default ${
					isActive
						? isError
							? "border-red-500/50 bg-red-900/10 shadow-[0_0_15px_rgba(255,42,42,0.15)]"
							: "border-cyber-gray bg-cyber-gray/10"
						: "border-transparent opacity-30 grayscale"
				} rounded-sm`}
				aria-label={`${model.name} status ${status}`}
			>
				{/* Status Animation Overlay */}
				{isActive &&
					status !== ModelStatus.IDLE &&
					status !== ModelStatus.COMPLETED && (
						<div
							className={`absolute inset-0 pointer-events-none z-0 ${overlayClass}`}
							style={overlayStyle}
						></div>
					)}

				{/* Header Info */}
				<div className="flex items-center gap-3 relative z-10">
					<ModelAvatar
						providerId={model.id}
						name={model.name}
						color={isError ? "#ff2a2a" : model.avatarColor}
						status={status}
						mini
						progress={response?.progress || 0}
					/>

					<div className="flex flex-col min-w-0">
						<span
							className={`text-xs font-bold font-mono truncate ${
								isActive
									? isError
										? "text-red-400"
										: "text-white"
									: "text-gray-500"
							}`}
						>
							{model.name}
						</span>
						<span
							className={`text-[10px] font-mono truncate uppercase flex items-center gap-1 ${
								isError ? "text-red-500" : "text-gray-400"
							}`}
						>
							{status}
							{status === ModelStatus.STREAMING && (
								<span className="block w-1 h-1 bg-cyber-neon rounded-full animate-ping" />
							)}
						</span>
					</div>
				</div>

				{/* Mini Terminal "TV" Effect */}
				<div
					className={`
        relative w-full bg-black border-x border-b rounded-b-sm shadow-[inset_0_0_15px_rgba(0,0,0,1)] overflow-hidden
        origin-top transition-all duration-500
        ${hasData || isError ? "animate-tv-on mt-3" : "h-0 opacity-0 mt-0 scale-y-0"}
        ${isError ? "border-red-900/50" : "border-cyber-gray/50"}
      `}
					style={{ height: hasData || isError ? "6rem" : "0" }}
				>
					<div className="absolute inset-0 z-20 pointer-events-none opacity-10 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_4px,6px_100%]"></div>
					<div
						className={`absolute top-0 left-0 w-full h-full bg-gradient-to-b from-transparent ${isError ? "via-red-500/5" : "via-cyber-neon/5"} to-transparent animate-scanline z-20 pointer-events-none`}
					></div>
					<div className="p-2 font-mono text-[10px] leading-4 h-full flex flex-col justify-end relative z-10">
						<div
							className={`${isError ? "text-red-400" : "text-cyber-neon/80"} font-medium tracking-tight break-words whitespace-pre-wrap overflow-hidden`}
							style={{
								maskImage: "linear-gradient(to bottom, transparent, black 20%)",
							}}
						>
							{createModelPreview(response, status, isError)}
							{status === ModelStatus.STREAMING && (
								<span className="inline-block w-1.5 h-3 bg-cyber-neon align-middle animate-pulse ml-0.5 shadow-[0_0_5px_#00f3ff]"></span>
							)}
							{isCompleted && (
								<span className="text-green-500 ml-1 animate-pulse">▮</span>
							)}
						</div>
					</div>
					<div className="absolute top-0 right-0 w-full h-full bg-gradient-to-bl from-white/5 to-transparent pointer-events-none z-30"></div>
					{isCompleted && (
						<div className="absolute inset-0 bg-green-500/20 animate-pulse pointer-events-none z-0 mix-blend-overlay"></div>
					)}
					{isError && (
						<div className="absolute inset-0 bg-red-500/10 animate-pulse-fast pointer-events-none z-0 mix-blend-overlay"></div>
					)}
				</div>

				{status === ModelStatus.STREAMING && (
					<div
						className="absolute bottom-0 left-0 h-[1px] bg-cyber-neon shadow-[0_0_5px_#00f3ff] transition-all duration-300 z-40"
						style={{ width: `${response?.progress ?? 0}%` }}
					/>
				)}

				{isActive && !isError && (
					<div className="absolute inset-0 bg-cyber-neon/5 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-0" />
				)}
				{isActive && isError && (
					<div className="absolute inset-0 bg-red-500/5 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-0" />
				)}
			</button>
		);
	},
	(prev, next) => {
		return (
			prev.model.id === next.model.id &&
			prev.model.name === next.model.name &&
			prev.model.avatarColor === next.model.avatarColor &&
			prev.model.description === next.model.description &&
			prev.isActive === next.isActive &&
			prev.response?.status === next.response?.status &&
			prev.response?.text === next.response?.text &&
			prev.response?.error === next.response?.error &&
			prev.response?.progress === next.response?.progress
		);
	},
);

const StatusMatrix: React.FC<StatusMatrixProps> = ({
	activeModels,
	modelResponses,
	modelConfigs,
}) => {
	const [selectedModelId, setSelectedModelId] = useState<string | null>(null);

	const modelsToRender = modelConfigs ?? DEFAULT_MODELS;
	const selectedModelConfig = selectedModelId
		? modelsToRender.find((m) => m.id === selectedModelId)
		: null;
	const selectedModelResponse = selectedModelId
		? modelResponses[selectedModelId]
		: null;

	const handleSelect = useCallback((id: string) => {
		setSelectedModelId(id);
	}, []);

	return (
		<>
			<div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
				{modelsToRender.map((model) => (
					<ModelCard
						key={model.id}
						model={model}
						isActive={activeModels.includes(model.id)}
						response={modelResponses[model.id]}
						onSelect={handleSelect}
					/>
				))}
			</div>

			{selectedModelId && selectedModelConfig && selectedModelResponse && (
				<ModelDetailsModal
					model={selectedModelConfig}
					response={selectedModelResponse}
					onClose={() => setSelectedModelId(null)}
				/>
			)}
		</>
	);
};

export default React.memo(StatusMatrix);
