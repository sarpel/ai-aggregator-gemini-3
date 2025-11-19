import React from 'react';

interface CyberButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  loading?: boolean;
}

const CyberButton: React.FC<CyberButtonProps> = ({ 
  children, 
  className = '', 
  variant = 'primary', 
  loading = false,
  disabled,
  ...props 
}) => {
  const baseStyles = "relative px-6 py-2 font-mono font-bold uppercase tracking-wider transition-all duration-200 clip-path-polygon disabled:opacity-50 disabled:cursor-not-allowed group overflow-hidden";
  
  const variants = {
    primary: "bg-cyber-neon/10 text-cyber-neon border border-cyber-neon hover:bg-cyber-neon hover:text-black shadow-[0_0_10px_rgba(0,243,255,0.3)] hover:shadow-[0_0_20px_rgba(0,243,255,0.6)]",
    secondary: "bg-cyber-gray/50 text-gray-300 border border-gray-600 hover:border-cyber-pink hover:text-cyber-pink",
    danger: "bg-cyber-red/10 text-cyber-red border border-cyber-red hover:bg-cyber-red hover:text-black shadow-[0_0_10px_rgba(255,42,42,0.3)]",
    ghost: "text-gray-400 hover:text-cyber-neon"
  };

  return (
    <button 
      className={`${baseStyles} ${variants[variant]} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {/* Glitch overlay effect on hover */}
      <span className="absolute inset-0 bg-white/20 translate-x-[-100%] group-hover:animate-[glitch_0.3s_ease-in-out] hidden group-hover:block pointer-events-none"></span>
      
      {loading ? (
        <span className="flex items-center gap-2">
          <span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin"></span>
          SYNCING...
        </span>
      ) : children}
    </button>
  );
};

export default CyberButton;
