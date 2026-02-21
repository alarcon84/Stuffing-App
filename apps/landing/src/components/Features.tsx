import React, { useEffect, useState, useRef } from 'react';
import gsap from 'gsap';

const ShufflerCard = () => {
    const [cards, setCards] = useState([
        { id: 1, label: 'Order Preservation Pass', desc: 'Maintains sequence fidelity.' },
        { id: 2, label: 'Volumetric Locking', desc: 'Determines strict boundaries.' },
        { id: 3, label: 'Gap Detection Algorithm', desc: 'Fills residual voids.' },
    ]);

    useEffect(() => {
        const interval = setInterval(() => {
            setCards((prev) => {
                const newArr = [...prev];
                const last = newArr.pop();
                if (last) newArr.unshift(last);
                return newArr;
            });
        }, 3000);
        return () => clearInterval(interval);
    }, []);

    return (
        <div className="relative h-64 w-full flex items-center justify-center pt-8">
            {cards.map((c, i) => {
                const isTop = i === 0;
                const scale = 1 - i * 0.05;
                const translateY = i * 20;
                const opacity = 1 - i * 0.3;
                const zIndex = 10 - i;

                return (
                    <div
                        key={c.id}
                        className="absolute w-11/12 bg-white rounded-[1.5rem] border border-foreground/10 p-6 shadow-xl transition-all duration-700 ease-[cubic-bezier(0.34,1.56,0.64,1)] text-foreground"
                        style={{
                            transform: `scale(${scale}) translateY(${translateY}px)`,
                            opacity,
                            zIndex,
                        }}
                    >
                        <div className="text-xs font-data font-bold text-accent mb-2">RUNNING [{c.id}]</div>
                        <div className="font-heading font-bold text-lg leading-tight mb-1 uppercase">{c.label}</div>
                        <div className="font-data text-xs text-foreground/60">{c.desc}</div>
                    </div>
                );
            })}
        </div>
    );
};

const TypewriterCard = () => {
    const [text, setText] = useState('');
    const fullText = ">> INITIATING 3D RENDER ENGINE...\n>> COMPILING GEOMETRY DATA...\n>> CALCULATING MESH POSITIONS...\n>> [SUCCESS] VISUALIZATION ACTIVE.\n>> STREAMING REAL-TIME UDP DATA...";
    const indexRef = useRef(0);

    useEffect(() => {
        const interval = setInterval(() => {
            if (indexRef.current < fullText.length) {
                setText((prev) => prev + fullText.charAt(indexRef.current));
                indexRef.current++;
            } else {
                setTimeout(() => {
                    setText('');
                    indexRef.current = 0;
                }, 3000);
            }
        }, 50);
        return () => clearInterval(interval);
    }, []);

    return (
        <div className="h-64 bg-foreground rounded-[1.5rem] p-6 text-primary overflow-hidden flex flex-col relative">
            <div className="flex items-center gap-2 mb-4 shrink-0">
                <div className="w-2 h-2 rounded-full bg-accent animate-pulse"></div>
                <div className="text-[10px] font-data font-bold tracking-widest text-primary/70 uppercase">Live Feed</div>
            </div>
            <div className="font-data text-xs leading-relaxed whitespace-pre-wrap flex-1 overflow-hidden opacity-90 break-all">
                {text}
                <span className="inline-block w-2 h-3 ml-1 bg-accent animate-pulse align-middle" style={{ animationDuration: '0.8s' }}></span>
            </div>
            {/* Glitch effect layer */}
            <div className="absolute inset-0 pointer-events-none opacity-10 bg-[linear-gradient(transparent_50%,rgba(0,0,0,0.5)_50%)] bg-[length:100%_4px] z-10" />
        </div>
    );
};

