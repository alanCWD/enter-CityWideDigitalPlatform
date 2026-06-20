import Layout from "@/components/layout/Layout";
import HeroSection from "@/components/marketing/HeroSection";
import ProblemSolution from "@/components/marketing/ProblemSolution";
import FeatureGrid from "@/components/marketing/FeatureGrid";
import HowItWorks from "@/components/marketing/HowItWorks";
import PricingPreview from "@/components/marketing/PricingPreview";
import CTABanner from "@/components/marketing/CTABanner";

export default function Home() {
  return (
    <Layout>
      <HeroSection />
      <ProblemSolution />
      <FeatureGrid />
      <HowItWorks />
      <PricingPreview />
      <CTABanner />
    </Layout>
  );
}

