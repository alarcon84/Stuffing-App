import React, { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

const IngestAnim = () => (
    <svg viewBox="0 0 100 100" className="w-full h-full stroke-accent fill-none animate-[spin_10s_linear_infinite]" strokeWidth="0.5">
        <circle cx="50" cy="50" r="40" strokeDasharray="4 4" />
        <circle cx="50" cy="50" r="30" strokeDasharray="2 6" className="animate-[spin_15s_linear_infinite_reverse]" style={{ transformOrigin: 'center' }} />
        <rect x="25" y="25" width="50" height="50" className="animate-[spin_20s_linear_infinite]" style={{ transformOrigin: 'center' }} />
    </svg>
);

const SimulateAnim = () => (
    <div className="relative w-full h-full bg-foreground/5 overflow-hidden flex items-center justify-center">
        <div className="absolute inset-0 bg-[radial-gradient(#E8E4DD_1px,transparent_1px)] [background-size:16px_16px] opacity-20"></div>
        <div className="absolute top-0 left-0 w-full h-1 bg-accent blur-[2px] animate-[scan_2s_ease-in-out_infinite_alternate]" style={{ boxShadow: '0 0 10px #E63B2E, 0 0 20px #E63B2E' }}></div>
        <style>{`
      @keyframes scan {
        0% { transform: translateY(0); }
        100% { transform: translateY(240px); }
      }
    `}</style>
    </div>
);

const DeployAnim = () => (
    <svg viewBox="0 0 200 100" className="w-full h-full stroke-accent fill-none" strokeWidth="1">
        <path
            d="M 0 50 L 40 50 L 50 20 L 60 80 L 70 50 L 130 50 L 140 20 L 150 80 L 160 50 L 200 50"
            strokeDasharray="400"
            strokeDashoffset="400"
            className="animate-[pulseWave_3s_linear_infinite]"
        />
        <style>{`
      @keyframes pulseWave {
        0% { stroke-dashoffset: 400; }
        50% { stroke-dashoffset: 0; }
        100% { stroke-dashoffset: -400; }
      }
    `}</style>
    </svg>
);

const steps = [
    { id: '01', title: 'INGEST', desc: 'Import exact shipment parameters, multi-container constraints, and operational factory variables into the calculation matrix.', Anim: IngestAnim },
    { id: '02', title: 'SIMULATE', desc: 'The engine aggressively permutes thousands of packing variations to uncover the absolute deterministic limit of volumetric density.', Anim: SimulateAnim },
    { id: '03', title: 'DEPLOY', desc: 'Export indisputable, step-by-step loading blueprints that dictate exact order sequences for the factory floor.', Anim: DeployAnim }
];

export const Protocol = () => {
    const wrapperRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const ctx = gsap.context(() => {
            const cards = gsap.utils.toArray<HTMLElement>('.protocol-card');

            cards.forEach((card, i) => {
                if (i === cards.length - 1) return; // last card doesn't stack under anything

                ScrollTrigger.create({
                    trigger: card,
                    start: 'top 15%', // When this card hits top of viewport
                    endTrigger: wrapperRef.current,
                    end: 'bottom bottom',
                    pin: true,
                    pinSpacing: false,
                });

                const nextCard = cards[i + 1];

                gsap.to(card, {
                    scale: 0.9,
                    opacity: 0.5,
                    filter: 'blur(20px)',
                    ease: 'none',
                    scrollTrigger: {
                        trigger: nextCard,
                        start: 'top bottom', // As next card comes in
                        end: 'top 15%', // Until it reaches the top
                        scrub: true,
                    }
                });
            });

            // Pin last card too for a bit
            ScrollTrigger.create({
                trigger: cards[cards.length - 1],
                start: 'top 15%',
                end: '+=100%',
                pin: true,
            });

        }, wrapperRef);

        return () => ctx.revert();
    }, []);

    return (
        <section id="protocol" className="w-full bg-background pt-32 pb-64 px-6 md:px-16" ref={wrapperRef}>
            <div className="max-w-7xl mx-auto mb-24">
                <h2 className="font-heading font-extrabold uppercase text-xs md:text-sm tracking-[0.2em] text-accent mb-4">SYSTEM PROTOCOL</h2>
                <h3 className="font-drama italic text-5xl md:text-7xl text-foreground">The Simulation Pipeline.</h3>
            </div>

            <div className="max-w-5xl mx-auto relative flex flex-col gap-12">
                {steps.map((step, i) => (
                    <div
                        key={i}
                        className="protocol-card w-full h-[70vh] min-h-[500px] bg-primary border text-foreground rounded-[2rem] shadow-2xl flex flex-col md:flex-row overflow-hidden relative z-10 origin-top will-change-transform"
                        style={{ zIndex: steps.length - i }}
                    >
                        {/* Visual Side */}
                        <div className="w-full md:w-1/2 h-1/2 md:h-full bg-foreground flex items-center justify-center p-12">
                            <step.Anim />
                        </div>

                        {/* Text Side */}
                        <div className="w-full md:w-1/2 h-1/2 md:h-full p-8 md:p-16 flex flex-col justify-center gap-6 relative">
                            <div className="font-data text-4xl font-bold text-accent">[{step.id}]</div>
                            <h4 className="font-heading font-extrabold uppercase text-4xl md:text-5xl">{step.title}</h4>
                            <p className="font-data text-sm leading-relaxed max-w-sm text-foreground/70">
                                {step.desc}
                            </p>
                        </div>
                    </div>
                ))}
            </div>
        </section>
    );
};
