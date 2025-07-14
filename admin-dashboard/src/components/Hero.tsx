import { Play, Shield } from "lucide-react";
import React from "react";
import dashMobile from '../assets/dash+mobile.png';

interface HeroProps {
  onLoginClick?: () => void;
}

export default function Hero({ onLoginClick }: HeroProps) {
  return (
    <section className="relative min-h-[80vh] flex items-center justify-center overflow-hidden bg-gradient-to-br from-blue-50 via-white to-purple-50">
      {/* Background decorative elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-32 -right-32 w-72 h-72 bg-gradient-to-br from-blue-400/20 to-purple-400/20 rounded-full blur-3xl animate-float"></div>
        <div className="absolute -bottom-32 -left-32 w-72 h-72 bg-gradient-to-br from-purple-400/20 to-pink-400/20 rounded-full blur-3xl animate-float" style={{ animationDelay: '2s' }}></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-gradient-to-br from-blue-300/10 to-purple-300/10 rounded-full blur-3xl animate-float" style={{ animationDelay: '4s' }}></div>
      </div>

      <div className="relative z-10 container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col lg:flex-row items-center justify-between gap-12">
          {/* Left: Content */}
          <div className="flex-1 max-w-2xl text-center lg:text-left">
            {/* Headline */}
            <h1 className="text-4xl md:text-5xl lg:text-7xl font-bold text-gray-900 leading-tight mb-6 font-sans" style={{ fontFamily: 'system-ui, sans-serif' }}>
              Soluția <span className="bg-gradient-to-r from-[#0CC1EC] to-[#007AFF] bg-clip-text text-transparent">modernă</span> pentru managementul cluburilor sportive
            </h1>
            {/* Subtitle */}
            <p className="text-lg md:text-xl lg:text-2xl text-gray-600 mb-8 font-normal font-sans max-w-xl mx-auto lg:mx-0" style={{ fontFamily: 'system-ui, sans-serif', fontWeight: 400 }}>
              Platformă digitală completă pentru cluburi sportive din România. Administrează cu ușurință echipe, membri, antrenori și plăți – totul de care ai nevoie pentru <span className="bg-gradient-to-r from-[#0CC1EC] to-[#007AFF] bg-clip-text text-transparent">clubul tău</span>.
            </p>
            {/* CTA Button */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start items-center mb-8">
              <button
                type="button"
                className="flex items-center border border-gray-300 bg-white text-gray-900 px-8 py-4 text-lg font-semibold rounded-2xl shadow-sm hover:shadow-md transition-all duration-300"
              >
                <Play className="h-6 w-6 mr-2" />
                Vezi Demo
              </button>
              <button
                type="button"
                className="flex items-center bg-[#0CC1EC] hover:bg-[#009FCC] text-white px-8 py-4 text-lg font-semibold rounded-2xl shadow-xl transition-all duration-300"
                onClick={onLoginClick}
              >
                <Shield className="mr-2 h-6 w-6" />
                Login
              </button>
            </div>
          </div>
          {/* Right: Visual Mockup */}
          <div className="flex-1 flex justify-center lg:justify-end">
            <img
              src={dashMobile}
              alt="Dashboard preview"
              className="rounded-3xl max-w-md w-full animate-fade-in object-contain"
              style={{ margin: '0 auto' }}
            />
          </div>
        </div>
      </div>
    </section>
  );
} 