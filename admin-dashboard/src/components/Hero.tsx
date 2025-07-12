import { Play, Shield } from "lucide-react";
import React from "react";

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
            <div className="relative bg-white rounded-3xl shadow-2xl p-8 border border-gray-200 max-w-md w-full animate-fade-in">
              {/* Mockup header */}
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                  <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                  <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                </div>
                <div className="text-sm text-gray-500">SportClub Pro Dashboard</div>
              </div>
              {/* Mockup content */}
              <div className="grid grid-cols-1 gap-4">
                <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-2xl p-4">
                  <div className="w-10 h-10 bg-blue-500 rounded-xl mb-2"></div>
                  <div className="h-3 bg-blue-200 rounded mb-1"></div>
                  <div className="h-2 bg-blue-200 rounded w-2/3"></div>
                </div>
                <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-2xl p-4">
                  <div className="w-10 h-10 bg-purple-500 rounded-xl mb-2"></div>
                  <div className="h-3 bg-purple-200 rounded mb-1"></div>
                  <div className="h-2 bg-purple-200 rounded w-3/4"></div>
                </div>
                <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-2xl p-4">
                  <div className="w-10 h-10 bg-green-500 rounded-xl mb-2"></div>
                  <div className="h-3 bg-green-200 rounded mb-1"></div>
                  <div className="h-2 bg-green-200 rounded w-1/2"></div>
                </div>
              </div>
              {/* Floating elements */}
              <div className="absolute -top-4 -right-4 w-8 h-8 bg-yellow-400 rounded-full animate-float" style={{ animationDelay: '1s' }}></div>
              <div className="absolute -bottom-4 -left-4 w-6 h-6 bg-pink-400 rounded-full animate-float" style={{ animationDelay: '3s' }}></div>
              <div className="absolute top-1/2 -right-8 w-4 h-4 bg-blue-400 rounded-full animate-float" style={{ animationDelay: '5s' }}></div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
} 