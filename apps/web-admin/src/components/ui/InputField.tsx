/**
 * InputField Component
 * Reusable input with label and icon
 */

import React from 'react';

interface InputFieldProps {
  type?: 'text' | 'email' | 'password' | 'number' | 'tel';
  label?: string;
  placeholder?: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  icon?: React.ReactNode;
  id: string;
  required?: boolean;
  autoComplete?: string;
  disabled?: boolean;
}

const InputField: React.FC<InputFieldProps> = ({
  type = 'text',
  label,
  placeholder,
  value,
  onChange,
  icon,
  id,
  required = false,
  autoComplete,
  disabled = false
}) => {
  return (
    <div className="flex flex-col gap-2">
      {label && (
        <label
          className="text-[0.8rem] font-medium text-slate-400 uppercase tracking-wide"
          htmlFor={id}
        >
          {label}
        </label>
      )}
      <div className="relative flex items-center group">
        <input
          type={type}
          id={id}
          className="
            w-full py-4 pr-6 pl-11
            border border-slate-700 rounded-xl
            text-[0.95rem] font-sans
            bg-slate-800 text-white
            placeholder:text-slate-500
            transition-all duration-250 ease-out
            hover:border-slate-600
            focus:outline-none focus:border-[#009fdb] focus:bg-[rgba(0,159,219,0.05)]
            disabled:opacity-50 disabled:cursor-not-allowed
          "
          placeholder={placeholder}
          value={value}
          onChange={onChange}
          required={required}
          autoComplete={autoComplete}
          disabled={disabled}
        />
        {icon && (
          <span className="absolute left-4 w-[18px] h-[18px] text-slate-500 pointer-events-none transition-colors duration-150 group-focus-within:text-[#009fdb]">
            {icon}
          </span>
        )}
      </div>
    </div>
  );
};

export default InputField;
