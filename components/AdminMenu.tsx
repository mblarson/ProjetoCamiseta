
import React, { useState, useEffect, useRef } from 'react';
import { AdminTab } from '../types';

interface AdminMenuProps {
  activeTab: AdminTab;
  onSelectTab: (tab: AdminTab) => void;
}

const tabIcons: Record<AdminTab, string> = {
  [AdminTab.Dashboard]: 'fa-tachometer-alt',
  [AdminTab.Orders]: 'fa-clipboard-list',
  [AdminTab.Payments]: 'fa-money-bill-wave',
  [AdminTab.Confirmation]: 'fa-check-double',
  [AdminTab.Statistics]: 'fa-chart-pie',
  [AdminTab.Event]: 'fa-calendar-alt',
};

export const AdminMenu: React.FC<AdminMenuProps> = ({ activeTab, onSelectTab }) => {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleSelect = (tab: AdminTab) => {
    onSelectTab(tab);
    setIsOpen(false);
  };

  return (
    <div className="relative w-full md:w-64" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full h-14 flex items-center justify-between sm:justify-between px-6 bg-white border border-border-light rounded-2xl text-text-primary font-black uppercase tracking-widest text-[10px] transition-all hover:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/30 shadow-sm relative"
      >
        <div className="flex items-center gap-3 w-full justify-center sm:justify-start">
            <i className={`fas ${tabIcons[activeTab]} text-primary absolute left-6 sm:static`}></i>
            <span className="text-center sm:text-left">{activeTab}</span>
        </div>
        <i className={`fas fa-chevron-down transition-transform duration-300 absolute right-6 sm:static ${isOpen ? 'rotate-180' : ''}`}></i>
      </button>

      {isOpen && (
        <div className="absolute top-full mt-2 w-full bg-white border border-border-light rounded-2xl shadow-2xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-4 duration-300">
          <ul className="divide-y divide-border-light/40">
            {Object.values(AdminTab).map(tab => (
              <li key={tab}>
                <button
                  onClick={() => handleSelect(tab)}
                  className={`w-full flex items-center justify-center gap-4 px-4 py-4 text-center text-[10px] font-bold uppercase tracking-[0.2em] transition-colors ${
                    activeTab === tab
                      ? 'bg-primary/5 text-primary'
                      : 'text-text-secondary hover:bg-slate-50 hover:text-text-primary'
                  }`}
                >
                    <i className={`fas ${tabIcons[tab]} w-4 text-center`}></i>
                    {tab}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};
