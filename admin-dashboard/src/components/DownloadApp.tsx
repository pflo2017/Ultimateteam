import Button from "./Button";
import Badge from "./Badge";
import { Download, Star, Users, Smartphone } from "lucide-react"

export default function DownloadApp() {
  return (
    <section className="py-20 bg-gradient-to-r from-blue-600 via-purple-600 to-blue-800 relative overflow-hidden">
      {/* Background decorative elements */}
      <div className="absolute inset-0">
        <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-blue-600/20 to-purple-600/20"></div>
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-white/10 rounded-full blur-3xl animate-float"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-white/10 rounded-full blur-3xl animate-float" style={{ animationDelay: '2s' }}></div>
      </div>

      <div className="relative z-10 container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          {/* Content */}
          <div className="text-white">
            <Badge className="bg-white/20 text-white border-white/30 mb-6">
              <Smartphone className="w-4 h-4 mr-2" />
              Aplicație Mobilă
            </Badge>
            
            <h2 className="text-4xl sm:text-5xl font-bold mb-6">
              Descarcă aplicația <br />
              <span className="bg-gradient-to-r from-yellow-400 to-orange-400 bg-clip-text text-transparent">
                SportClub Pro
              </span>
            </h2>
            
            <p className="text-xl text-blue-100 mb-8 leading-relaxed">
              Accesează platforma din orice loc, oricând. Gestionarea clubului sportiv 
              devine mai ușoară cu aplicația noastră mobilă optimizată.
            </p>

            {/* App stats */}
            <div className="flex items-center space-x-6 mb-8">
              <div className="flex items-center space-x-2">
                <div className="flex items-center">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="w-5 h-5 fill-yellow-400 text-yellow-400" />
                  ))}
                </div>
                <span className="text-blue-100 font-medium">4.8/5</span>
              </div>
              <div className="flex items-center space-x-2">
                <Users className="w-5 h-5 text-blue-100" />
                <span className="text-blue-100 font-medium">10K+ descărcări</span>
              </div>
            </div>

            {/* Download buttons */}
            <div className="flex flex-col sm:flex-row gap-4">
              <Button 
                className="bg-white text-blue-600 hover:bg-gray-100 px-8 py-4 text-lg font-semibold rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:scale-105"
              >
                <Download className="mr-2 h-6 w-6" />
                App Store
              </Button>
              <Button 
                className="bg-white text-blue-600 hover:bg-gray-100 px-8 py-4 text-lg font-semibold rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:scale-105"
              >
                <Download className="mr-2 h-6 w-6" />
                Google Play
              </Button>
            </div>
          </div>

          {/* Mobile mockup */}
          <div className="relative flex justify-center lg:justify-end">
            <div className="relative">
              {/* Phone frame */}
              <div className="w-80 h-96 bg-gray-900 rounded-3xl p-4 shadow-2xl">
                <div className="w-full h-full bg-gradient-to-br from-blue-50 to-purple-50 rounded-2xl overflow-hidden relative">
                  {/* App header */}
                  <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-4 text-white">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center">
                          <div className="w-4 h-4 bg-gradient-to-r from-blue-500 to-purple-500 rounded"></div>
                        </div>
                        <span className="font-semibold">SportClub Pro</span>
                      </div>
                      <div className="w-6 h-6 bg-white/20 rounded-full"></div>
                    </div>
                  </div>
                  
                  {/* App content */}
                  <div className="p-4 space-y-4">
                    <div className="bg-white rounded-xl p-4 shadow-sm">
                      <div className="flex items-center justify-between mb-2">
                        <div className="w-16 h-8 bg-blue-200 rounded"></div>
                        <div className="w-8 h-8 bg-green-500 rounded-full"></div>
                      </div>
                      <div className="space-y-2">
                        <div className="h-3 bg-gray-200 rounded w-3/4"></div>
                        <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                      </div>
                    </div>
                    
                    <div className="bg-white rounded-xl p-4 shadow-sm">
                      <div className="flex items-center justify-between mb-2">
                        <div className="w-16 h-8 bg-purple-200 rounded"></div>
                        <div className="w-8 h-8 bg-blue-500 rounded-full"></div>
                      </div>
                      <div className="space-y-2">
                        <div className="h-3 bg-gray-200 rounded w-2/3"></div>
                        <div className="h-3 bg-gray-200 rounded w-1/3"></div>
                      </div>
                    </div>
                    
                    <div className="bg-white rounded-xl p-4 shadow-sm">
                      <div className="flex items-center justify-between mb-2">
                        <div className="w-16 h-8 bg-green-200 rounded"></div>
                        <div className="w-8 h-8 bg-yellow-500 rounded-full"></div>
                      </div>
                      <div className="space-y-2">
                        <div className="h-3 bg-gray-200 rounded w-4/5"></div>
                        <div className="h-3 bg-gray-200 rounded w-2/5"></div>
                      </div>
                    </div>
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
      </div>
    </section>
  )
} 