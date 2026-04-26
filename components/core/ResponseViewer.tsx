import { Check, Copy, Cpu, Layers, RotateCcw, Settings } from "lucide-react";
import React, { useCallback, useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { DEFAULT_MODELS } from "../../config";
import {
	type AppAction,
	type ConsensusResult,
	ConsensusStatus,
	type ModelConfig,
	type ModelResponse,
	ModelStatus,
	type SynthesizerConfig,
} from "../../types";
import CyberTooltip from "../ui/CyberTooltip";
import { ModelLogo } from "../ui/ModelAvatar";
import SynthesizerSettings from "./SynthesizerSettings";

interface ResponseViewerProps {
	responses: Record<string, ModelResponse>;
	consensus: ConsensusResult;
	activeModels: string[];
	synthesizerConfig: SynthesizerConfig;
	dispatch: React.Dispatch<AppAction>;
	onRetry: (providerId: string) => void;
	modelConfigs?: ModelConfig[];
}

const ResponseViewer: React.FC<ResponseViewerProps> = ({
	responses,
	consensus,
	activeModels,
	synthesizerConfig,
	dispatch,
	onRetry,
	modelConfigs,
}) => {
	const [selectedTab, setSelectedTab] = useState<"CONSENSUS" | string>(
		"CONSENSUS",
	);
	const [copiedState, setCopiedState] = useState<string | null>(null);
	const [showSettings, setShowSettings] = useState(false);
	const scrollContainerRef = useRef<HTMLDivElement>(null);

	const modelsToRender = modelConfigs ?? DEFAULT_MODELS;
	const activeModelList = modelsToRender.filter((m) =>
		activeModels.includes(m.id),
	);

	// Auto-scroll: throttled to fire at most every 200ms to prevent jank during streaming.
	// Uses 'auto' behavior during streaming, 'smooth' on manual tab switch.
	const lastScrollTimeRef = useRef(0);
	const selectedResponse =
		selectedTab === "CONSENSUS" ? null : responses[selectedTab];
	const isStreamingCurrentTab =
		selectedTab === "CONSENSUS"
			? false // consensus has its own streaming indicator
			: selectedResponse?.status === ModelStatus.STREAMING;
	const currentContent =
		selectedTab === "CONSENSUS" ? consensus.text : selectedResponse?.text || "";

	useEffect(() => {
		if (!scrollContainerRef.current) return;
		const contentLength = currentContent.length;
		if (contentLength === 0) return;
		const now = Date.now();
		const THROTTLE_MS = 200;
		if (now - lastScrollTimeRef.current < THROTTLE_MS) return;
		lastScrollTimeRef.current = now;

		const { scrollHeight, clientHeight } = scrollContainerRef.current;
		scrollContainerRef.current.scrollTo({
			top: scrollHeight - clientHeight,
			behavior: isStreamingCurrentTab ? "auto" : "smooth",
		});
	}, [currentContent, isStreamingCurrentTab]);

	const handleCopy = async (text?: string) => {
		if (!text) return;
		try {
			if (navigator.clipboard?.writeText) {
				await navigator.clipboard.writeText(text);
			} else {
				const textArea = document.createElement("textarea");
				let success = false;
				try {
					textArea.value = text;
					textArea.setAttribute("readonly", "true");
					textArea.style.position = "fixed";
					textArea.style.left = "-9999px";
					document.body.appendChild(textArea);
					textArea.select();
					success = document.execCommand("copy");
				} finally {
					textArea.remove();
				}
				if (!success) return;
			}
			setCopiedState(selectedTab);
			setTimeout(() => setCopiedState(null), 2000);
		} catch (err) {
			console.error("Failed to copy text:", err);
		}
	};

	// Debounced markdown content: during streaming, only re-render markdown every 150ms
	// to avoid quadratic ReactMarkdown parse cost on each streaming chunk.
	const [debouncedContent, setDebouncedContent] = useState<string>("");
	useEffect(() => {
		const timer = setTimeout(() => {
			setDebouncedContent(currentContent);
		}, 150);
		return () => clearTimeout(timer);
	}, [currentContent]);

	const renderContent = useCallback((content: string, streaming = false) => {
		if (!content)
			return (
				<div className="text-gray-600 italic font-mono">
					Initialized. Awaiting data stream...
				</div>
			);

		if (streaming) {
			return (
				<pre className="whitespace-pre-wrap break-words text-sm font-mono text-gray-200 leading-relaxed max-w-full overflow-x-hidden">
					{content}
				</pre>
			);
		}

		return (
			<div className="prose prose-invert max-w-none prose-p:text-sm prose-p:leading-7 prose-p:break-words prose-li:break-words prose-pre:bg-black prose-pre:border prose-pre:border-cyber-gray prose-pre:whitespace-pre-wrap prose-pre:break-words prose-code:break-words overflow-x-hidden">
				<ReactMarkdown>{content}</ReactMarkdown>
			</div>
		);
	}, []);

	const textToCopy =
		selectedTab === "CONSENSUS" ? consensus.text : selectedResponse?.text;
	const isCopySuccess = copiedState === selectedTab;

	return (
		<>
			<div className="flex flex-col h-full border border-cyber-gray bg-black/50 backdrop-blur-sm rounded-sm shadow-2xl overflow-hidden relative">
				{/* Tabs Header */}
				<div className="flex overflow-x-auto border-b border-cyber-gray bg-black/80 no-scrollbar pr-16">
					<CyberTooltip
						content="View Neural Synthesis Result"
						position="bottom"
					>
						<button
							type="button"
							onClick={() => setSelectedTab("CONSENSUS")}
							className={`flex items-center gap-2 px-4 py-3 font-mono text-xs font-bold uppercase transition-colors whitespace-nowrap border-r border-cyber-gray ${
								selectedTab === "CONSENSUS"
									? "bg-cyber-neon/10 text-cyber-neon border-b-2 border-b-cyber-neon"
									: "text-gray-500 hover:text-gray-300"
							}`}
						>
							<Layers size={14} />
							Consensus
						</button>
					</CyberTooltip>

					{activeModelList.map((model) => {
						const resp = responses[model.id];
						const isStreaming = resp?.status === ModelStatus.STREAMING;
						return (
							<CyberTooltip
								key={model.id}
								content={`View ${model.name} Response`}
								position="bottom"
							>
								<button
									type="button"
									onClick={() => setSelectedTab(model.id)}
									className={`flex items-center gap-2 px-4 py-3 font-mono text-xs font-bold uppercase transition-colors whitespace-nowrap border-r border-cyber-gray relative ${
										selectedTab === model.id
											? "bg-cyber-gray/30 text-white border-b-2"
											: "text-gray-500 hover:text-gray-300"
									}`}
									style={{
										borderBottomColor:
											selectedTab === model.id
												? model.avatarColor
												: "transparent",
									}}
								>
									<div className="w-4 h-4">
										<ModelLogo
											providerId={model.id}
											color={isStreaming ? "#fff" : model.avatarColor}
											mini
										/>
									</div>
									{model.name}
									{isStreaming && (
										<span className="w-1.5 h-1.5 bg-cyber-neon rounded-full animate-pulse ml-1"></span>
									)}
								</button>
							</CyberTooltip>
						);
					})}
				</div>

				{/* Floating Copy Button (Top Right) */}
				<div className="absolute top-2 right-2 z-30">
					<CyberTooltip
						content={isCopySuccess ? "Copied!" : "Copy response to clipboard"}
						position="left"
					>
						<button
							type="button"
							onClick={() => handleCopy(textToCopy)}
							disabled={!textToCopy}
							aria-label={isCopySuccess ? "Response copied" : "Copy selected response"}
							className={`
                flex items-center justify-center w-8 h-8 rounded border transition-all duration-300
                ${
									isCopySuccess
										? "bg-green-500/20 border-green-500 text-green-500"
										: "bg-black/80 border-cyber-gray text-gray-400 hover:border-cyber-neon hover:text-cyber-neon hover:shadow-[0_0_10px_rgba(0,243,255,0.2)]"
								}
              `}
						>
							<div
								className={`transition-all duration-300 transform ${isCopySuccess ? "scale-110" : "scale-100"}`}
							>
								{isCopySuccess ? <Check size={16} /> : <Copy size={14} />}
							</div>
						</button>
					</CyberTooltip>
				</div>

				{/* Content Area */}
				<div
					ref={scrollContainerRef}
					className="flex-1 overflow-y-auto overflow-x-hidden p-4 md:p-6 bg-[url('/textures/carbon-fibre.png')] relative scroll-smooth"
				>
					{selectedTab === "CONSENSUS" ? (
						<div className="animate-fadeIn">
							<div className="flex items-center justify-between mb-4">
								<div className="flex items-center gap-3">
									<h3 className="text-cyber-neon font-mono text-lg tracking-widest flex items-center gap-2">
										<Layers className="text-cyber-pink" />
										NEURAL SYNTHESIS
									</h3>
									<CyberTooltip
										content="Configure Neural Core / Persona"
										position="right"
									>
										<button
											type="button"
											onClick={() => setShowSettings(true)}
											className="p-1.5 text-gray-500 hover:text-cyber-neon hover:bg-cyber-neon/10 rounded border border-transparent hover:border-cyber-neon transition-all"
										>
											<Settings size={14} />
										</button>
									</CyberTooltip>
								</div>

								{consensus.text && (
									<CyberTooltip
										content="Confidence score based on model agreement analysis"
										position="left"
									>
										<span className="text-xs font-mono text-cyber-yellow bg-cyber-yellow/10 px-2 py-1 rounded border border-cyber-yellow/30 cursor-help">
											CONFIDENCE: {(consensus.confidence * 100).toFixed(0)}%
										</span>
									</CyberTooltip>
								)}
							</div>
							<div className="bg-black/60 border border-cyber-neon/30 p-4 md:p-6 rounded shadow-[0_0_30px_rgba(0,243,255,0.05)] min-h-[200px] max-w-full overflow-x-hidden">
								{debouncedContent ? (
									renderContent(debouncedContent, consensus.status === ConsensusStatus.SYNTHESIZING)
								) : (
									<div className="flex flex-col items-center justify-center h-32 opacity-50">
										<Cpu
											className="animate-pulse text-cyber-gray mb-2"
											size={48}
										/>
										<span className="font-mono text-xs tracking-widest text-gray-500">
											AWAITING INPUT STREAMS...
										</span>
									</div>
								)}
							</div>

							{/* Contributors Graph (Simple Text Bar) */}
							{consensus.contributors.length > 0 && (
								<div className="mt-6">
									<h4 className="text-xs font-mono text-gray-500 uppercase mb-2">
										Contribution Vectors
									</h4>
									<div className="flex h-2 rounded-full overflow-hidden bg-gray-800">
										{consensus.contributors.map((c) => {
											const model = modelsToRender.find(
												(m) => m.id === c.provider,
											);
											return (
												<CyberTooltip
													key={c.provider}
													content={`${model?.name}: ${(c.weight * 100).toFixed(0)}%`}
													position="top"
												>
													<div
														style={{
															width: `${c.weight * 100}%`,
															backgroundColor: model?.avatarColor || "#555",
														}}
													/>
												</CyberTooltip>
											);
										})}
									</div>
								</div>
							)}
						</div>
					) : (
						<div className="animate-fadeIn">
							{(() => {
								const model = modelsToRender.find((m) => m.id === selectedTab);
								const resp = selectedResponse;

								if (!model || !resp) return null;

								return (
									<>
										<div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-4">
											<div className="flex items-center gap-3">
												<div className="w-8 h-8 flex items-center justify-center bg-black border border-cyber-gray rounded">
													<ModelLogo
														providerId={model.id}
														color={model.avatarColor}
														mini
													/>
												</div>
												<div>
													<h3 className="font-bold text-white break-words">{model.name}</h3>
													<p className="text-xs font-mono text-gray-400 flex flex-wrap items-center gap-x-2 gap-y-1">
														<span
															className={
																resp.status === ModelStatus.ERROR ||
																resp.status === ModelStatus.TIMEOUT
																	? "text-red-500"
																	: "text-green-500"
															}
														>
															{resp.status}
														</span>
														<span className="text-gray-600">|</span>
														<span
															className="text-cyber-neon/80"
															title="Response Latency"
														>
															{(resp.latency / 1000).toFixed(2)}s
														</span>
														{resp.tokenCount && (
															<>
																<span className="text-gray-600">|</span>
																<span
																	className="text-cyber-pink/80"
																	title="Estimated Token Count"
																>
																	~{resp.tokenCount} TOKENS
																</span>
															</>
														)}
													</p>
												</div>
											</div>
											<div className="flex items-center gap-2">
												<CyberTooltip
													content="Retry this model"
													position="left"
												>
													<button
														type="button"
														onClick={() => onRetry(model.id)}
														disabled={
															resp.status === ModelStatus.STREAMING ||
															resp.status === ModelStatus.CONNECTING
														}
														className="p-1.5 text-gray-500 hover:text-cyber-neon hover:bg-cyber-neon/10 rounded border border-transparent hover:border-cyber-neon transition-all disabled:opacity-30 disabled:cursor-not-allowed"
													>
														<RotateCcw size={14} />
													</button>
												</CyberTooltip>
												<CyberTooltip
													content="Copy this response"
													position="left"
												>
													<button
														type="button"
														onClick={() => handleCopy(resp.text)}
														disabled={!resp.text}
														aria-label={isCopySuccess ? "Response copied" : `Copy ${model.name} response`}
														className="p-1.5 text-gray-500 hover:text-cyber-neon hover:bg-cyber-neon/10 rounded border border-transparent hover:border-cyber-neon transition-all disabled:opacity-30"
													>
														{isCopySuccess ? <Check size={14} /> : <Copy size={14} />}
													</button>
												</CyberTooltip>
											</div>
										</div>

										<div
											className={`p-4 rounded border border-gray-800 bg-black/40 min-h-[200px] max-w-full overflow-x-hidden ${resp.status === ModelStatus.STREAMING ? "border-b-cyber-neon/50" : ""}`}
										>
											{resp.error ? (
												<div className="text-red-400 font-mono flex items-start gap-2 whitespace-pre-wrap break-words">
													<span className="text-xl shrink-0">⚠</span>
													<span className="min-w-0">{resp.error}</span>
												</div>
											) : (
												renderContent(debouncedContent, isStreamingCurrentTab)
											)}
											{resp.status === ModelStatus.STREAMING && (
												<span className="inline-block w-2 h-4 ml-1 bg-cyber-neon animate-pulse align-middle" />
											)}
										</div>
									</>
								);
							})()}
						</div>
					)}
				</div>
			</div>
			{showSettings && (
				<SynthesizerSettings
					config={synthesizerConfig}
					dispatch={dispatch}
					onClose={() => setShowSettings(false)}
					modelConfigs={modelsToRender}
				/>
			)}
		</>
	);
};

export default React.memo(ResponseViewer);
