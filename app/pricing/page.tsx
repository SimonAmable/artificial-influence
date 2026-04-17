'use client';

import { useRef, useState } from 'react';
import { getStoredAffiliateRef } from '@/hooks/use-affiliate-ref';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { CaretLeft, CaretRight, Sparkle, Info } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Switch } from '@/components/ui/switch';

type PricingPlan = {
  id: string;
  name: string;
  description: string;
  price: number;
  priceId: string;
  interval: 'month' | 'year';
  currency: 'USD' | 'CAD';
  credits: number;
  features: { name: string; info: string }[];
  popular?: boolean;
  savings?: string;
  priceNote?: string;
};

// Stripe live Price IDs — Pro / Max only
const monthlyPlans: PricingPlan[] = [
  {
    id: 'pro-monthly',
    name: 'Pro',
    description: 'For professional users',
    price: 20.0,
    priceId: 'price_1SrWl8GYRyfMJZ0CeXU9f7LE',
    interval: 'month' as const,
    currency: 'USD' as const,
    credits: 500,
    features: [
      {
        name: 'Access to all AI models',
        info: 'Includes image generation (Nano Banana, FLUX.2 Flex), video generation (Fabric 1.0), and audio models',
      },
      {
        name: 'Concurrent generations',
        info: 'Generate multiple images and videos simultaneously for faster workflow',
      },
      {
        name: 'Early access to new models',
        info: 'Be among the first to try new AI models and features as they are released',
      },
      {
        name: 'Priority support',
        info: 'Get priority email support with faster response times (within 24 hours)',
      },
      {
        name: 'Commercial license',
        info: 'Use generated content for commercial purposes without attribution requirements',
      },
      {
        name: '1 Instagram connection',
        info: 'Connect one Instagram account for publishing and related workflows',
      },
    ],
    popular: true,
  },
  {
    id: 'max-monthly',
    name: 'Max',
    description: 'For power users and teams',
    price: 100.0,
    priceId: 'price_1TIyQeGYRyfMJZ0Cg7gwAPJE',
    interval: 'month' as const,
    currency: 'USD' as const,
    credits: 3000,
    features: [
      {
        name: 'Access to all AI models',
        info: 'Includes image generation (Nano Banana, FLUX.2 Flex), video generation (Fabric 1.0), and audio models',
      },
      {
        name: 'Maximum concurrent generations',
        info: 'Generate multiple videos and images simultaneously for maximum productivity',
      },
      {
        name: 'Early access to advanced features',
        info: 'Get first access to new AI models, features, and experimental capabilities',
      },
      {
        name: 'Dedicated support',
        info: 'Get dedicated support with direct access to our team and priority assistance',
      },
      {
        name: 'Commercial license',
        info: 'Full commercial license to use generated content for any purpose',
      },
      {
        name: 'Priority processing',
        info: 'Your generations are processed with higher priority for faster results',
      },
      {
        name: '10 Instagram connections',
        info: 'Connect up to ten Instagram accounts for teams, brands, or clients',
      },
    ],
  },
];

