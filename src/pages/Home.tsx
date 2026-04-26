import Layout from "@/components/layout/Layout";
import HeroSection from "@/components/marketing/HeroSection";
import StatsBar from "@/components/marketing/StatsBar";
import ProblemSolution from "@/components/marketing/ProblemSolution";
import FeatureGrid from "@/components/marketing/FeatureGrid";
import HowItWorks from "@/components/marketing/HowItWorks";
import NicheShowcase from "@/components/marketing/NicheShowcase";
import ProductCards from "@/components/marketing/ProductCards";
import TestimonialSection from "@/components/marketing/TestimonialSection";
import PricingPreview from "@/components/marketing/PricingPreview";
import CTABanner from "@/components/marketing/CTABanner";

export default function Home() {
  return (
    <Layout>
      <HeroSection />
      <StatsBar />
      <ProblemSolution />
      <FeatureGrid />
      <HowItWorks />
      <NicheShowcase />
      <ProductCards />
      <TestimonialSection />
      <PricingPreview />
      <CTABanner />
    </Layout>
  );
}
