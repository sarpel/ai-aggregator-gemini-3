import React from 'react';
import { ModelStatus } from '../../types';
import { Wifi, WifiOff, Activity, CheckCircle, AlertTriangle, Cpu } from 'lucide-react';

interface ModelAvatarProps {
  providerId?: string;
  name: string;
  color: string;
  status: ModelStatus;
  mini?: boolean;
  progress?: number;
}

// --- Brand SVGs ---

export const GeminiLogo = ({ color }: { color: string }) => (
  <svg viewBox="0 0 24 24" fill={color} xmlns="http://www.w3.org/2000/svg" className="w-full h-full p-1">
    <path d="M11.04 19.32Q12 21.51 12 24q0-2.49.93-4.68.96-2.19 2.58-3.81t3.81-2.55Q21.51 12 24 12q-2.49 0-4.68-.93a12.3 12.3 0 0 1-3.81-2.58 12.3 12.3 0 0 1-2.58-3.81Q12 2.49 12 0q0 2.49-.96 4.68-.93 2.19-2.55 3.81a12.3 12.3 0 0 1-3.81 2.58Q2.49 12 0 12q2.49 0 4.68.96 2.19.93 3.81 2.55t2.55 3.81" />
  </svg>
);

export const OpenAILogo = ({ color }: { color: string }) => (
  <svg viewBox="0 0 24 24" fill={color} xmlns="http://www.w3.org/2000/svg" className="w-full h-full p-1">
    <path d="M20.7 11.6c.2-1-.1-2.1-.8-3L16.4 3c-.8-1.3-2.4-1.8-3.9-1.1l-2 .8-2-.8c-1.4-.7-3.1-.2-3.9 1.1L1.1 8.6C.4 9.6.1 10.7.3 11.6s.9 1.9 1.9 2.5l.4.2-.4.2c-1 .6-1.7 1.5-1.9 2.5-.2 1 .1 2.1.8 3l3.5 5.6c.8 1.3 2.4 1.8 3.9 1.1l2-.8 2 .8c1.4.7 3.1.2 3.9-1.1l3.5-5.6c.7-1 1-2.1.8-3-.2-1-.9-1.9-1.9-2.5l-.4-.2.4-.2c1.1-.6 1.8-1.5 2-2.5ZM9.5 19l-2.7-4.4 6.9 4c-.4.2-.9.3-1.4.4H9.5Zm-4.1-1.6L7 12.1l-3.7.5c.1.6.4 1.1.8 1.7.4.5 1 1 1.3 1.1Zm6-14.8l2.7 4.4-6.9-4c.4-.2.9-.3 1.4-.4h2.8Zm4.1 1.6L14 9.9l3.7-.5c-.1-.6-.4-1.1-.8-1.7-.4-.5-1-1-1.4-1.1ZM10 10.9c0 .6.4 1 1 1s1-.4 1-1-.4-1-1-1-1 .4-1 1Zm7.3 4.3l-1-3.8c.5-.1 1.1.1 1.6.4l.7.4-1.3 3Zm-12.6-1l1 3.8c-.5.1-1.1-.1-1.6-.4l-.7-.4 1.3-3Z" />
  </svg>
);

export const AnthropicLogo = ({ color }: { color: string }) => (
  <svg viewBox="0 0 24 24" fill={color} xmlns="http://www.w3.org/2000/svg" className="w-full h-full p-1">
    <path d="M17.3041 3.541h-3.6718l6.696 16.918H24Zm-10.6082 0L0 20.459h3.7442l1.3693-3.5527h7.0052l1.3693 3.5528h3.7442L10.5363 3.5409Zm-.3712 10.2232 2.2914-5.9456 2.2914 5.9456Z" />
  </svg>
);