const yearlyPlans: PricingPlan[] = [
  {
    id: 'pro-yearly',
    name: 'Pro',
    description: 'For professional users',
    price: 160.0,
    priceId: 'price_1SrWmVGYRyfMJZ0CyKUeZ5T9',
    interval: 'year' as const,
    currency: 'USD' as const,
    savings: 'Save 33%',
    credits: 500,
    features: [
      {
        name: 'Access to all AI models',
        info: 'Includes image generation (Nano Banana, FLUX.2 Flex), video generation (Fabric 1.0), and audio models',
      },
      {
        name: 'Concurrent generations',
        info: 'Generate multiple images and videos simultaneously for faster workflow',
      },
      {
        name: 'Early access to new models',
        info: 'Be among the first to try new AI models and features as they are released',
      },
      {
        name: 'Priority support',
        info: 'Get priority email support with faster response times (within 24 hours)',
      },
      {
        name: 'Commercial license',
        info: 'Use generated content for commercial purposes without attribution requirements',
      },
      {
        name: '1 Instagram connection',
        info: 'Connect one Instagram account for publishing and related workflows',
      },
    ],
    popular: true,
  },
  {
    id: 'max-yearly',
    name: 'Max',
    description: 'For power users and teams',
    price: 600.0,
    priceId: 'price_1TIySoGYRyfMJZ0CKCD93aWh',
    interval: 'year' as const,
    currency: 'USD' as const,
    savings: 'Save 50%',
    credits: 3000,
    features: [
      {
        name: 'Access to all AI models',
        info: 'Includes image generation (Nano Banana, FLUX.2 Flex), video generation (Fabric 1.0), and audio models',
      },
      {
        name: 'Maximum concurrent generations',
        info: 'Generate multiple videos and images simultaneously for maximum productivity',
      },
      {
        name: 'Early access to advanced features',
        info: 'Get first access to new AI models, features, and experimental capabilities',
      },
      {
        name: 'Dedicated support',
        info: 'Get dedicated support with direct access to our team and priority assistance',
      },
      {
        name: 'Commercial license',
        info: 'Full commercial license to use generated content for any purpose',
      },
      {
        name: 'Priority processing',
        info: 'Your generations are processed with higher priority for faster results',
      },
      {
        name: '10 Instagram connections',
        info: 'Connect up to ten Instagram accounts for teams, brands, or clients',
      },
    ],
  },
];

const ENTERPRISE_CONTACT_EMAIL =
  process.env.NEXT_PUBLIC_ENTERPRISE_CONTACT_EMAIL ?? 'support@synthetichumanlabs.com';

function formatPlanCurrency(amount: number, currency: 'USD' | 'CAD') {
  const prefix = currency === 'CAD' ? 'CA$' : '$';
  const body = amount % 1 === 0 ? amount.toFixed(0) : amount.toFixed(2);
  return `${prefix}${body}`;
}

/* Experiment: hide Free tier — restore block + Free jump button + freeCardRef + xl:grid-cols-4
const freeFeatures: { name: string; info: string }[] = [
  {
    name: 'Sign up at no cost',
    info: 'Create an account and explore the platform without a subscription',
  },
  {
    name: 'Try core AI tools',
    info: 'Sample image, video, audio, and text workflows with starter access',
  },
  {
    name: 'Canvas & assets',
    info: 'Build simple node workflows and save a limited set of assets',
  },
  {
    name: 'Community pace',
    info: 'Standard queue times; upgrade when you need more volume or priority',
  },
];
*/

const enterpriseFeatures: { name: string; info: string }[] = [
  {
    name: 'Custom credit volume',
    info: 'Negotiated monthly or annual pools tailored to your team or production load',
  },
  {
    name: 'Security & compliance',
    info: 'Discuss SSO, data handling, and procurement requirements with our team',
  },
  {
    name: 'Dedicated success',
    info: 'Named contact, onboarding help, and priority escalation paths',
  },
  {
    name: 'Invoicing & terms',
    info: 'Net payment terms and contracts where your finance team needs them',
  },
  {
    name: 'Unlimited or custom Instagram connections',
    info: 'Typically unlimited Instagram accounts; we can also set a custom limit to match procurement or policy',
  },
];

function PlanFeatureList({ features, className }: { features: { name: string; info: string }[]; className?: string }) {
  return (
    <ul className={cn('space-y-3 mb-8', className)}>
      {features.map((feature, index) => (
        <li key={index} className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-2 flex-1">
            <svg
              className="w-5 h-5 text-primary mt-0.5 shrink-0"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path d="M5 13l4 4L19 7"></path>
            </svg>
            <span className="text-sm">{feature.name}</span>
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
                aria-label="More information"
              >
                <Info className="w-4 h-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent>
              <p className="max-w-xs text-sm">{feature.info}</p>
            </TooltipContent>
          </Tooltip>
        </li>
      ))}
    </ul>
  );
}

function scrollCardIntoView(el: HTMLElement | null) {
  el?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
}

