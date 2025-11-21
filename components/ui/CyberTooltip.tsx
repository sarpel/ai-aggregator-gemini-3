import React from 'react';

interface CyberTooltipProps {
  content: string | React.ReactNode;
  children: React.ReactNode;
  position?: 'top' | 'bottom' | 'left' | 'right';
  className?: string;
}

const CyberTooltip: React.FC<CyberTooltipProps> = ({ 
  content, 
  children, 
  position = 'top',
  className = ''
}) => {
  const posStyles = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2',
  };

  return (
    <div className={`group relative inline-flex ${className}`}>
      {children}
      <div className={`
        absolute ${posStyles[position]} z-[60]
        invisible group-hover:visible opacity-0 group-hover:opacity-100
        transition-all duration-200 ease-out translate-y-1 group-hover:translate-y-0
        px-3 py-1.5 min-w-max max-w-[200px]
        text-[10px] font-mono font-bold tracking-wide text-cyber-neon bg-black/95
        border border-cyber-gray shadow-[0_0_15px_rgba(0,243,255,0.15)]
        rounded-sm pointer-events-none whitespace-pre-wrap text-center
      `}>
        {content}
        {/* Decorative Corner Accents */}
        <div className="absolute top-0 left-0 w-1 h-1 border-t border-l border-cyber-neon/50"></div>
        <div className="absolute bottom-0 right-0 w-1 h-1 border-b border-r border-cyber-neon/50"></div>
      </div>
    </div>
  );
};

export default CyberTooltip;