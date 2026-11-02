import Layout from "@/components/layout/Layout";
import { CapsuleHero } from "@/components/marketing/capsule/CapsuleHero";
import { CapsuleProblem } from "@/components/marketing/capsule/CapsuleProblem";
import { CapsuleFeatures } from "@/components/marketing/capsule/CapsuleFeatures";
import { CapsuleSteps } from "@/components/marketing/capsule/CapsuleSteps";
import { CapsulePricing } from "@/components/marketing/capsule/CapsulePricing";
import { CapsuleCTA } from "@/components/marketing/capsule/CapsuleCTA";
import "@/styles/capsule-theme.css";

export default function Home() {
  return (
    <Layout variant="capsule">
      <CapsuleHero />
      <CapsuleProblem />
      <CapsuleFeatures />
      <CapsuleSteps />
      <CapsulePricing />
      <CapsuleCTA />
    </Layout>
  );
}
