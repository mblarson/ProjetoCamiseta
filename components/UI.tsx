
import React from 'react';

export const Button: React.FC<{
  onClick?: () => void;
  type?: 'button' | 'submit';
  variant?: 'primary' | 'outline' | 'danger';
  className?: string;
  children: React.ReactNode;
  disabled?: boolean;
}> = ({ onClick, type = 'button', variant = 'primary', className = '', children, disabled }) => {
  const base = "font-manrope font-bold uppercase text-xs tracking-widest px-8 py-3 rounded-full transition-all duration-300 active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed";
  const variants = {
    primary: "bg-primary text-[#0A192F] hover:brightness-95",
    outline: "border border-primary text-primary hover:bg-primary-light",
    danger: "bg-red-500 text-white hover:bg-red-600"
  };
  
  return (
    <button 
      type={type} 
      onClick={onClick} 
      className={`${base} ${variants[variant]} ${className}`}
      disabled={disabled}
    >
      {children}
    </button>
  );
};

export const Card: React.FC<{ children: React.ReactNode, className?: string }> = ({ children, className = "" }) => (
  <div className={`card p-6 ${className}`}>
    {children}
  </div>
);

export const Input: React.FC<React.InputHTMLAttributes<HTMLInputElement> & { label?: string }> = ({ label, ...props }) => (
  <div className="flex flex-col gap-2 w-full text-left">
    {label && <label className="text-[10px] uppercase font-black tracking-widest text-primary/70">{label}</label>}
    <input 
      {...props} 
      className={`bg-background border border-border-light rounded-xl px-4 py-3 text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/40 transition-colors placeholder:text-text-secondary/60 ${props.className || ''}`}
    />
  </div>
);

export const Modal: React.FC<{ isOpen: boolean, onClose: () => void, title: string, children: React.ReactNode }> = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="card w-full max-w-xl p-8 max-h-[90vh] overflow-y-auto relative animate-in zoom-in-95 duration-300">
        <button onClick={onClose} className="absolute top-6 right-6 text-text-secondary hover:text-text-primary transition-colors">
          <i className="fas fa-times text-xl"></i>
        </button>
        <h2 className="text-2xl font-black mb-6 text-primary border-b border-border-light pb-4 uppercase tracking-tighter">{title}</h2>
        {children}
      </div>
    </div>
  );
};