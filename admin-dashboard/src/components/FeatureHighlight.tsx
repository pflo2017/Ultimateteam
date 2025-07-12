import React from 'react';

export default function FeatureHighlight() {
  return (
    <section className="py-20 bg-white">
      <div className="container mx-auto px-4 flex flex-col lg:flex-row items-center justify-between gap-12">
        {/* Left: Text content */}
        <div className="flex-1 max-w-xl">
          <h2 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-6">
            Dashboard intuitiv pentru <span className="text-green-500">control complet</span>
          </h2>
          <p className="text-lg text-gray-600 mb-8">
            Vizualizează toate aspectele importante ale clubului tău dintr-o singură privire. Dashboard-ul nostru oferă o perspectivă clară asupra performanțelor și activităților.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4 mb-8">
            <div className="space-y-4">
              <FeatureItem text="Interfață intuitivă și modernă" />
              <FeatureItem text="Integrare cu sisteme existente" />
              <FeatureItem text="Updates gratuite pe viață" />
            </div>
            <div className="space-y-4">
              <FeatureItem text="Acces de pe orice dispozitiv" />
              <FeatureItem text="Suport tehnic 24/7" />
              <FeatureItem text="Personalizare completă" />
            </div>
          </div>
          <div className="text-gray-400 text-sm flex items-center gap-2">
            <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" className="inline-block mr-1"><rect width="24" height="24" rx="6" fill="#E5E7EB"/><path d="M7 13l3 3 7-7" stroke="#10B981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            Disponibil pe iOS, Android și Web
          </div>
        </div>
        {/* Right: Device mockup */}
        <div className="flex-1 flex justify-center">
          <img
            src="https://placehold.co/400x300?text=Device+Mockup"
            alt="Device mockup"
            className="rounded-3xl shadow-2xl max-w-xs lg:max-w-md"
          />
        </div>
      </div>
    </section>
  );
}

function FeatureItem({ text }: { text: string }) {
  return (
    <div className="flex items-center text-gray-700 text-base">
      <svg className="w-5 h-5 text-green-500 mr-2 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
      </svg>
      {text}
    </div>
  );
} 