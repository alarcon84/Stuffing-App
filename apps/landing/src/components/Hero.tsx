import React, { useEffect, useRef } from 'react';
import gsap from 'gsap';

export const Hero = () => {
    const container = useRef<HTMLDivElement>(null);
    const text1Ref = useRef<HTMLDivElement>(null);
    const text2Ref = useRef<HTMLDivElement>(null);
    const descRef = useRef<HTMLParagraphElement>(null);
    const btnRef = useRef<HTMLButtonElement>(null);

    useEffect(() => {
        const ctx = gsap.context(() => {
            const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });

            tl.fromTo(
                [text1Ref.current, text2Ref.current, descRef.current, btnRef.current],
                { y: 40, opacity: 0 },
                { y: 0, opacity: 1, duration: 1.2, stagger: 0.15, delay: 0.2 }
            );
        }, container);

        return () => ctx.revert();
    }, []);

    return (
        <section
            ref={container}
            className="relative w-full h-[100dvh] flex items-end pb-24 md:pb-32 px-6 md:px-16 lg:px-24 overflow-hidden"
        >
            {/* Background Image & Gradient */}
            <div className="absolute inset-0 z-0 bg-foreground">
                <img
                    src="https://images.unsplash.com/photo-1587293852726-694b5e8c4749?q=80&w=2074&auto=format&fit=crop"
                    alt="Concrete Factory"
                    className="w-full h-full object-cover opacity-60 mix-blend-luminosity"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-foreground via-foreground/70 to-transparent"></div>
            </div>

            {/* Content */}
            <div className="relative z-10 w-full max-w-7xl md:w-2/3 lg:w-1/2 flex flex-col items-start gap-6 text-primary">
                <div className="flex flex-col gap-1 leading-none tracking-tight">
                    <div ref={text1Ref} className="font-heading font-extrabold uppercase text-4xl md:text-6xl lg:text-7xl">
                        Optimize the
                    </div>
                    <div ref={text2Ref} className="font-drama italic text-6xl md:text-8xl lg:text-9xl text-accent -ml-1">
                        Factory Floor.
                    </div>
                </div>

                <p ref={descRef} className="font-data text-sm md:text-base max-w-md text-primary/80 mt-4 leading-relaxed">
                    The ultimate simulation engine for deterministic logistics and time optimization. Built for advanced manufacturing facilities.
                </p>

                <button
                    ref={btnRef}
                    className="magnetic-button mt-8 rounded-[2rem] bg-accent text-primary px-8 py-4 text-base font-heading font-bold uppercase tracking-wider"
                >
                    <div className="hover-layer bg-white"></div>
                    <span className="relative z-10 group-hover:text-foreground transition-colors mix-blend-difference">Explore the System</span>
                </button>
            </div>
        </section>
    );
};
