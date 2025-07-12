import { Users, Calendar, CreditCard, Trophy, MessageSquare, BarChart3, Target, TrendingUp, FileText } from "lucide-react";

const features = [
  {
    icon: Users,
    title: "Gestionarea Membrilor",
    description: "Administrează profilurile membrilor, istoricul participărilor și informațiile de contact într-un singur loc organizat.",
    color: "bg-blue-100 text-blue-600"
  },
  {
    icon: Calendar,
    title: "Programare Antrenamente",
    description: "Planifică și organizează antrenamentele automat, cu notificări pentru membri și antrenori.",
    color: "bg-green-100 text-green-600"
  },
  {
    icon: CreditCard,
    title: "Managementul Plăților",
    description: "Procesează plățile în siguranță și ține evidența tuturor tranzacțiilor financiare.",
    color: "bg-purple-100 text-purple-600"
  },
  {
    icon: Trophy,
    title: "Urmărirea Performanței",
    description: "Monitorizează progresul membrilor cu statistici detaliate și rapoarte personalizate.",
    color: "bg-yellow-100 text-yellow-600"
  },
  {
    icon: MessageSquare,
    title: "Comunicare Instantanee",
    description: "Trimite notificări push și mesaje de grup pentru o comunicare eficientă.",
    color: "bg-red-100 text-red-600"
  },
  {
    icon: BarChart3,
    title: "Rapoarte & Analiză",
    description: "Generează rapoarte detaliate pentru a lua decizii informate pentru clubul tău.",
    color: "bg-indigo-100 text-indigo-600"
  }
];

const benefits = [
  {
    icon: Target,
    title: "Organizare Eficientă",
    description: "Elimină haosul din grupurile WhatsApp și notițele pe hârtie cu o organizare centralizată"
  },
  {
    icon: TrendingUp,
    title: "Progres Vizibil",
    description: "Urmărește evoluția membrilor cu statistici clare în loc de estimări aproximative"
  },
  {
    icon: FileText,
    title: "Transparență Totală",
    description: "Rapoarte automate și istoric complet al plăților pentru o administrare transparentă"
  }
];

export default function Features() {
  return (
    <section className="py-20 bg-white">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section header */}
        <div className="text-center mb-16">
          <h2 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-6 font-sans" style={{ fontFamily: 'system-ui, sans-serif' }}>
            Totul de care ai nevoie pentru <span className="bg-gradient-to-r from-[#0CC1EC] to-[#007AFF] bg-clip-text text-transparent">clubul tău</span>
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto font-normal font-sans" style={{ fontFamily: 'system-ui, sans-serif', fontWeight: 400 }}>
            Platformă completă cu funcționalități moderne pentru gestionarea eficientă a clubului sportiv.
          </p>
        </div>

        {/* Features grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-20">
          {features.map((feature, index) => (
            <div key={index} className="bg-white rounded-2xl shadow-lg hover:shadow-xl transition-shadow p-8 text-center group">
              <div className={`mx-auto mb-6 w-16 h-16 flex items-center justify-center rounded-2xl shadow ${feature.color}`}>
                <feature.icon className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-3 font-sans" style={{ fontFamily: 'system-ui, sans-serif' }}>{feature.title}</h3>
              <p className="text-gray-600 leading-relaxed font-normal font-sans" style={{ fontFamily: 'system-ui, sans-serif', fontWeight: 400 }}>{feature.description}</p>
            </div>
          ))}
        </div>

        {/* Benefits highlight box */}
        <div className="bg-gradient-to-r from-[#0CC1EC] to-[#007AFF] text-white rounded-3xl p-8 lg:p-12 shadow-xl">
          <div className="text-center mb-12">
            <h3 className="text-3xl font-bold mb-4 font-sans" style={{ fontFamily: 'system-ui, sans-serif' }}>
              De ce să alegi SportClub Pro?
            </h3>
            <p className="text-lg font-normal font-sans" style={{ fontFamily: 'system-ui, sans-serif', fontWeight: 400 }}>
              Organizare, progres și transparență pentru clubul tău sportiv
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {benefits.map((benefit, index) => (
              <div key={index} className="text-center group hover:scale-105 transition-transform duration-300">
                <div className="w-16 h-16 mx-auto mb-6 bg-white bg-opacity-10 rounded-2xl flex items-center justify-center shadow-lg group-hover:shadow-2xl">
                  <benefit.icon className="w-8 h-8 text-white" />
                </div>
                <h4 className="text-xl font-semibold mb-3 font-sans" style={{ fontFamily: 'system-ui, sans-serif' }}>{benefit.title}</h4>
                <p className="font-normal font-sans" style={{ fontFamily: 'system-ui, sans-serif', fontWeight: 400 }}>{benefit.description}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
} 