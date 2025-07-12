import { useState } from "react";
import { Shield } from "lucide-react";
import Logo from "./Logo";

interface FixedNavBarProps {
  onLoginClick?: () => void;
}

export default function FixedNavBar({ onLoginClick }: FixedNavBarProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
      setIsMenuOpen(false);
    }
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-200">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand */}
          <div className="flex items-center space-x-2">
            <Logo size={32} />
            <span className="text-xl font-bold text-gray-900">Clubio</span>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-8">
            <button onClick={() => scrollToSection('features')} className="text-gray-600 hover:text-blue-600 transition-colors font-medium">Funcționalități</button>
            <button onClick={() => scrollToSection('download')} className="text-gray-600 hover:text-blue-600 transition-colors font-medium">Descarcă App</button>
            <button onClick={() => scrollToSection('contact')} className="text-gray-600 hover:text-blue-600 transition-colors font-medium">Contact</button>
            <button 
              className="ml-4 flex items-center bg-[#0CC1EC] hover:bg-[#009FCC] text-white font-semibold px-6 py-2 rounded-lg shadow transition-all"
              onClick={onLoginClick}
            >
              <Shield className="mr-2 h-4 w-4" />
              Login
            </button>
          </nav>

          {/* Mobile menu button */}
          <button
            className="md:hidden p-2 rounded-md text-gray-600 hover:text-blue-600 hover:bg-gray-100 transition-colors duration-200"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            aria-label="Deschide meniul"
          >
            <span className="sr-only">Deschide meniul</span>
            <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              {isMenuOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 8h16M4 16h16" />
              )}
            </svg>
          </button>
        </div>

        {/* Mobile Navigation */}
        {isMenuOpen && (
          <div className="md:hidden py-4 border-t border-gray-200 animate-fade-in">
            <nav className="flex flex-col space-y-4">
              <button onClick={() => scrollToSection('features')} className="text-gray-600 hover:text-blue-600 transition-colors font-medium">Funcționalități</button>
              <button onClick={() => scrollToSection('download')} className="text-gray-600 hover:text-blue-600 transition-colors font-medium">Descarcă App</button>
              <button onClick={() => scrollToSection('contact')} className="text-gray-600 hover:text-blue-600 transition-colors font-medium">Contact</button>
              <button 
                className="mt-2 flex items-center bg-[#0CC1EC] hover:bg-[#009FCC] text-white font-semibold px-6 py-2 rounded-lg shadow transition-all"
                onClick={onLoginClick}
              >
                <Shield className="mr-2 h-4 w-4" />
                Login
              </button>
            </nav>
          </div>
        )}
      </div>
    </header>
  );
} 