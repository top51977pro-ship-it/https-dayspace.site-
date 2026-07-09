import Nav from './components/Nav'
import Hero from './components/Hero'
import About from './components/About'
import WhyDaySpace from './components/WhyDaySpace'
import HowItWorks from './components/HowItWorks'
import Showcase from './components/Showcase'
import WhyDifferent from './components/WhyDifferent'
import FeatureStrip from './components/FeatureStrip'
import FAQ from './components/FAQ'
import Download from './components/Download'
import Footer from './components/Footer'

export default function App() {
  return (
    <>
      <a href="#hero" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:right-2 focus:bg-white focus:px-3 focus:py-2 focus:rounded-lg focus:shadow z-50">
        דלג לתוכן
      </a>
      <Nav />
      <main id="hero">
        <Hero />
        <About />
        <WhyDaySpace />
        <HowItWorks />
        <Showcase />
        <WhyDifferent />
        <FeatureStrip />
        <FAQ />
        <Download />
      </main>
      <Footer />
    </>
  )
}