export default function PricingPage() {
  const [loading, setLoading] = useState<string | null>(null);
  const [billingInterval, setBillingInterval] = useState<'month' | 'year'>('month');
  const router = useRouter();
  const supabase = createClient();
  const carouselRef = useRef<HTMLDivElement>(null);
  const proCardRef = useRef<HTMLDivElement>(null);
  const maxCardRef = useRef<HTMLDivElement>(null);
  const enterpriseCardRef = useRef<HTMLDivElement>(null);

  const pricingPlans = billingInterval === 'month' ? monthlyPlans : yearlyPlans;

  const scrollCarouselBy = (direction: 'prev' | 'next') => {
    const el = carouselRef.current;
    if (!el) return;
    const delta = Math.max(280, Math.floor(el.clientWidth * 0.75));
    el.scrollBy({ left: direction === 'next' ? delta : -delta, behavior: 'smooth' });
  };

  const handleSubscribe = async (priceId: string, planId: string) => {
    setLoading(planId);

    try {
      // Check if user is authenticated
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        // Redirect to login if not authenticated
        router.push('/login?redirect=/pricing');
        return;
      }

      // Call checkout API
      const affiliateCode = getStoredAffiliateRef();
      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          priceId,
          ...(affiliateCode ? { affiliateCode } : {}),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create checkout session');
      }

      // Redirect to Stripe Checkout
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (error) {
      console.error('Error:', error);
      alert('Failed to start checkout. Please try again.');
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="min-h-[90vh] pt-20 bg-background to-muted py-4 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-6 sm:mb-8">
          <h1 className="text-4xl font-bold tracking-tight mb-4 uppercase">
            Pick Your Plan
          </h1>
          <p className="text-xl text-muted-foreground mb-6">
            Select the perfect plan for your needs
          </p>
          
          {/* Billing Interval Toggle */}
          <div className="flex flex-col items-center gap-2">
            <div className="flex items-center justify-center gap-4">
              <span className={`text-sm font-medium ${billingInterval === 'month' ? 'text-foreground' : 'text-muted-foreground'}`}>
                Monthly
              </span>
              <Switch
                checked={billingInterval === 'year'}
                onCheckedChange={(checked) => setBillingInterval(checked ? 'year' : 'month')}
              />
              <span className={`text-sm font-medium ${billingInterval === 'year' ? 'text-foreground' : 'text-muted-foreground'}`}>
                Yearly
              </span>
            </div>
            <div
              className="flex min-h-9 w-full items-center justify-center"
              aria-hidden={billingInterval === 'month'}
            >
              {billingInterval === 'year' ? (
                <span className="inline-flex items-center rounded-full border border-green-600/25 bg-green-600/10 px-3 py-1 text-xs font-semibold text-green-700 dark:border-green-400/30 dark:bg-green-400/10 dark:text-green-400">
                  Save up to 50% on yearly plans
                </span>
              ) : null}
            </div>
          </div>
        </div>

        {/* Plan navigation — jump + carousel arrows on small screens */}
        <div className="mb-4 flex flex-col items-center gap-3 sm:mb-6">
          <p className="text-sm text-muted-foreground sm:hidden">Jump to a plan</p>
          <div className="flex w-full max-w-lg flex-wrap items-center justify-center gap-2 sm:max-w-none">
            <div className="flex shrink-0 items-center gap-1 sm:hidden">
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                className="rounded-full"
                aria-label="Scroll plans left"
                onClick={() => scrollCarouselBy('prev')}
              >
                <CaretLeft className="size-4" weight="bold" />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                className="rounded-full"
                aria-label="Scroll plans right"
                onClick={() => scrollCarouselBy('next')}
              >
                <CaretRight className="size-4" weight="bold" />
              </Button>
            </div>
            <div
              className="flex flex-wrap justify-center gap-2"
              role="tablist"
              aria-label="Choose plan to scroll into view"
            >
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="rounded-full"
                onClick={() => scrollCardIntoView(proCardRef.current)}
              >
                Pro
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="rounded-full"
                onClick={() => scrollCardIntoView(maxCardRef.current)}
              >
                Max
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="rounded-full"
                onClick={() => scrollCardIntoView(enterpriseCardRef.current)}
              >
                Enterprise
              </Button>
            </div>
          </div>
        </div>

        {/* Pricing Cards: Pro | Max | Enterprise — mobile: snap carousel, one centered + peek */}
        <div
          ref={carouselRef}
          className={[
            'flex max-w-7xl mx-auto items-stretch',
            '-mx-4 flex-row gap-3 overflow-x-auto overscroll-x-contain pb-4 px-[calc((100vw-85vw)/2)] pt-1',
            'snap-x snap-mandatory scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
            'sm:mx-0 sm:grid sm:grid-cols-2 sm:gap-6 sm:overflow-visible sm:overscroll-auto sm:pb-0 sm:px-0 sm:pt-0',
            'sm:snap-none lg:gap-8 xl:grid-cols-3',
          ].join(' ')}
        >
          {/* Free tier — commented out for experiment; see freeFeatures + freeCardRef above */}

          {pricingPlans.map((plan) => {
            const listMonthly = monthlyPlans.find((p) => p.name === plan.name)?.price;
            return (
            <div
              key={plan.id}
              ref={plan.name === 'Pro' ? proCardRef : maxCardRef}
              className={`relative flex h-full min-h-0 max-sm:snap-center max-sm:shrink-0 max-sm:w-[85vw] max-sm:max-w-md flex-col bg-card rounded-lg border-2 p-8 shadow-lg transition-shadow hover:shadow-xl sm:w-auto sm:max-w-none ${
                plan.popular ? 'z-10 border-primary ring-2 ring-primary/20' : 'border-border'
              }`}
            >
              {plan.popular ? (
                <div className="mb-4 flex justify-center">
                  <span className="rounded-full bg-primary px-4 py-1 text-sm font-semibold text-primary-foreground">
                    Most Popular
                  </span>
                </div>
              ) : null}

              <div className="text-center mb-6">
                <h2 className="text-2xl font-bold mb-2">{plan.name}</h2>
                <p className="text-muted-foreground mb-4">{plan.description}</p>
                <div className="flex flex-col items-center gap-1">
                  {plan.interval === 'year' && listMonthly != null ? (
                    <div
                      className="flex flex-col items-center gap-2 w-full"
                      aria-label={`${formatPlanCurrency(plan.price / 12, plan.currency)} per month, billed annually (${formatPlanCurrency(plan.price, plan.currency)} per year), compared to ${formatPlanCurrency(listMonthly, plan.currency)} per month on the monthly plan`}
                    >
                      <div className="flex items-baseline justify-center gap-2 flex-wrap">
                        <span className="text-3xl sm:text-4xl font-bold text-primary line-through decoration-2 decoration-primary">
                          {formatPlanCurrency(listMonthly, plan.currency)}
                        </span>
                        <span className="text-5xl font-bold tracking-tight text-foreground">
                          {formatPlanCurrency(plan.price / 12, plan.currency)}
                        </span>
                        <span className="text-muted-foreground text-base font-medium">
                          /month, billed annually
                        </span>
                      </div>
                    </div>
                  ) : plan.interval === 'year' ? (
                    <div className="flex items-baseline justify-center gap-1">
                      <span className="text-5xl font-bold">
                        {formatPlanCurrency(plan.price, plan.currency)}
                      </span>
                      <span className="text-muted-foreground">/year</span>
                    </div>
                  ) : (
                    <div className="flex items-baseline justify-center gap-1">
                      <span className="text-5xl font-bold">
                        {formatPlanCurrency(plan.price, plan.currency)}
                      </span>
                      <span className="text-muted-foreground">/{plan.interval}</span>
                    </div>
                  )}
                  {plan.priceNote ? (
                    <span className="text-xs text-muted-foreground">{plan.priceNote}</span>
                  ) : null}
                  {plan.savings ? (
                    <span className="inline-flex items-center rounded-full border border-green-600/25 bg-green-600/10 px-3 py-1 text-xs font-semibold text-green-700 dark:border-green-400/30 dark:bg-green-400/10 dark:text-green-400">
                      {plan.savings}
                    </span>
                  ) : null}
                </div>
              </div>

              <button
                onClick={() => handleSubscribe(plan.priceId, plan.id)}
                disabled={loading === plan.id}
                className={`w-full py-3 px-6 rounded-lg font-semibold transition-colors mb-6 ${
                  plan.popular
                    ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                    : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {loading === plan.id ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg
                      className="animate-spin h-5 w-5"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      ></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      ></path>
                    </svg>
                    Processing...
                  </span>
                ) : (
                  'Subscribe'
                )}
              </button>

              <div className="flex flex-col items-center gap-2 mb-6">
                <div className="flex items-center justify-center gap-2">
                  <Sparkle className="w-5 h-5 text-primary" weight="fill" />
                  <span className="text-lg font-semibold text-primary">
                    {plan.credits} credits per month
                  </span>
                </div>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      className="text-xs text-muted-foreground hover:text-foreground transition-colors flex flex-col items-center gap-1"
                      aria-label="Credit usage information"
                    >
                      <div className="flex items-start justify-center gap-1">
                        <span className="flex flex-col items-center gap-0.5 text-center leading-snug">
                          <span>
                            {`~${Math.floor(plan.credits / 4)}–${Math.floor(plan.credits / 2)} Nano Banana images`}
                          </span>
                          <span>
                            {`~${Math.floor(plan.credits / 20)} Kling 3.0 motion control videos`}
                          </span>
                        </span>
                        <Info className="w-3 h-3 shrink-0 mt-0.5" />
                      </div>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-sm">
                    <div className="text-sm space-y-2">
                      <p className="font-medium">Example credit costs</p>
                      <ul className="list-disc space-y-1 pl-4 text-muted-foreground">
                        <li>2 credits = 1 Google Nano Banana image</li>
                        <li>4 credits = 1 Nano Banana 2 or Nano Banana Pro image</li>
                        <li>20 credits = 1 Kling 3.0 motion control video</li>
                      </ul>
                      <p className="text-xs text-muted-foreground">
                        Totals above use these examples; other models use different amounts.
                      </p>
                    </div>
                  </TooltipContent>
                </Tooltip>
              </div>

              <div className="mt-auto">
                <PlanFeatureList features={plan.features} className="mb-0" />
              </div>
            </div>
            );
          })}

          {/* Enterprise */}
          <div
            ref={enterpriseCardRef}
            className="relative flex h-full min-h-0 max-sm:snap-center max-sm:shrink-0 max-sm:w-[85vw] max-sm:max-w-md flex-col bg-card rounded-lg border-2 border-border p-8 shadow-lg transition-shadow hover:shadow-xl sm:w-auto sm:max-w-none"
          >
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold mb-2">Enterprise</h2>
              <p className="text-muted-foreground mb-4">For organizations at scale</p>
              <div className="flex flex-col items-center gap-1">
                <span className="text-3xl font-bold tracking-tight">Custom</span>
                <span className="text-sm text-muted-foreground">Let&apos;s scope your needs</span>
              </div>
            </div>
            <a
              href={`mailto:${ENTERPRISE_CONTACT_EMAIL}?subject=${encodeURIComponent('Enterprise plan inquiry')}`}
              className="w-full py-3 px-6 rounded-lg font-semibold transition-colors mb-6 text-center bg-secondary text-secondary-foreground hover:bg-secondary/80 inline-block"
            >
              Contact us
            </a>
            <div className="flex flex-col items-center gap-2 mb-6">
              <p className="text-sm text-muted-foreground text-center">
                Volume pricing, security reviews, and tailored terms
              </p>
            </div>
            <div className="mt-auto">
              <PlanFeatureList features={enterpriseFeatures} className="mb-0" />
            </div>
          </div>
        </div>

        {/* Footer Note */}
        <div className="text-center mt-12">
          <p className="text-sm text-muted-foreground">
            Cancel anytime. No long-term commitments. Higher tiers add more credits, priority, and integrations such as Instagram connections.
          </p>
        </div>
      </div>
    </div>
  );
}
