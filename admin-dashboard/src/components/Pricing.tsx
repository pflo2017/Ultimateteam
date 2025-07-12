import Button from "./Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./Card";
import Badge from "./Badge";
import { Check, Star } from "lucide-react"

const plans = [
  {
    name: "Starter",
    price: "99",
    period: "lună",
    description: "Perfect pentru cluburi mici și începători",
    features: [
      "Până la 50 de membri",
      "Programarea antrenamentelor",
      "Notificări push",
      "Rapoarte de bază",
      "Suport prin email"
    ],
    popular: false,
    color: "border-gray-200"
  },
  {
    name: "Professional",
    price: "199",
    period: "lună",
    description: "Soluția completă pentru cluburi în creștere",
    features: [
      "Până la 200 de membri",
      "Toate funcționalitățile Starter",
      "Gestionarea plăților",
      "Rapoarte avansate",
      "Suport prioritare",
      "Integrare API"
    ],
    popular: true,
    color: "border-blue-500"
  },
  {
    name: "Enterprise",
    price: "399",
    period: "lună",
    description: "Pentru cluburi mari și lanțuri sportive",
    features: [
      "Membri nelimitați",
      "Toate funcționalitățile Professional",
      "Personalizare completă",
      "Suport dedicat 24/7",
      "Training și implementare",
      "SLA garantat"
    ],
    popular: false,
    color: "border-purple-500"
  }
]

export default function Pricing() {
  return (
    <section className="py-20 bg-gradient-to-br from-gray-50 to-blue-50" id="pricing">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section header */}
        <div className="text-center mb-16">
          <h2 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-6">
            Planuri <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">Flexibile</span>
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Alege planul perfect pentru clubul tău sportiv. Toate planurile includ 
            funcționalități de bază și suport tehnic.
          </p>
        </div>

        {/* Pricing cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {plans.map((plan, index) => (
            <Card 
              key={index} 
              className={`relative ${plan.color} hover:shadow-xl transition-all duration-300 transform hover:-translate-y-2 ${
                plan.popular ? 'ring-2 ring-blue-500 shadow-lg' : ''
              }`}
            >
              {plan.popular && (
                <Badge className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-gradient-to-r from-blue-600 to-purple-600 text-white">
                  <Star className="w-4 h-4 mr-1" />
                  Cel mai popular
                </Badge>
              )}
              
              <CardHeader className="text-center pb-4">
                <CardTitle className="text-2xl font-bold text-gray-900">
                  {plan.name}
                </CardTitle>
                <CardDescription className="text-gray-600">
                  {plan.description}
                </CardDescription>
                <div className="mt-4">
                  <span className="text-4xl font-bold text-gray-900">
                    {plan.price}€
                  </span>
                  <span className="text-gray-600">/{plan.period}</span>
                </div>
              </CardHeader>
              
              <CardContent>
                <ul className="space-y-3 mb-8">
                  {plan.features.map((feature, featureIndex) => (
                    <li key={featureIndex} className="flex items-center space-x-3">
                      <Check className="w-5 h-5 text-green-500 flex-shrink-0" />
                      <span className="text-gray-700">{feature}</span>
                    </li>
                  ))}
                </ul>
                
                <Button 
                  className={`w-full ${
                    plan.popular 
                      ? 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white' 
                      : 'bg-gray-900 hover:bg-gray-800 text-white'
                  }`}
                >
                  Începe gratuit
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Additional info */}
        <div className="text-center mt-12">
          <p className="text-gray-600 mb-4">
            Toate planurile includ o perioadă de probă gratuită de 14 zile
          </p>
          <p className="text-sm text-gray-500">
            * Prețurile sunt exprimate în euro și nu includ TVA
          </p>
        </div>
      </div>
    </section>
  )
} 