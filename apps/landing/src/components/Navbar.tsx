import React, { useEffect, useRef, useState } from 'react';

export const Navbar = () => {
    const navRef = useRef<HTMLDivElement>(null);
    const [isScrolled, setIsScrolled] = useState(false);

    useEffect(() => {
        const handleScroll = () => {
            setIsScrolled(window.scrollY > 80);
        };
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    return (
        <div className="fixed top-6 left-0 right-0 z-50 flex justify-center pointer-events-none px-4">
            <nav
                ref={navRef}
                className={`pointer-events-auto transition-all duration-700 ease-[cubic-bezier(0.19,1,0.22,1)] rounded-[2rem] px-6 py-3 flex items-center gap-8 md:gap-12 ${isScrolled
                        ? 'bg-background/80 backdrop-blur-xl border border-foreground/10 text-foreground shadow-2xl translate-y-0'
                        : 'bg-transparent text-primary border border-transparent translate-y-2'
                    }`}
            >
                <div className="font-heading font-bold text-lg md:text-xl tracking-tighter uppercase whitespace-nowrap">
                    Stuffing Calc<span className="text-accent">.</span>
                </div>

                <div className="hidden md:flex items-center gap-8 text-sm font-data">
                    <a href="#features" className="link-hover hover:text-accent transition-colors">Features</a>
                    <a href="#philosophy" className="link-hover hover:text-accent transition-colors">Philosophy</a>
                    <a href="#protocol" className="link-hover hover:text-accent transition-colors">Protocol</a>
                </div>

                <button className="magnetic-button rounded-[2rem] bg-accent text-primary px-6 py-2.5 text-sm font-heading font-bold uppercase tracking-wide">
                    <div className="hover-layer bg-foreground"></div>
                    <span>Demo</span>
                </button>
            </nav>
        </div>
    );
};
