import React from 'react';
import { Navbar } from './components/Navbar';
import { Hero } from './components/Hero';
import { Features } from './components/Features';
import { Philosophy } from './components/Philosophy';
import { Protocol } from './components/Protocol';
import { Footer } from './components/Footer';

function App() {
  return (
    <main className="w-full min-h-screen bg-background text-foreground overflow-x-hidden selection:bg-accent selection:text-white relative z-10">
      <Navbar />
      <div className="flex flex-col w-full relative">
        <Hero />
        <Features />
        <Philosophy />
        <Protocol />
        <Footer />
      </div>
    </main>
  );
}

export default App;
