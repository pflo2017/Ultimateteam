import { Shield, Users, Heart } from "lucide-react";

const apps = [
  {
    icon: <Shield className="w-8 h-8 text-white bg-[#0CC1EC] rounded-xl p-1.5" />,
    title: "Aplicația Admin",
    subtitle: "Control complet asupra clubului",
    features: [
      "Dashboard complet cu statistici",
      "Rapoarte financiare detaliate",
      "Gestionare membri și echipe",
      "Configurări și setări avansate"
    ],
    color: "bg-[#0CC1EC]"
  },
  {
    icon: <Users className="w-8 h-8 text-white bg-[#0CC1EC] rounded-xl p-1.5" />,
    title: "Aplicația Antrenor",
    subtitle: "Instrumente pentru antrenori",
    features: [
      "Planificare antrenamente",
      "Comunicare cu părinții",
      "Urmărire progres sportivi",
      "Rapoarte de performanță"
    ],
    color: "bg-[#0CC1EC]"
  },
  {
    icon: <Heart className="w-8 h-8 text-white bg-[#0CC1EC] rounded-xl p-1.5" />,
    title: "Aplicația Părinți",
    subtitle: "Conectează familiile",
    features: [
      "Program antrenamente/meciuri",
      "Plăți și facturare",
      "Chat cu antrenorii",
      "Progresul copilului"
    ],
    color: "bg-[#0CC1EC]"
  }
];

export default function DownloadApp() {
  return (
    <section className="py-20 bg-white">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          {/* Left: Phone mockup on soft primary background */}
          <div className="flex justify-center items-center">
            <div className="rounded-3xl bg-[#E6F8FC] p-8 w-full max-w-xl flex justify-center items-center shadow-xl">
              {/* Placeholder phone mockup SVG */}
              <svg width="320" height="240" viewBox="0 0 320 240" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="40" y="20" width="70" height="200" rx="18" fill="#fff" stroke="#0CC1EC" strokeWidth="4" />
                <rect x="125" y="20" width="70" height="200" rx="18" fill="#fff" stroke="#0CC1EC" strokeWidth="4" />
                <rect x="210" y="20" width="70" height="200" rx="18" fill="#fff" stroke="#0CC1EC" strokeWidth="4" />
                <rect x="60" y="40" width="30" height="8" rx="4" fill="#0CC1EC" />
                <rect x="145" y="40" width="30" height="8" rx="4" fill="#0CC1EC" />
                <rect x="230" y="40" width="30" height="8" rx="4" fill="#0CC1EC" />
              </svg>
            </div>
          </div>
          {/* Right: App cards */}
          <div className="flex flex-col gap-8">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4 font-sans" style={{ fontFamily: 'system-ui, sans-serif' }}>
              Aplicații dedicate pentru <span className="bg-gradient-to-r from-[#0CC1EC] to-[#007AFF] bg-clip-text text-transparent">fiecare rol</span>
            </h2>
            <p className="text-lg text-gray-600 mb-6 font-normal font-sans" style={{ fontFamily: 'system-ui, sans-serif', fontWeight: 400 }}>
              Fiecare membru al comunității sportive beneficiază de o experiență optimizată pentru nevoile și responsabilitățile sale specifice.
            </p>
            <div className="flex flex-col gap-6">
              {apps.map((app, idx) => (
                <div key={idx} className="flex flex-col sm:flex-row items-start bg-white rounded-2xl shadow-lg p-6 gap-4">
                  <div className="flex-shrink-0 flex items-center justify-center w-14 h-14 rounded-xl" style={{ background: '#0CC1EC' }}>
                    {app.icon}
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold text-gray-900 mb-1 font-sans" style={{ fontFamily: 'system-ui, sans-serif' }}>{app.title}</h3>
                    <p className="text-gray-600 mb-2 font-normal font-sans" style={{ fontFamily: 'system-ui, sans-serif', fontWeight: 400 }}>{app.subtitle}</p>
                    <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-1 text-gray-700 text-base font-normal font-sans" style={{ fontFamily: 'system-ui, sans-serif', fontWeight: 400 }}>
                      {app.features.map((feature, i) => (
                        <li key={i} className="flex items-center">
                          <span className="inline-block w-2 h-2 rounded-full bg-[#0CC1EC] mr-2"></span>
                          {feature}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
} 