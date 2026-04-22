'use client';

import { useState, useEffect } from 'react';
import { Menu, X } from 'lucide-react';
import { usePathname } from 'next/navigation';

export function MobileSidebar({ children }: { children: React.ReactNode }) {
    const [isOpen, setIsOpen] = useState(false);
    const pathname = usePathname();

    // Auto-close on route change
    useEffect(() => {
        setIsOpen(false);
    }, [pathname]);

    // Lock body scroll when open
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => { document.body.style.overflow = ''; };
    }, [isOpen]);

    return (
        <>
            {/* Mobile header */}
            <div className="md:hidden fixed top-0 left-0 right-0 h-16 bg-card/90 backdrop-blur-xl border-b border-border z-40 flex items-center px-4 gap-3 shadow-card">
                <button
                    onClick={() => setIsOpen(true)}
                    className="p-2 -ml-2 rounded-xl hover:bg-sage-100 transition-colors active:scale-95"
                >
                    <Menu className="w-6 h-6 text-forest-800" />
                </button>
                <div className="font-bold text-[17px] tracking-tight text-foreground">КОМПАС</div>
            </div>

            {/* Overlay */}
            {isOpen && (
                <div
                    className="md:hidden fixed inset-0 bg-black/50 backdrop-blur-sm z-40 animate-in fade-in duration-200"
                    onClick={() => setIsOpen(false)}
                />
            )}

            {/* Sidebar drawer */}
            <aside
                className={`md:hidden fixed top-0 left-0 bottom-0 w-[280px] z-50 flex flex-col shadow-floating bg-sidebar transition-transform duration-300 ease-out ${isOpen ? 'translate-x-0' : '-translate-x-full'
                    }`}
                onClick={(e) => {
                    const target = e.target as HTMLElement;
                    if (target.closest('a')) {
                        setIsOpen(false);
                    }
                }}
            >
                <div className="flex items-center justify-between p-4 shrink-0 border-b border-sidebar-border">
                    <span className="font-bold text-lg text-sidebar-foreground px-2">Меню</span>
                    <button
                        onClick={() => setIsOpen(false)}
                        className="p-2 hover:bg-sidebar-accent rounded-xl transition-colors active:scale-95"
                    >
                        <X className="w-6 h-6 text-sidebar-foreground" />
                    </button>
                </div>
                <div className="overflow-y-auto flex-1">
                    {children}
                </div>
            </aside>
        </>
    );
}
