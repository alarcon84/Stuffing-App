import React from 'react';

export const Footer = () => {
    return (
        <>
            {/* Get Started / CTA Section */}
            <section className="w-full bg-background py-32 md:py-48 px-6 md:px-16 flex flex-col items-center justify-center relative z-10">
                <div className="max-w-4xl text-center flex flex-col items-center gap-8">
                    <h2 className="font-heading font-extrabold text-5xl md:text-7xl lg:text-8xl text-foreground uppercase leading-[0.9] tracking-tighter">
                        Initiate the <br />
                        <span className="font-drama italic font-normal text-accent">Simulation.</span>
                    </h2>
                    <p className="font-data text-sm text-foreground/70 max-w-lg leading-relaxed mt-4 mb-8">
                        Deploy deterministic logistics on your factory floor. Stop guessing. Start calculating.
                    </p>
                    <button className="magnetic-button rounded-[2rem] bg-accent text-primary px-10 py-5 text-lg font-heading font-bold uppercase tracking-widest shadow-2xl">
                        <div className="hover-layer bg-foreground"></div>
                        <span className="relative z-10 group-hover:text-primary transition-colors">Schedule a Live Demo</span>
                    </button>
                </div>
            </section>

            {/* Actual Footer */}
            <footer className="w-full bg-foreground text-primary rounded-t-[4rem] pt-24 pb-12 px-8 md:px-16 lg:px-24 flex flex-col gap-16 relative z-20">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 lg:gap-8">

                    <div className="col-span-1 md:col-span-2 flex flex-col gap-6">
                        <div className="font-heading font-extrabold text-3xl uppercase tracking-tighter">
                            Stuffing Calc<span className="text-accent">.</span>
                        </div>
                        <p className="font-data text-xs text-primary/50 max-w-xs leading-relaxed">
                            An advanced simulator for logistics and time optimization. Engineered for modern factory execution.
                        </p>
                    </div>

                    <div className="flex flex-col gap-4">
                        <h4 className="font-data font-bold text-xs uppercase tracking-widest text-primary/40 mb-2">Systems</h4>
                        <a href="#" className="font-heading text-sm hover:text-accent transition-colors">Deterministic Engine</a>
                        <a href="#" className="font-heading text-sm hover:text-accent transition-colors">3D Visualizer</a>
                        <a href="#" className="font-heading text-sm hover:text-accent transition-colors">Integration API</a>
                    </div>

                    <div className="flex flex-col gap-4">
                        <h4 className="font-data font-bold text-xs uppercase tracking-widest text-primary/40 mb-2">Company</h4>
                        <a href="#" className="font-heading text-sm hover:text-accent transition-colors">About Us</a>
                        <a href="#" className="font-heading text-sm hover:text-accent transition-colors">Careers</a>
                        <a href="#" className="font-heading text-sm hover:text-accent transition-colors">Contact</a>
                    </div>

                </div>

                <div className="border-t border-primary/10 pt-8 flex flex-col md:flex-row justify-between items-center gap-6">
                    <div className="flex items-center gap-3 bg-primary/5 px-4 py-2 rounded-full border border-primary/10">
                        <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                        <div className="font-data text-[10px] font-bold tracking-widest text-primary uppercase">System Operational</div>
                    </div>

                    <div className="font-data text-xs text-primary/40">
                        &copy; {new Date().getFullYear()} Stuffing Calculator. All rights reserved.
                    </div>
                </div>
            </footer>
        </>
    );
};
