
import React from 'react';

export const Button: React.FC<{
  onClick?: () => void;
  type?: 'button' | 'submit';
  variant?: 'primary' | 'outline' | 'danger';
  className?: string;
  children: React.ReactNode;
  disabled?: boolean;
}> = ({ onClick, type = 'button', variant = 'primary', className = '', children, disabled }) => {
  const base = "font-manrope font-extrabold uppercase text-sm tracking-widest px-8 py-4 rounded-2xl transition-all duration-300 active:scale-95 flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed";
  const variants = {
    primary: "bg-primary text-white hover:brightness-95 shadow-lg shadow-primary/20",
    outline: "border-2 border-primary text-primary hover:bg-primary-light",
    danger: "bg-red-500 text-white hover:bg-red-600 shadow-lg shadow-red-500/20"
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

export const Card: React.FC<{ children: React.ReactNode, className?: string, onClick?: () => void }> = ({ children, className = "", onClick }) => (
  <div onClick={onClick} className={`card p-8 ${className}`}>
    {children}
  </div>
);

export const Input: React.FC<React.InputHTMLAttributes<HTMLInputElement> & { label?: string }> = ({ label, ...props }) => (
  <div className="flex flex-col gap-2.5 w-full text-left">
    {label && <label className="text-sm uppercase font-black tracking-widest text-primary/80 ml-1">{label}</label>}
    <input 
      {...props} 
      className={`bg-surface border-2 border-border-light rounded-2xl px-5 py-4 text-lg text-text-primary focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all placeholder:text-text-secondary/40 disabled:bg-background disabled:text-text-secondary ${props.className || ''}`}
    />
  </div>
);

export const CurrencyInput: React.FC<{
  label?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  autoFocus?: boolean;
}> = ({ label, value, onChange, placeholder, className, autoFocus }) => {
  
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let rawValue = e.target.value.replace(/\D/g, "");
    if (!rawValue) {
      onChange("");
      return;
    }
    
    const options = { style: 'currency', currency: 'BRL' };
    const formattedValue = (Number(rawValue) / 100).toLocaleString('pt-BR', options);
    onChange(formattedValue);
  };

  return (
    <div className="flex flex-col gap-2.5 w-full text-left">
      {label && <label className="text-sm uppercase font-black tracking-widest text-primary/80 ml-1">{label}</label>}
      <input 
        type="text"
        value={value}
        onChange={handleInputChange}
        placeholder={placeholder || "R$ 0,00"}
        autoFocus={autoFocus}
        className={`bg-surface border-2 border-border-light rounded-2xl px-5 py-4 text-xl font-bold text-text-primary focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all placeholder:text-text-secondary/40 ${className || ''}`}
      />
    </div>
  );
};

export const Modal: React.FC<{ isOpen: boolean, onClose: () => void, title?: string, children: React.ReactNode, size?: 'default' | 'large' }> = ({ isOpen, onClose, title, children, size = 'default' }) => {
  if (!isOpen) return null;
  const sizeClass = size === 'large' ? 'max-w-7xl' : 'max-w-2xl';
  return (
    <div className="fixed inset-0 z-[2000] flex items-start sm:items-center justify-center p-4 sm:p-6 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300 overflow-y-auto pt-12 sm:pt-6">
      <div className={`card bg-surface w-full ${sizeClass} p-6 sm:p-10 max-h-[90vh] sm:max-h-[85vh] overflow-y-auto relative animate-in zoom-in-95 duration-300 border-2 border-primary/30 shadow-2xl`}>
        <button onClick={onClose} className="absolute top-4 right-4 sm:top-6 sm:right-6 text-text-secondary hover:text-text-primary transition-colors p-2">
          <i className="fas fa-times text-xl sm:text-2xl"></i>
        </button>
        {title && <h2 className="text-xl sm:text-3xl font-black mb-6 sm:mb-8 text-primary border-b border-border-light pb-4 sm:pb-5 uppercase tracking-tighter">{title}</h2>}
        {children}
      </div>
    </div>
  );
};
