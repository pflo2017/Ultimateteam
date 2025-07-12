import Button from "./Button";
import { Trophy, Mail, Phone, MapPin, Facebook, Instagram, Twitter, Linkedin } from "lucide-react"

export default function Footer() {
  return (
    <footer className="bg-gray-900 text-white">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {/* Company info */}
          <div className="lg:col-span-2">
            <div className="flex items-center space-x-2 mb-6">
              <Trophy className="w-8 h-8 text-blue-400" />
              <span className="text-2xl font-bold">SportClub Pro</span>
            </div>
            <p className="text-gray-300 mb-6 max-w-md">
              Platforma digitală de top pentru gestionarea cluburilor sportive din România. 
              Simplifică administrarea și crește eficiența clubului tău.
            </p>
            <div className="flex space-x-4">
              <Button className="text-gray-300 hover:text-white hover:bg-gray-800">
                <Facebook className="w-5 h-5" />
              </Button>
              <Button className="text-gray-300 hover:text-white hover:bg-gray-800">
                <Instagram className="w-5 h-5" />
              </Button>
              <Button className="text-gray-300 hover:text-white hover:bg-gray-800">
                <Twitter className="w-5 h-5" />
              </Button>
              <Button className="text-gray-300 hover:text-white hover:bg-gray-800">
                <Linkedin className="w-5 h-5" />
              </Button>
            </div>
          </div>

          {/* Features */}
          <div>
            <h3 className="text-lg font-semibold mb-6">Funcționalități</h3>
            <ul className="space-y-3">
              <li>
                <a href="#" className="text-gray-300 hover:text-white transition-colors duration-200">
                  Gestionarea Membrilor
                </a>
              </li>
              <li>
                <a href="#" className="text-gray-300 hover:text-white transition-colors duration-200">
                  Programarea Antrenamentelor
                </a>
              </li>
              <li>
                <a href="#" className="text-gray-300 hover:text-white transition-colors duration-200">
                  Gestionarea Plăților
                </a>
              </li>
              <li>
                <a href="#" className="text-gray-300 hover:text-white transition-colors duration-200">
                  Rapoarte și Analize
                </a>
              </li>
              <li>
                <a href="#" className="text-gray-300 hover:text-white transition-colors duration-200">
                  Comunicare Instantanee
                </a>
              </li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h3 className="text-lg font-semibold mb-6">Contact</h3>
            <ul className="space-y-3">
              <li className="flex items-center space-x-3">
                <Mail className="w-5 h-5 text-blue-400" />
                <span className="text-gray-300">contact@sportclubpro.ro</span>
              </li>
              <li className="flex items-center space-x-3">
                <Phone className="w-5 h-5 text-blue-400" />
                <span className="text-gray-300">+40 721 234 567</span>
              </li>
              <li className="flex items-center space-x-3">
                <MapPin className="w-5 h-5 text-blue-400" />
                <span className="text-gray-300">București, România</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom section */}
        <div className="border-t border-gray-800 mt-12 pt-8">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="text-gray-400 text-sm mb-4 md:mb-0">
              © 2024 SportClub Pro. Toate drepturile rezervate.
            </div>
            <div className="flex space-x-6 text-sm">
              <a href="#" className="text-gray-400 hover:text-white transition-colors duration-200">
                Termeni și Condiții
              </a>
              <a href="#" className="text-gray-400 hover:text-white transition-colors duration-200">
                Politica de Confidențialitate
              </a>
              <a href="#" className="text-gray-400 hover:text-white transition-colors duration-200">
                GDPR
              </a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
} 