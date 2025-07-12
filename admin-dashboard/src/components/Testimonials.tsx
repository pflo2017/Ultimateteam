import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./Card";
import { Star } from "lucide-react"

const testimonials = [
  {
    name: "Mihai Popescu",
    position: "Manager Club Fotbal",
    company: "FC Viitorul București",
    content: "SportClub Pro a transformat complet modul în care gestionăm clubul. De la programarea antrenamentelor până la urmărirea plăților, totul este acum organizat și eficient.",
    rating: 5,
    delay: "0s"
  },
  {
    name: "Elena Dumitrescu",
    position: "Antrenor Principal",
    company: "Clubul Sportiv Olimpia",
    content: "Comunicarea cu părinții și copiii a devenit mult mai ușoară. Notificările automate și rapoartele detaliate ne ajută să oferim un serviciu de calitate superioară.",
    rating: 5,
    delay: "0.2s"
  },
  {
    name: "Alexandru Ionescu",
    position: "Director Administrativ",
    company: "Academia de Tenis Elite",
    content: "Platforma este intuitivă și ușor de folosit. Rapoartele și statisticile ne oferă o imagine clară asupra performanței clubului și ne ajută să luăm decizii informate.",
    rating: 5,
    delay: "0.4s"
  }
]

export default function Testimonials() {
  return (
    <section className="py-20 bg-gradient-to-br from-gray-50 to-blue-50">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section header */}
        <div className="text-center mb-16">
          <h2 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-6">
            Ce spun <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">clienții noștri</span>
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Cluburile sportive din România care au ales SportClub Pro pentru gestionarea lor
          </p>
        </div>

        {/* Testimonials grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {testimonials.map((testimonial, index) => (
            <Card 
              key={index} 
              className="group hover:shadow-xl transition-all duration-300 transform hover:-translate-y-2 border-0 shadow-lg bg-white"
              style={{ animationDelay: testimonial.delay }}
            >
              <CardHeader className="pb-4">
                <div className="flex items-center space-x-1 mb-4">
                  {[...Array(testimonial.rating)].map((_, i) => (
                    <Star key={i} className="w-5 h-5 fill-yellow-400 text-yellow-400" />
                  ))}
                </div>
                <CardDescription className="text-gray-600 leading-relaxed">
                  "{testimonial.content}"
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white font-semibold">
                    {testimonial.name.split(' ').map(n => n[0]).join('')}
                  </div>
                  <div>
                    <CardTitle className="text-lg font-semibold text-gray-900">
                      {testimonial.name}
                    </CardTitle>
                    <CardDescription className="text-sm text-gray-600">
                      {testimonial.position}
                    </CardDescription>
                    <CardDescription className="text-sm text-blue-600 font-medium">
                      {testimonial.company}
                    </CardDescription>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Stats section */}
        <div className="mt-20 text-center">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="group">
              <div className="text-4xl font-bold text-gray-900 mb-2 group-hover:text-blue-600 transition-colors duration-300">
                50+
              </div>
              <div className="text-lg text-gray-600">
                Cluburi Sportive
              </div>
            </div>
            <div className="group">
              <div className="text-4xl font-bold text-gray-900 mb-2 group-hover:text-purple-600 transition-colors duration-300">
                1000+
              </div>
              <div className="text-lg text-gray-600">
                Membri Activi
              </div>
            </div>
            <div className="group">
              <div className="text-4xl font-bold text-gray-900 mb-2 group-hover:text-green-600 transition-colors duration-300">
                98%
              </div>
              <div className="text-lg text-gray-600">
                Satisfacție Clienți
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
} 