const SchedulerCard = () => {
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const ctx = gsap.context(() => {
            const cursor = '#svg-cursor';
            const cell = '#cell-wed';
            const saveBtn = '#save-btn';

            const tl = gsap.timeline({ repeat: -1, repeatDelay: 1, defaults: { ease: 'power2.inOut' } });

            // Cursor enters
            tl.set(cursor, { x: 40, y: 150, opacity: 0 })
                .to(cursor, { x: 140, y: 80, opacity: 1, duration: 1 })
                // Hover day
                .to(cursor, { scale: 0.8, duration: 0.1, yoyo: true, repeat: 1 }) // click
                .set(cell, { backgroundColor: '#E63B2E', color: '#fff' }) // Active!
                // Move to save
                .to(cursor, { x: 220, y: 210, duration: 0.8, delay: 0.3 })
                .to(cursor, { scale: 0.8, duration: 0.1, yoyo: true, repeat: 1 }) // click
                .set(saveBtn, { backgroundColor: '#111111', color: '#E8E4DD' })
                // Exit
                .to(cursor, { x: 280, y: 260, opacity: 0, duration: 0.5, delay: 0.3 })
                .set(cell, { backgroundColor: 'transparent', color: '#111111' })
                .set(saveBtn, { backgroundColor: 'transparent', color: '#111111' });

        }, containerRef);
        return () => ctx.revert();
    }, []);

    const days = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

    return (
        <div ref={containerRef} className="h-64 bg-primary border-2 border-foreground/10 rounded-[1.5rem] p-6 relative overflow-hidden">
            <div className="text-[10px] font-data font-bold text-foreground/50 mb-4 tracking-widest">PROCESS: [FACTORY_ADAPT]</div>
            <div className="grid grid-cols-7 gap-1 md:gap-2 mb-8">
                {days.map((d, i) => (
                    <div
                        key={i}
                        id={i === 3 ? 'cell-wed' : `cell-${i}`}
                        className="aspect-square border border-foreground/10 rounded-lg flex items-center justify-center font-data text-xs text-foreground font-bold transition-colors"
                    >
                        {d}
                    </div>
                ))}
            </div>
            <div className="flex justify-end mt-12">
                <button id="save-btn" className="border border-foreground text-foreground px-4 py-1.5 rounded-full text-xs font-heading font-bold uppercase transition-colors">
                    Commit Config
                </button>
            </div>

            <svg
                id="svg-cursor"
                className="absolute top-0 left-0 w-6 h-6 z-20"
                style={{ fill: '#E63B2E' }}
                viewBox="0 0 320 512"
            >
                <path d="M0 55.2V426c0 12.2 9.9 22 22 22c4.6 0 8.9-1.4 12.5-4l98.7-71.1h136.6c12.2 0 22-9.9 22-22V55.2C291.8 43 282 33.2 269.8 33.2H22c-12.2 0-22 9.9-22 22z" transform="scale(0.8) translate(50, 50)" />
            </svg>
        </div>
    );
};

export const Features = () => {
    return (
        <section id="features" className="w-full bg-background py-24 px-6 md:px-16 lg:px-24">
            <div className="max-w-7xl mx-auto text-primary">
                <div className="mb-16 md:mb-24">
                    <h2 className="font-heading font-extrabold uppercase text-3xl md:text-5xl text-foreground max-w-2xl leading-tight">
                        Interactive Functional <span className="font-drama italic font-normal text-accent">Artifacts.</span>
                    </h2>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">

                    {/* Card 1 */}
                    <div className="bg-primary rounded-[2rem] p-8 border border-foreground/5 shadow-sm group">
                        <h3 className="font-heading font-extrabold uppercase text-xl text-foreground mb-2 group-hover:text-accent transition-colors">Deterministic Logic</h3>
                        <p className="font-data text-xs text-foreground/70 mb-8 leading-relaxed">Algorithmically perfect packing order. No stochastic deviations. 100% reproducible yields.</p>
                        <ShufflerCard />
                    </div>

                    {/* Card 2 */}
                    <div className="bg-primary rounded-[2rem] p-8 border border-foreground/5 shadow-sm group">
                        <h3 className="font-heading font-extrabold uppercase text-xl text-foreground mb-2 group-hover:text-accent transition-colors">Real-Time Visualization</h3>
                        <p className="font-data text-xs text-foreground/70 mb-8 leading-relaxed">Instantaneous 3D rendering pipeline. Review stack placements in structural context immediately.</p>
                        <TypewriterCard />
                    </div>

                    {/* Card 3 */}
                    <div className="bg-primary rounded-[2rem] p-8 border border-foreground/5 shadow-sm group">
                        <h3 className="font-heading font-extrabold uppercase text-xl text-foreground mb-2 group-hover:text-accent transition-colors">Process Adaptation</h3>
                        <p className="font-data text-xs text-foreground/70 mb-8 leading-relaxed">Configure the matrix to mirror distinct factory rhythms, line setups, and worker shifts.</p>
                        <SchedulerCard />
                    </div>

                </div>
            </div>
        </section>
    );
};
