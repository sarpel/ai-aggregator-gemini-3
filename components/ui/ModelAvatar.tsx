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
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full p-1">
    <path d="M12 2L14.1 8.9C14.5 10.2 15.5 11.2 16.9 11.6L22 12L16.9 12.4C15.5 12.8 14.5 13.8 14.1 15.1L12 22L9.9 15.1C9.5 13.8 8.5 12.8 7.1 12.4L2 12L7.1 11.6C8.5 11.2 9.5 10.2 9.9 8.9L12 2Z" fill={color} stroke={color} strokeWidth="0.5"/>
  </svg>
);

export const OpenAILogo = ({ color }: { color: string }) => (
  <svg viewBox="0 0 24 24" fill={color} xmlns="http://www.w3.org/2000/svg" className="w-full h-full p-1">
    <path d="M20.7 11.6c.2-1-.1-2.1-.8-3L16.4 3c-.8-1.3-2.4-1.8-3.9-1.1l-2 .8-2-.8c-1.4-.7-3.1-.2-3.9 1.1L1.1 8.6C.4 9.6.1 10.7.3 11.6s.9 1.9 1.9 2.5l.4.2-.4.2c-1 .6-1.7 1.5-1.9 2.5-.2 1 .1 2.1.8 3l3.5 5.6c.8 1.3 2.4 1.8 3.9 1.1l2-.8 2 .8c1.4.7 3.1.2 3.9-1.1l3.5-5.6c.7-1 1-2.1.8-3-.2-1-.9-1.9-1.9-2.5l-.4-.2.4-.2c1.1-.6 1.8-1.5 2-2.5ZM9.5 19l-2.7-4.4 6.9 4c-.4.2-.9.3-1.4.4H9.5Zm-4.1-1.6L7 12.1l-3.7.5c.1.6.4 1.1.8 1.7.4.5 1 1 1.3 1.1Zm6-14.8l2.7 4.4-6.9-4c.4-.2.9-.3 1.4-.4h2.8Zm4.1 1.6L14 9.9l3.7-.5c-.1-.6-.4-1.1-.8-1.7-.4-.5-1-1-1.4-1.1ZM10 10.9c0 .6.4 1 1 1s1-.4 1-1-.4-1-1-1-1 .4-1 1Zm7.3 4.3l-1-3.8c.5-.1 1.1.1 1.6.4l.7.4-1.3 3Zm-12.6-1l1 3.8c-.5.1-1.1-.1-1.6-.4l-.7-.4 1.3-3Z" />
  </svg>
);

export const AnthropicLogo = ({ color }: { color: string }) => (
  <svg viewBox="0 0 24 24" fill={color} xmlns="http://www.w3.org/2000/svg" className="w-full h-full p-1">
     <path d="M17.2 19.2H21L12 3.6 3 19.2h3.8l1.8-3.6h6.8l1.8 3.6zm-7.1-6.3L12 9.4l1.9 3.5h-3.8z"/>
  </svg>
);

export const GrokLogo = ({ color }: { color: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" xmlns="http://www.w3.org/2000/svg" className="w-full h-full p-1">
    <path d="M18 6L6 18M6 6l12 12" />
    <rect x="2" y="2" width="20" height="20" rx="4" strokeWidth="1.5" />
  </svg>
);

export const DeepSeekLogo = ({ color }: { color: string }) => (
  <svg viewBox="0 0 24 24" fill={color} xmlns="http://www.w3.org/2000/svg" className="w-full h-full p-1">
    <path d="M21.5 12c0 5.2-4.3 9.5-9.5 9.5S2.5 17.2 2.5 12 6.8 2.5 12 2.5c1.5 0 3 .3 4.3.9l-1.6 2.8C13.8 5.6 12.9 5.5 12 5.5c-3.6 0-6.5 2.9-6.5 6.5s2.9 6.5 6.5 6.5 6.5-2.9 6.5-6.5c0-.5-.1-1-.2-1.5l2.9-1c.2.8.3 1.6.3 2.5z" />
    <circle cx="15" cy="9" r="1.5" />
  </svg>
);

export const ModelLogo = ({ providerId, color, mini }: { providerId?: string, color: string, mini?: boolean }) => {
    const size = mini ? 20 : 24;
    switch (providerId) {
      case 'GEMINI': return <GeminiLogo color={color} />;
      case 'OPENAI': return <OpenAILogo color={color} />;
      case 'ANTHROPIC': return <AnthropicLogo color={color} />;
      case 'GROK': return <GrokLogo color={color} />;
      case 'DEEPSEEK': return <DeepSeekLogo color={color} />;
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