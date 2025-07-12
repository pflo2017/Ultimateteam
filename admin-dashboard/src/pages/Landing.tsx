import Header from '../components/Header'
import Hero from '../components/Hero'
import Features from '../components/Features'
import Testimonials from '../components/Testimonials'
import DownloadApp from '../components/DownloadApp'
import Pricing from '../components/Pricing'
import Footer from '../components/Footer'

export default function Landing() {
  return (
    <div className="min-h-screen">
      <Header />
      <main className="pt-16">
        <Hero />
        <Features />
        <Testimonials />
        <Pricing />
        <DownloadApp />
      </main>
      <Footer />
    </div>
  )
} 