'use client';

import type { ReactNode } from 'react';
import { useRef, useState } from 'react';
import { getStoredAffiliateRef } from '@/hooks/use-affiliate-ref';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Sparkle, Info } from '@phosphor-icons/react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Button } from '@/components/ui/button';
import { CreditPackCheckout } from '@/components/credits/credit-pack-checkout';
import { cn } from '@/lib/utils';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

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

type PricingTab = 'monthly' | 'yearly' | 'one-time' | 'enterprise';

const ALL_MODELS_INFO =
  'Includes top image models (Nano Banana Pro, Nano Banana 2, GPT Image 2, Seedream 5.0, FLUX.2 Flex), video models (Veo 3.1 Fast, Kling 3.0, Seedance 2.0, Fabric 1.0), and Gemini 3.1 Flash TTS.';

const pageFade = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -6 },
};

const cardList = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.06,
    },
  },
};

const cardFade = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0 },
};

// Stripe live Price IDs, Pro / Max only
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
        info: ALL_MODELS_INFO,
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
      {
        name: 'Unlimited automations',
        info: 'Create as many autopost and workflow automations as you need, no caps on scheduled jobs',
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
        info: ALL_MODELS_INFO,
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
      {
        name: 'Unlimited automations',
        info: 'Create as many autopost and workflow automations as you need, no caps on scheduled jobs',
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
        info: ALL_MODELS_INFO,
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
      {
        name: 'Unlimited automations',
        info: 'Create as many autopost and workflow automations as you need, no caps on scheduled jobs',
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
        info: ALL_MODELS_INFO,
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
      {
        name: 'Unlimited automations',
        info: 'Create as many autopost and workflow automations as you need, no caps on scheduled jobs',
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

/* Experiment: hide Free tier, restore block + Free jump button + freeCardRef + xl:grid-cols-4
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
  {
    name: 'Unlimited automations',
    info: 'No caps on autopost or workflow automations, scale scheduled jobs across your organization',
  },
];

function InfoPopover({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="shrink-0 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          aria-label={label}
        >
          <Info className="w-4 h-4" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="max-w-xs text-sm leading-relaxed" align="end" sideOffset={8}>
        {children}
      </PopoverContent>
    </Popover>
  );
}

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
          <InfoPopover label={`More information about ${feature.name}`}>
            <p>{feature.info}</p>
          </InfoPopover>
        </li>
      ))}
    </ul>
  );
}

function scrollCardIntoView(el: HTMLElement | null) {
  el?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
}

function EnterprisePlanCard({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'relative mx-auto flex h-full w-full max-w-3xl flex-col rounded-lg border-2 border-border bg-card p-8 shadow-lg transition-shadow hover:shadow-xl',
        className
      )}
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
  );
}

export default function PricingPage() {
  const [loading, setLoading] = useState<string | null>(null);
  const [activePricingTab, setActivePricingTab] = useState<PricingTab>('monthly');
  const reduceMotion = useReducedMotion();
  const router = useRouter();
  const supabase = createClient();
  const carouselRef = useRef<HTMLDivElement>(null);
  const proCardRef = useRef<HTMLDivElement>(null);
  const maxCardRef = useRef<HTMLDivElement>(null);

  const isSubscriptionTab = activePricingTab === 'monthly' || activePricingTab === 'yearly';
  const pricingPlans = activePricingTab === 'yearly' ? yearlyPlans : monthlyPlans;
  const headerCopy: Record<PricingTab, { title: string; description: string; footer: string }> = {
    monthly: {
      title: 'Pick Your Plan',
      description: 'Monthly credits, priority access, and integrations for steady creation.',
      footer:
        'Create consistently with credits that stay in your balance, plus priority access and Instagram integrations on higher tiers. Cancel anytime.',
    },
    yearly: {
      title: 'Pick Your Plan',
      description: 'Lock in the best subscription value while receiving credits each month.',
      footer:
        'Get the best value, keep receiving credits each month, and use your balance when your workflow is ready. Manage renewal anytime.',
    },
    'one-time': {
      title: 'Buy Credits',
      description: 'One-time credits for extra generations. They do not expire or change your plan.',
      footer:
        'Top up once and create on your own schedule. Credits do not expire, do not renew, and do not change your current plan.',
    },
    enterprise: {
      title: 'Enterprise',
      description: 'Custom credit volume, support, and terms for teams operating at scale.',
      footer:
        'Enterprise pricing is scoped with your team and can include custom credit volume, security review, invoicing, and implementation support.',
    },
  };
  const activeCopy = headerCopy[activePricingTab];
  const motionTransition = reduceMotion
    ? { duration: 0 }
    : { duration: 0.24, ease: [0.22, 1, 0.36, 1] as const };
  const hoverLift = reduceMotion ? undefined : { y: -4 };

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
        window.location.assign(data.url);
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
        <motion.div
          className="text-center mb-6 sm:mb-8"
          initial={reduceMotion ? false : 'hidden'}
          animate="visible"
          variants={pageFade}
          transition={motionTransition}
        >
          <div className="mx-auto mb-6 flex min-h-[116px] max-w-5xl flex-col items-center justify-center">
            <h1 className="mb-4 text-4xl font-bold uppercase tracking-tight">
              {activeCopy.title}
            </h1>
            <p className="max-w-5xl text-xl text-muted-foreground">
              {activeCopy.description}
            </p>
          </div>

          <Tabs
            value={activePricingTab}
            onValueChange={(value) => setActivePricingTab(value as PricingTab)}
            className="mx-auto flex w-full max-w-xl flex-col items-stretch"
          >
            <TabsList
              variant="default"
              className="!mx-auto grid !h-auto min-h-11 w-full max-w-xl grid-cols-4 gap-1 rounded-4xl border-0 bg-transparent p-1"
            >
              <TabsTrigger
                value="monthly"
                className="flex min-h-9 w-full min-w-0 shrink-0 items-center justify-center rounded-2xl border border-transparent px-1.5 py-2 text-center text-xs font-medium text-muted-foreground transition-[color,box-shadow,border-color,background-color] hover:text-foreground data-active:border-border/80 data-active:bg-background data-active:text-foreground data-active:shadow-sm dark:data-active:border-border/60 dark:data-active:bg-card/90 sm:px-3 sm:text-sm"
              >
                Monthly
              </TabsTrigger>
              <TabsTrigger
                value="yearly"
                className="flex min-h-9 w-full min-w-0 shrink-0 items-center justify-center rounded-2xl border border-transparent px-1.5 py-2 text-center text-xs font-medium text-muted-foreground transition-[color,box-shadow,border-color,background-color] hover:text-foreground data-active:border-border/80 data-active:bg-background data-active:text-foreground data-active:shadow-sm dark:data-active:border-border/60 dark:data-active:bg-card/90 sm:px-3 sm:text-sm"
              >
                <span>Yearly</span>
              </TabsTrigger>
              <TabsTrigger
                value="one-time"
                className="flex min-h-9 w-full min-w-0 shrink-0 items-center justify-center rounded-2xl border border-transparent px-1.5 py-2 text-center text-xs font-medium text-muted-foreground transition-[color,box-shadow,border-color,background-color] hover:text-foreground data-active:border-border/80 data-active:bg-background data-active:text-foreground data-active:shadow-sm dark:data-active:border-border/60 dark:data-active:bg-card/90 sm:px-3 sm:text-sm"
              >
                Credits
              </TabsTrigger>
              <TabsTrigger
                value="enterprise"
                className="flex min-h-9 w-full min-w-0 shrink-0 items-center justify-center rounded-2xl border border-transparent px-1.5 py-2 text-center text-xs font-medium text-muted-foreground transition-[color,box-shadow,border-color,background-color] hover:text-foreground data-active:border-border/80 data-active:bg-background data-active:text-foreground data-active:shadow-sm dark:data-active:border-border/60 dark:data-active:bg-card/90 sm:px-3 sm:text-sm"
              >
                Enterprise
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </motion.div>

        <div>
          {isSubscriptionTab ? (
            <motion.div
              key={activePricingTab}
              initial={reduceMotion ? false : 'hidden'}
              animate="visible"
              exit="exit"
              variants={pageFade}
              transition={motionTransition}
            >
              {/* Mobile plan shortcuts */}
              <div className="mb-4 flex flex-col items-center gap-3 sm:hidden">
                <div className="flex w-full max-w-lg flex-wrap items-center justify-center gap-2">
                  <div
                    className="flex flex-wrap justify-center gap-2"
                    role="group"
                    aria-label="Choose subscription plan to scroll into view"
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
                  </div>
                </div>
              </div>

              {/* Pricing Cards: Pro | Max, mobile: snap carousel, one centered + peek */}
              <motion.div
                ref={carouselRef}
                className={[
                  'flex max-w-5xl mx-auto items-stretch',
                  '-mx-4 flex-row gap-3 overflow-x-auto overscroll-x-contain pb-4 px-[calc((100vw-85vw)/2)] pt-5',
                  'snap-x snap-mandatory scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
                  'sm:mx-auto sm:grid sm:grid-cols-2 sm:gap-6 sm:overflow-visible sm:overscroll-auto sm:pb-0 sm:px-0 sm:pt-0',
                  'sm:snap-none lg:gap-8',
                ].join(' ')}
                variants={cardList}
              >
                {/* Free tier, commented out for experiment; see freeFeatures + freeCardRef above */}

                {pricingPlans.map((plan) => {
                  const listMonthly = monthlyPlans.find((p) => p.name === plan.name)?.price;
                  return (
            <motion.div
              key={plan.id}
              ref={plan.name === 'Pro' ? proCardRef : maxCardRef}
              variants={cardFade}
              transition={motionTransition}
              whileHover={hoverLift}
              className={`relative flex h-full min-h-0 max-sm:snap-center max-sm:shrink-0 max-sm:w-[85vw] max-sm:max-w-md flex-col bg-card rounded-lg border-2 p-8 shadow-lg transition-shadow hover:shadow-xl sm:w-auto sm:max-w-none ${
                plan.popular ? 'z-10 border-primary ring-2 ring-primary/20' : 'border-border'
              }`}
            >
              {plan.popular ? (
                <div className="pointer-events-none absolute left-1/2 top-0 z-20 -translate-x-1/2 -translate-y-1/2">
                  <span className="inline-flex rounded-full bg-primary px-4 py-1 text-sm font-semibold leading-none text-primary-foreground shadow-sm">
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
                <Popover>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      className="flex flex-col items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                      aria-label="Credit usage information"
                    >
                      <div className="flex items-start justify-center gap-1">
                        <span className="flex flex-col items-center gap-0.5 text-center leading-snug">
                          <span>
                            {`~${Math.floor(plan.credits / 4)}-${Math.floor(plan.credits / 2)} Nano Banana images`}
                          </span>
                          <span>
                            {`~${Math.floor(plan.credits / 20)} Kling 3.0 motion control videos`}
                          </span>
                        </span>
                        <Info className="w-3 h-3 shrink-0 mt-0.5" />
                      </div>
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="max-w-sm" align="center" sideOffset={8}>
                    <div className="space-y-2 text-sm">
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
                  </PopoverContent>
                </Popover>
              </div>

              <div className="mt-auto">
                <PlanFeatureList features={plan.features} className="mb-0" />
              </div>
            </motion.div>
            );
                })}
              </motion.div>
            </motion.div>
          ) : activePricingTab === 'one-time' ? (
            <motion.div
              key="one-time"
              initial={reduceMotion ? false : 'hidden'}
              animate="visible"
              exit="exit"
              variants={pageFade}
              transition={motionTransition}
            >
              <CreditPackCheckout redirectPath="/pricing" />
            </motion.div>
          ) : (
            <motion.div
              key="enterprise"
              initial={reduceMotion ? false : 'hidden'}
              animate="visible"
              exit="exit"
              variants={pageFade}
              transition={motionTransition}
              whileHover={hoverLift}
            >
              <EnterprisePlanCard />
            </motion.div>
          )}
        </div>

        {/* Footer Note */}
        <div className="text-center mt-12">
          <motion.p
            key={`${activePricingTab}-footer`}
            className="text-sm text-muted-foreground"
            initial={reduceMotion ? false : { opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={motionTransition}
          >
            {activeCopy.footer}
          </motion.p>
        </div>
      </div>
    </div>
  );
}
