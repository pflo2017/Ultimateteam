import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./Card";
import Badge from "./Badge";
import { Users, Calendar, Star, Shield, Smartphone, Trophy } from "lucide-react";

const features = [
  {
    icon: Users,
    title: "Gestionarea Membrilor",
    description: "Administrează contactele și informațiile membrilor clubului într-o bază de date centralizată.",
    color: "bg-blue-500",
    badgeColor: "bg-blue-100 text-blue-800"
  },
  {
    icon: Calendar,
    title: "Programarea Antrenamentelor",
    description: "Programează automat antrenamentele și trimite notificări membrilor pentru confirmarea prezenței.",
    color: "bg-green-500",
    badgeColor: "bg-green-100 text-green-800"
  },
  {
    icon: Star,
    title: "Gestionarea Plăților",
    description: "Urmărește plățile și taxele membrilor cu procesare securizată și rapoarte automate.",
    color: "bg-purple-500",
    badgeColor: "bg-purple-100 text-purple-800"
  },
  {
    icon: Trophy,
    title: "Urmărirea Performanței",
    description: "Monitorizează progresul membrilor cu statistici detaliate și rapoarte personalizate.",
    color: "bg-yellow-500",
    badgeColor: "bg-yellow-100 text-yellow-800"
  },
  {
    icon: Smartphone,
    title: "Comunicare Instantanee",
    description: "Trimite notificări push și mesaje grup pentru comunicare rapidă cu membrii clubului.",
    color: "bg-red-500",
    badgeColor: "bg-red-100 text-red-800"
  },
  {
    icon: Shield,
    title: "Rapoarte și Analize",
    description: "Generează rapoarte comprehensive pentru analiza performanței și planificarea strategică.",
    color: "bg-indigo-500",
    badgeColor: "bg-indigo-100 text-indigo-800"
  }
]

const benefits = [
  {
    icon: Star,
    title: "Organizare Eficientă",
    description: "În loc de haosul WhatsApp, ai totul organizat într-o singură platformă profesională.",
    color: "text-green-600"
  },
  {
    icon: Shield,
    title: "Progres Vizibil",
    description: "În loc de estimări aproximative, ai statistici precise și progres măsurabil.",
    color: "text-blue-600"
  },
  {
    icon: Star,
    title: "Transparență Totală",
    description: "În loc de evidențe manuale, ai un sistem transparent și verificabil.",
    color: "text-purple-600"
  }
]

export default function Features() {
  return (
    <section className="py-20 bg-white">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section header */}
        <div className="text-center mb-16">
          <h2 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-6">
            Funcționalități <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">Complete</span>
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Toate instrumentele necesare pentru a-ți gestiona clubul sportiv într-o singură platformă modernă
          </p>
        </div>

        {/* Features grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-20">
          {features.map((feature, index) => (
            <Card 
              key={index} 
              className="group hover:shadow-xl transition-all duration-300 transform hover:-translate-y-2 border-0 shadow-lg"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <div className={`w-12 h-12 ${feature.color} rounded-xl flex items-center justify-center text-white`}>
                    <feature.icon className="w-6 h-6" />
                  </div>
                  <Badge className={feature.badgeColor}>
                    {index + 1}
                  </Badge>
                </div>
                <CardTitle className="text-xl font-semibold text-gray-900">
                  {feature.title}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-gray-600 leading-relaxed">
                  {feature.description}
                </CardDescription>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Benefits highlight box */}
        <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-3xl p-8 lg:p-12">
          <div className="text-center mb-12">
            <h3 className="text-3xl font-bold text-gray-900 mb-4">
              De ce să alegi SportClub Pro?
            </h3>
            <p className="text-lg text-gray-600">
              Transformă modul în care gestionezi clubul sportiv
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {benefits.map((benefit, index) => (
              <div 
                key={index} 
                className="text-center group hover:transform hover:scale-105 transition-all duration-300"
                style={{ animationDelay: `${index * 0.2}s` }}
              >
                <div className={`w-16 h-16 mx-auto mb-6 ${benefit.color} bg-white rounded-2xl flex items-center justify-center shadow-lg group-hover:shadow-xl transition-all duration-300`}>
                  <benefit.icon className="w-8 h-8" />
                </div>
                <h4 className="text-xl font-semibold text-gray-900 mb-3">
                  {benefit.title}
                </h4>
                <p className="text-gray-600 leading-relaxed">
                  {benefit.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
} 