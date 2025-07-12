import { Star } from "lucide-react";

const testimonials = [
  {
    name: "Ana Popescu",
    position: "Director, FC SuperKids",
    quote: "SportClub Pro ne-a economisit ore întregi de administrare. Acum totul este organizat și simplu de urmărit.",
    rating: 5
  },
  {
    name: "Mihai Ionescu",
    position: "Antrenor Principal, CS FutureStars",
    quote: "Comunicarea cu membrii a devenit mult mai eficientă. Recomand cu încredere această platformă.",
    rating: 5
  },
  {
    name: "Elena Dumitrescu",
    position: "Manager, Aqua Sport Club",
    quote: "Interfața este intuitivă și suportul oferit este excepțional. Exact ce căutam pentru clubul nostru.",
    rating: 5
  }
];

export default function Testimonials() {
  return (
    <section className="py-20 bg-gray-50">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section header */}
        <div className="text-center mb-16">
          <h2 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-6 font-sans" style={{ fontFamily: 'system-ui, sans-serif' }}>
            Ce spun <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">clienții noștri</span>
          </h2>
        </div>

        {/* Testimonials grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {testimonials.map((testimonial, index) => (
            <div key={index} className="bg-white rounded-2xl shadow-lg hover:shadow-xl transition-shadow p-8 group">
              <div className="flex items-center mb-4">
                {[...Array(testimonial.rating)].map((_, i) => (
                  <Star key={i} className="w-5 h-5 text-yellow-400 fill-yellow-400" />
                ))}
              </div>
              <p className="text-gray-700 text-lg leading-relaxed mb-6 font-normal font-sans" style={{ fontFamily: 'system-ui, sans-serif', fontWeight: 400 }}>
                “{testimonial.quote}”
              </p>
              <div className="mt-auto">
                <div className="font-semibold text-gray-900 text-lg font-sans" style={{ fontFamily: 'system-ui, sans-serif' }}>{testimonial.name}</div>
                <div className="text-sm text-blue-600 font-medium font-sans" style={{ fontFamily: 'system-ui, sans-serif' }}>{testimonial.position}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
} 