export const ZaiLogo = ({ color }: { color: string }) => (
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full p-1">
    <rect x="2" y="2" width="20" height="20" rx="4" stroke={color} strokeWidth="1.5" />
    <path d="M8 7h8l-6 10h6" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const KimiLogo = ({ color }: { color: string }) => (
  <svg viewBox="0 0 24 24" fill={color} xmlns="http://www.w3.org/2000/svg" className="w-full h-full p-1">
    <path d="M12 2C9.5 2 7.5 6.5 7.5 12s2 10 4.5 10c1.2 0 2.3-1.1 3.1-2.9C14.7 20.3 14 18.3 14 12c0-6.3-.7-8.3-1.1-9.1C14.3 2.9 13.2 2 12 2z" opacity="0.6" />
    <path d="M12 2c1.8 0 3.4 2.5 4.2 6.2C14.6 6.4 13.4 5.5 12 5.5S9.4 6.4 7.8 8.2C8.6 4.5 10.2 2 12 2z" />
    <path d="M16.2 8.2c.5 2.2.8 4.8.8 7.8 0 1.3-.1 2.5-.2 3.6C15.6 16.9 14 12.9 14 12c0-3.6 1.2-5.5 2.2-3.8z" opacity="0.3" />
    <circle cx="16" cy="8" r="2" />
  </svg>
);

export const ModelLogo = ({ providerId, color, mini }: { providerId?: string, color: string, mini?: boolean }) => {
    const size = mini ? 20 : 24;
    switch (providerId) {
      case 'GEMINI': return <GeminiLogo color={color} />;
      case 'OPENAI': return <OpenAILogo color={color} />;
      case 'ANTHROPIC': return <AnthropicLogo color={color} />;
      case 'ZAI': return <ZaiLogo color={color} />;
      case 'KIMI': return <KimiLogo color={color} />;
      default: return <Cpu size={size} style={{ color }} />;
    }
};

// -----------------

const ModelAvatar: React.FC<ModelAvatarProps> = ({ providerId, name, color, status, mini = false, progress = 0 }) => {
  const getStatusIcon = () => {
    switch (status) {
      case ModelStatus.CONNECTING: return <Wifi className="animate-pulse text-current" size={12} />;
      case ModelStatus.STREAMING: return <Activity className="animate-bounce text-current" size={12} />;
      case ModelStatus.COMPLETED: return <CheckCircle className="text-green-500" size={12} />;
      case ModelStatus.ERROR: return <AlertTriangle className="text-red-500" size={12} />;
      case ModelStatus.TIMEOUT: return <WifiOff className="text-red-500" size={12} />;
      default: return null;
    }
  };

  const sizeClass = mini ? 'w-10 h-10' : 'w-14 h-14';
  const glowStyle = status === ModelStatus.STREAMING
    ? { boxShadow: `0 0 15px ${color}` }
    : { borderColor: status === ModelStatus.IDLE ? '#333' : color };

  const isStreaming = status === ModelStatus.STREAMING;

  // Dimensions for the progress ring (SVG)
  const ringRadius = mini ? 28 : 38;
  const ringCircumference = 2 * Math.PI * ringRadius;
  const progressOffset = ringCircumference - ((progress || 0) / 100) * ringCircumference;

  return (
    <div className="relative inline-flex items-center justify-center">
      {/* Streaming Progress & Activity Ring */}
      {isStreaming && (
        <div className="absolute inset-0 flex items-center justify-center z-0 pointer-events-none">
            <svg
              width={mini ? 80 : 100}
              height={mini ? 80 : 100}
              viewBox="0 0 100 100"
              className="overflow-visible -rotate-90"
            >
              <circle
                cx="50" cy="50" r={ringRadius - 5}
                stroke={color} strokeWidth="1" fill="none" strokeOpacity="0.3"
                strokeDasharray="4 6"
                className="animate-[spin_4s_linear_infinite] origin-center"
              />
              <circle
                cx="50" cy="50" r={ringRadius}
                stroke={color} strokeWidth="1.5" fill="none" strokeOpacity="0.1"
              />
              <circle
                cx="50" cy="50" r={ringRadius}
                stroke={color} strokeWidth="2" fill="none"
                style={{
                  strokeDasharray: ringCircumference,
                  strokeDashoffset: progressOffset
                }}
                strokeLinecap="round"
                className="transition-[stroke-dashoffset] duration-300 ease-out drop-shadow-[0_0_3px_rgba(0,243,255,0.5)]"
              />
            </svg>
        </div>
      )}

      <div
        className={`${sizeClass} rounded-sm border-2 bg-black flex items-center justify-center transition-all duration-300 relative overflow-hidden z-10`}
        style={glowStyle}
      >
        {/* Brand Logo */}
        <div className="w-3/4 h-3/4 flex items-center justify-center opacity-90 z-10">
          <ModelLogo providerId={providerId} color={color} mini={mini} />
        </div>

        {/* Background Pulse for Active State */}
        {status === ModelStatus.STREAMING && (
             <div className="absolute inset-0 bg-current opacity-10 animate-pulse" style={{ color }}></div>
        )}
      </div>

      {/* Status Indicator Overlay */}
      {status !== ModelStatus.IDLE && (
        <div
            className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full border border-black bg-black flex items-center justify-center z-20 shadow-sm`}
        >
            {getStatusIcon()}
        </div>
      )}
    </div>
  );
};

export default ModelAvatar;
