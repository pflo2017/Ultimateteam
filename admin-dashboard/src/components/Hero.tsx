import Button from "./Button"
import { Trophy, ArrowRight, Play, LogIn } from "lucide-react"
import { useNavigate } from "react-router-dom"

export default function Hero() {
  const navigate = useNavigate();
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden bg-gradient-to-br from-blue-50 via-white to-purple-50">
      {/* Background decorative elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-gradient-to-br from-blue-400/20 to-purple-400/20 rounded-full blur-3xl animate-float"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-gradient-to-br from-purple-400/20 to-pink-400/20 rounded-full blur-3xl animate-float" style={{ animationDelay: '2s' }}></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-gradient-to-br from-blue-300/10 to-purple-300/10 rounded-full blur-3xl animate-float" style={{ animationDelay: '4s' }}></div>
      </div>

      <div className="relative z-10 container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-4xl mx-auto">
          {/* Main headline */}
          <div className="mb-8">
            <h1 className="text-4xl sm:text-5xl lg:text-7xl font-bold text-gray-900 mb-6">
              <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                SportClub Pro
              </span>
            </h1>
            <p className="text-xl sm:text-2xl lg:text-3xl text-gray-600 mb-8 leading-relaxed">
              Platforma digitală pentru gestionarea cluburilor sportive din România
            </p>
            <p className="text-lg text-gray-500 mb-12 max-w-2xl mx-auto">
              Simplifică administrarea clubului tău cu instrumente moderne pentru programare, 
              comunicare și managementul membrilor într-o singură aplicație.
            </p>
          </div>

          {/* Call to action buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-6">
            <Button 
              type="button"
              className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-8 py-4 text-lg font-semibold rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:scale-105"
            >
              <Trophy className="mr-2 h-6 w-6" />
              Vezi Demo
              <ArrowRight className="ml-2 h-6 w-6" />
            </Button>
            <Button 
              type="button"
              className="border-2 border-gray-300 text-gray-700 px-8 py-4 text-lg font-semibold rounded-2xl hover:bg-gray-50 transition-all duration-300"
            >
              <Play className="mr-2 h-6 w-6" />
              Vezi Video
            </Button>
          </div>
          {/* Connect as Administrator button */}
          <div className="flex justify-center mb-16">
            <Button
              type="button"
              className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 text-lg font-semibold rounded-2xl shadow-xl transition-all duration-300"
              onClick={() => navigate('/login')}
            >
              <LogIn className="mr-2 h-6 w-6" />
              Connect as Administrator
            </Button>
          </div>

          {/* Dashboard preview mockup */}
          <div className="relative max-w-5xl mx-auto">
            <div className="relative bg-white rounded-3xl shadow-2xl p-8 border border-gray-200">
              {/* Mockup header */}
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center space-x-3">
                  <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                  <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                  <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                </div>
                <div className="text-sm text-gray-500">SportClub Pro Dashboard</div>
              </div>
              
              {/* Mockup content */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-2xl p-6">
                  <div className="w-12 h-12 bg-blue-500 rounded-xl mb-4"></div>
                  <div className="h-4 bg-blue-200 rounded mb-2"></div>
                  <div className="h-3 bg-blue-200 rounded w-2/3"></div>
                </div>
                <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-2xl p-6">
                  <div className="w-12 h-12 bg-purple-500 rounded-xl mb-4"></div>
                  <div className="h-4 bg-purple-200 rounded mb-2"></div>
                  <div className="h-3 bg-purple-200 rounded w-3/4"></div>
                </div>
                <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-2xl p-6">
                  <div className="w-12 h-12 bg-green-500 rounded-xl mb-4"></div>
                  <div className="h-4 bg-green-200 rounded mb-2"></div>
                  <div className="h-3 bg-green-200 rounded w-1/2"></div>
                </div>
              </div>
            </div>
            
            {/* Floating elements */}
            <div className="absolute -top-4 -right-4 w-8 h-8 bg-yellow-400 rounded-full animate-float" style={{ animationDelay: '1s' }}></div>
            <div className="absolute -bottom-4 -left-4 w-6 h-6 bg-pink-400 rounded-full animate-float" style={{ animationDelay: '3s' }}></div>
            <div className="absolute top-1/2 -right-8 w-4 h-4 bg-blue-400 rounded-full animate-float" style={{ animationDelay: '5s' }}></div>
          </div>
        </div>
      </div>
    </section>
  )
} 