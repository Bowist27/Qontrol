/**
 * Button Component
 * Reusable button with loading state and variants
 */

import React from 'react';

interface ButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  type?: 'button' | 'submit' | 'reset';
  variant?: 'primary' | 'secondary' | 'outline';
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  icon?: React.ReactNode;
}

const variantStyles = {
  primary: 'bg-gradient-to-br from-[#009fdb] to-[#0077a8] text-white shadow-[0_4px_14px_rgba(0,159,219,0.35)] hover:-translate-y-0.5 hover:shadow-[0_6px_20px_rgba(0,159,219,0.35)]',
  secondary: 'bg-slate-700 text-white hover:bg-slate-600',
  outline: 'bg-transparent border-2 border-[#009fdb] text-[#009fdb] hover:bg-[#009fdb]/10'
};

const Button: React.FC<ButtonProps> = ({
  children,
  onClick,
  type = 'button',
  variant = 'primary',
  loading = false,
  disabled = false,
  fullWidth = false,
  icon
}) => {
  return (
    <button
      type={type}
      className={`
        inline-flex items-center justify-center gap-2 
        py-4 px-8 mt-2
        text-[0.95rem] font-semibold
        border-none rounded-xl cursor-pointer
        transition-all duration-250 ease-out
        disabled:opacity-60 disabled:cursor-not-allowed disabled:transform-none
        active:translate-y-0
        ${variantStyles[variant]}
        ${fullWidth ? 'w-full' : ''}
      `}
      onClick={onClick}
      disabled={disabled || loading}
    >
      {loading ? (
        <span className="w-[18px] h-[18px] border-2 border-white/30 border-t-white rounded-full animate-spin" />
      ) : (
        <>
          {children}
          {icon && <span className="btn-icon">{icon}</span>}
        </>
      )}
    </button>
  );
};

export default Button;
