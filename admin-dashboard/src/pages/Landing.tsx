import React, { useState } from 'react';
import FixedNavBar from '../components/FixedNavBar';
import Hero from '../components/Hero';
import Features from '../components/Features';
import Testimonials from '../components/Testimonials';
import DownloadApp from '../components/DownloadApp';
import Footer from '../components/Footer';
import ClubAdminLoginModal from '../components/ClubAdminLoginModal';

export default function Landing() {
  const [loginModalOpen, setLoginModalOpen] = useState(false);
  const handleLoginClick = () => setLoginModalOpen(true);
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <FixedNavBar onLoginClick={handleLoginClick} />
      <main className="pt-20">
        <section id="hero">
          <Hero onLoginClick={handleLoginClick} />
        </section>
        <section id="features">
          <Features />
        </section>
        <section id="testimonials">
          <Testimonials />
        </section>
        <section id="download">
          <DownloadApp />
        </section>
      </main>
      <section id="contact">
        <Footer />
      </section>
      <ClubAdminLoginModal open={loginModalOpen} onClose={() => setLoginModalOpen(false)} />
    </div>
  );
} 