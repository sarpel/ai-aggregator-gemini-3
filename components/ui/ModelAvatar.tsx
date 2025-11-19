import React from 'react';
import { ModelStatus } from '../../types';
import { Cpu, Wifi, WifiOff, Activity, CheckCircle, AlertTriangle } from 'lucide-react';

interface ModelAvatarProps {
  name: string;
  color: string;
  status: ModelStatus;
  mini?: boolean;
}

const ModelAvatar: React.FC<ModelAvatarProps> = ({ name, color, status, mini = false }) => {
  const getStatusIcon = () => {
    switch (status) {
      case ModelStatus.CONNECTING: return <Wifi className="animate-pulse" size={16} />;
      case ModelStatus.STREAMING: return <Activity className="animate-bounce" size={16} />;
      case ModelStatus.COMPLETED: return <CheckCircle size={16} />;
      case ModelStatus.ERROR: return <AlertTriangle size={16} />;
      case ModelStatus.TIMEOUT: return <WifiOff size={16} />;
      default: return <Cpu size={16} />;
    }
  };

  const sizeClass = mini ? 'w-8 h-8' : 'w-12 h-12';
  const glowStyle = status === ModelStatus.STREAMING 
    ? { boxShadow: `0 0 15px ${color}` } 
    : { borderColor: status === ModelStatus.IDLE ? '#333' : color };

  return (
    <div className="relative">
      <div 
        className={`${sizeClass} rounded-sm border-2 bg-black flex items-center justify-center transition-all duration-300`}
        style={glowStyle}
      >
        <div style={{ color: status === ModelStatus.IDLE ? '#666' : color }}>
          {getStatusIcon()}
        </div>
      </div>
      {/* Status Dot */}
      <div 
        className={`absolute -bottom-1 -right-1 w-3 h-3 rounded-full border border-black ${
          status === ModelStatus.STREAMING ? 'bg-cyber-neon animate-ping' : 
          status === ModelStatus.ERROR ? 'bg-cyber-red' :
          status === ModelStatus.COMPLETED ? 'bg-green-500' : 'bg-gray-600'
        }`}
      />
    </div>
  );
};

export default ModelAvatar;
