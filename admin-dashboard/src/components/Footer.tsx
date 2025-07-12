import { Trophy, Mail, Phone, MapPin, Facebook, Instagram, Twitter } from "lucide-react";

export default function Footer() {
  return (
    <footer className="bg-gray-900 text-white">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {/* Brand & Social */}
          <div>
            <div className="flex items-center space-x-2 mb-6">
              <Trophy className="w-8 h-8 text-blue-400" />
              <span className="text-2xl font-bold font-sans" style={{ fontFamily: 'system-ui, sans-serif' }}>SportClub Pro</span>
            </div>
            <p className="text-gray-300 mb-6 max-w-md font-normal font-sans" style={{ fontFamily: 'system-ui, sans-serif', fontWeight: 400 }}>
              Platforma digitală de top pentru gestionarea cluburilor sportive din România. Simplifică administrarea și crește eficiența clubului tău.
            </p>
            <div className="flex space-x-4">
              <a href="#" className="text-gray-300 hover:text-white transition-colors">
                <Facebook className="w-5 h-5" />
              </a>
              <a href="#" className="text-gray-300 hover:text-white transition-colors">
                <Instagram className="w-5 h-5" />
              </a>
              <a href="#" className="text-gray-300 hover:text-white transition-colors">
                <Twitter className="w-5 h-5" />
              </a>
            </div>
          </div>

          {/* Features Links */}
          <div>
            <h3 className="text-lg font-semibold mb-6 font-sans" style={{ fontFamily: 'system-ui, sans-serif' }}>Funcționalități</h3>
            <ul className="space-y-3">
              <li><a href="#" className="text-gray-300 hover:text-white transition-colors">Gestionarea Membrilor</a></li>
              <li><a href="#" className="text-gray-300 hover:text-white transition-colors">Programare Antrenamente</a></li>
              <li><a href="#" className="text-gray-300 hover:text-white transition-colors">Managementul Plăților</a></li>
              <li><a href="#" className="text-gray-300 hover:text-white transition-colors">Rapoarte & Analiză</a></li>
            </ul>
          </div>

          {/* Contact Info */}
          <div>
            <h3 className="text-lg font-semibold mb-6 font-sans" style={{ fontFamily: 'system-ui, sans-serif' }}>Contact</h3>
            <ul className="space-y-3">
              <li className="flex items-center space-x-3"><Mail className="w-5 h-5 text-blue-400" /><span className="text-gray-300">support@sportclubpro.ro</span></li>
              <li className="flex items-center space-x-3"><Phone className="w-5 h-5 text-blue-400" /><span className="text-gray-300">+40 21 123 4567</span></li>
              <li className="flex items-center space-x-3"><MapPin className="w-5 h-5 text-blue-400" /><span className="text-gray-300">București, România</span></li>
            </ul>
          </div>

          {/* Reserved for future expansion */}
          <div></div>
        </div>

        {/* Bottom section */}
        <div className="border-t border-gray-800 mt-12 pt-8">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="text-gray-400 text-sm mb-4 md:mb-0">© 2024 SportClub Pro. Toate drepturile rezervate.</div>
            <div className="flex space-x-6 text-sm">
              <a href="#" className="text-gray-400 hover:text-white transition-colors">Termeni și Condiții</a>
              <a href="#" className="text-gray-400 hover:text-white transition-colors">Politica de Confidențialitate</a>
              <a href="#" className="text-gray-400 hover:text-white transition-colors">GDPR</a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
} 