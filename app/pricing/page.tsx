import { PricingSection } from '@/components/landing/pricing-section';
import { currentProduct } from '@/lib/product/current';

const pricingPageVariants = {
  default: PricingSection,
  presence: PricingSection,
}

export default function PricingPage() {
  const ProductPricingSection =
    pricingPageVariants[currentProduct.pageOverrides?.pricing ?? "default"] ??
    pricingPageVariants.default

  return (
    <div className="pt-16 md:pt-[60px]">
      <ProductPricingSection />
    </div>
  );
}
