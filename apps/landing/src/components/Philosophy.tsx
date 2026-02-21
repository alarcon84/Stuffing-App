import React, { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

export const Philosophy = () => {
    const containerRef = useRef<HTMLElement>(null);
    const bgRef = useRef<HTMLImageElement>(null);
    const text1Ref = useRef<HTMLDivElement>(null);
    const text2Ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const ctx = gsap.context(() => {
            // Parallax Background
            gsap.to(bgRef.current, {
                yPercent: 20,
                ease: 'none',
                scrollTrigger: {
                    trigger: containerRef.current,
                    start: 'top bottom',
                    end: 'bottom top',
                    scrub: true,
                },
            });

            // Text Reveal
            const tl = gsap.timeline({
                scrollTrigger: {
                    trigger: containerRef.current,
                    start: 'top 60%',
                    toggleActions: 'play none none reverse',
                },
            });

            tl.fromTo(
                text1Ref.current,
                { y: 30, opacity: 0 },
                { y: 0, opacity: 1, duration: 1, ease: 'power3.out' }
            )
                .fromTo(
                    text2Ref.current,
                    { y: 50, opacity: 0 },
                    { y: 0, opacity: 1, duration: 1.2, ease: 'power3.out' },
                    '-=0.6'
                );
        }, containerRef);

        return () => ctx.revert();
    }, []);

    return (
        <section
            id="philosophy"
            ref={containerRef}
            className="relative w-full py-40 md:py-56 bg-foreground text-primary overflow-hidden px-6 md:px-16 flex items-center justify-center min-h-[80vh]"
        >
            {/* Background Texture */}
            <div className="absolute inset-0 z-0">
                <img
                    ref={bgRef}
                    src="https://images.unsplash.com/photo-1541888086925-0c1aeb135d97?q=80&w=2070&auto=format&fit=crop"
                    alt="Raw Concrete Texture"
                    className="absolute -top-[20%] w-full h-[140%] object-cover opacity-20 mix-blend-luminosity grayscale"
                />
                <div className="absolute inset-0 bg-foreground/70"></div>
            </div>

            {/* Content */}
            <div className="relative z-10 w-full max-w-5xl mx-auto flex flex-col gap-12 md:gap-16">
                <div
                    ref={text1Ref}
                    className="font-data font-bold tracking-widest text-sm md:text-base text-primary/60 uppercase"
                >
                    Most logistics software focuses on:
                    <br className="hidden md:block" /> stochastic spatial averages and theoretical volumes.
                </div>

                <div
                    ref={text2Ref}
                    className="font-heading font-extrabold text-4xl md:text-6xl lg:text-8xl leading-[1.1] tracking-tight uppercase"
                >
                    We simulate<br />
                    <span className="font-drama italic font-normal text-accent lowercase">absolute</span><br />
                    deterministic <span className="text-primary/90">yields.</span>
                </div>
            </div>
        </section>
    );
};
