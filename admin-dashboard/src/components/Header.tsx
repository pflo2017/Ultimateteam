import Button from "./Button";
import { Trophy, Menu, X } from "lucide-react"
import { useState } from "react"
import { useNavigate } from "react-router-dom"

export default function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const navigate = useNavigate()

  const handleLoginClick = () => {
    navigate('/login')
  }

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-200">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex items-center space-x-2">
            <Trophy className="w-8 h-8 text-blue-600" />
            <span className="text-xl font-bold text-gray-900">SportClub Pro</span>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-8">
            <a href="#features" className="text-gray-600 hover:text-gray-900 transition-colors duration-200">
              Funcționalități
            </a>
            <a href="#download" className="text-gray-600 hover:text-gray-900 transition-colors duration-200">
              Descarcă App
            </a>
            <a href="#contact" className="text-gray-600 hover:text-gray-900 transition-colors duration-200">
              Contact
            </a>
            <Button 
              className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white"
              onClick={handleLoginClick}
            >
              Login Administrator
            </Button>
          </nav>

          {/* Mobile menu button */}
          <button
            className="md:hidden p-2 rounded-md text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors duration-200"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
          >
            {isMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {/* Mobile Navigation */}
        {isMenuOpen && (
          <div className="md:hidden py-4 border-t border-gray-200">
            <nav className="flex flex-col space-y-4">
              <a 
                href="#features" 
                className="text-gray-600 hover:text-gray-900 transition-colors duration-200"
                onClick={() => setIsMenuOpen(false)}
              >
                Funcționalități
              </a>
              <a 
                href="#download" 
                className="text-gray-600 hover:text-gray-900 transition-colors duration-200"
                onClick={() => setIsMenuOpen(false)}
              >
                Descarcă App
              </a>
              <a 
                href="#contact" 
                className="text-gray-600 hover:text-gray-900 transition-colors duration-200"
                onClick={() => setIsMenuOpen(false)}
              >
                Contact
              </a>
              <Button 
                className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white w-full"
                onClick={() => {
                  handleLoginClick()
                  setIsMenuOpen(false)
                }}
              >
                Login Administrator
              </Button>
            </nav>
          </div>
        )}
      </div>
    </header>
  )
} 