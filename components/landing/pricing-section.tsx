'use client';

import type { ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { getStoredAffiliateRef } from '@/hooks/use-affiliate-ref';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { CaretDown, Info } from '@phosphor-icons/react';
import { motion, useReducedMotion } from 'motion/react';
import { Button } from '@/components/ui/button';
import { CreditPackGrid } from '@/components/credits/credit-pack-grid';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { isPresenceProduct } from '@/lib/product/require-presence';
import { currentProduct } from '@/lib/product/current';
import { mapInternalPlanToFanvue } from '@/lib/fanvue/app-store';
import { fetchFanvueBillingUrl } from '@/lib/fanvue/open-billing-client';
import { getFanvuePlanCtaState } from '@/lib/fanvue/plan-cta';
import { FANVUE_PLAN_PRICES_USD, FANVUE_MONTHLY_CREDITS } from '@/lib/fanvue/billing-config';
import {
  getFeaturedPlanEstimates,
  getModelEstimateLines,
} from '@/lib/pricing-output-estimates';
import { getPlanCtaState } from '@/lib/pricing-plan-cta';
import type { PlanCtaKind } from '@/lib/pricing-plan-cta';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { FOUNDER_NOTE_PHOTO_SRC } from '@/lib/onboarding/founder-note';

const FOUNDER_X_PROFILE_HREF = 'https://x.com/Simoncodingshit' as const;
const FOUNDER_X_PROOF_POST_HREF =
  'https://x.com/Simoncodingshit/status/2051864111655330245?s=20' as const;

type PlanFeature = {
  name: string;
  info: string;
  /** Rich popover body; falls back to a paragraph of `info` when omitted */
  infoContent?: ReactNode;
};

type PricingPlan = {
  id: string;
  name: string;
  description: string;
  price: number;
  priceId?: string;
  interval: 'month' | 'year';
  currency: 'USD' | 'CAD';
  credits: number;
  features: PlanFeature[];
  popular?: boolean;
  priceNote?: string;
  ctaLabel?: string;
  ctaHref?: string;
  creditsLabel?: string;
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

function PersonalSupportPopoverBody() {
  const isPresence = isPresenceProduct()
  const productName = isPresence ? "Presence Studio" : "UniCan"

  return (
    <div className="space-y-3 text-sm leading-relaxed">
      <div className="flex gap-3">
        <Image
          src={FOUNDER_NOTE_PHOTO_SRC}
          alt={`Simon, founder of ${productName}`}
          width={48}
          height={48}
          className="h-12 w-12 shrink-0 rounded-full border-2 border-border object-cover"
        />
        <div className="min-w-0 flex-1 space-y-0.5">
          <p className="font-semibold leading-tight text-foreground">Simon</p>
          <p className="text-xs text-muted-foreground">Founder, {productName}</p>
        </div>
      </div>
      <p className="text-muted-foreground">
        Personal support means you reach me directly—not a generic queue. Bugs, billing questions, and
        feature ideas land in my inbox and I aim to reply within 24 hours.
      </p>
      <blockquote className="border-l-2 border-primary/45 pl-3 text-muted-foreground italic">
        {isPresence ? (
          <>
            &ldquo;I use Presence Studio every day for AI influencer workflows—if something feels off or
            you want a feature and you&apos;re not sure it&apos;s worth asking, please just tell me. I
            usually ship fixes and requests within 24 hours.&rdquo;
          </>
        ) : (
          <>
            &ldquo;I really do use UniCan every day as my main marketing tool—if something feels off or
            you want a feature and you&apos;re not sure it&apos;s worth asking, please just tell me. I
            usually ship fixes and requests within 24 hours.&rdquo;
          </>
        )}
      </blockquote>
      {!isPresence ? (
        <div className="flex flex-col gap-2 border-t border-border/60 pt-2">
          <Link
            href={FOUNDER_X_PROFILE_HREF}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-primary underline underline-offset-4 transition-opacity hover:opacity-80"
          >
            Follow me on X
          </Link>
          <Link
            href={FOUNDER_X_PROOF_POST_HREF}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-medium text-primary underline underline-offset-4 transition-opacity hover:opacity-80"
          >
            See the proof on X
          </Link>
        </div>
      ) : null}
    </div>
  );
}

const personalSupportFeature: PlanFeature = {
  name: 'Personal support',
  info: 'Direct replies from Simon, founder—typically within 24 hours. Links to X in the details.',
  infoContent: <PersonalSupportPopoverBody />,
};

const freePlan: PricingPlan = {
  id: 'free-monthly',
  name: 'Free',
  description: 'Try for free. No commitment.',
  price: 0,
  interval: 'month',
  currency: 'USD',
  credits: 10,
  ctaLabel: 'Start free',
  ctaHref: '/login?mode=signup',
  creditsLabel: '10 credits',
  features: [
    {
      name: 'Limited access to image tools',
      info: 'Try the core image workflow with a small starter balance.',
    },
    {
      name: '10 testing credits',
      info: 'Enough for about 2 image tests so you can verify the flow.',
    },
    {
      name: 'Upgrade when ready',
      info: 'Move into a paid plan when you need more generations and broader access.',
    },
  ],
};

const monthlyPlans: PricingPlan[] = [
  freePlan,
  {
    id: 'starter-monthly',
    name: 'Starter',
    description: 'For getting started',
    price: 20.0,
    priceId: 'price_1TQK3qGYRyfMJZ0CFGGqUXJ8',
    interval: 'month' as const,
    currency: 'USD' as const,
    credits: 400,
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
      personalSupportFeature,
      {
        name: 'Commercial license',
        info: 'Use generated content for commercial purposes without attribution requirements',
      },
      {
        name: 'Unlimited Instagram & TikTok connections',
        info: 'Connect as many Instagram and TikTok accounts as you need for publishing, autopost, and related workflows',
      },
      {
        name: 'Unlimited automations',
        info: 'Create as many autopost and workflow automations as you need, no caps on scheduled jobs',
      },
    ],
  },
  {
    id: 'plus-monthly',
    name: 'Plus',
    description: 'For growing creators',
    price: 39.0,
    priceId: 'price_1TQIqwGYRyfMJZ0CivzObR67',
    interval: 'month' as const,
    currency: 'USD' as const,
    credits: 1000,
    features: [
      {
        name: 'Access to all AI models',
        info: ALL_MODELS_INFO,
      },
      {
        name: 'Expanded concurrent generations',
        info: 'Run more image and video generations in parallel as your production volume grows',
      },
      {
        name: 'Early access to new models',
        info: 'Be among the first to try new AI models and features as they are released',
      },
      personalSupportFeature,
      {
        name: 'Commercial license',
        info: 'Use generated content for commercial purposes without attribution requirements',
      },
      {
        name: 'Unlimited Instagram & TikTok connections',
        info: 'Connect as many Instagram and TikTok accounts as you need for publishing, autopost, and related workflows',
      },
      {
        name: 'Unlimited automations',
        info: 'Create as many autopost and workflow automations as you need, no caps on scheduled jobs',
      },
    ],
    popular: true,
  },
  // Max monthly plan hidden for conversion test — re-enable to restore
  // {
  //   id: 'max-monthly',
  //   name: 'Max',
  //   description: 'For power users and teams',
  //   price: 200.0,
  //   priceId: 'price_1TQIsxGYRyfMJZ0CzYtrgkNP',
  //   interval: 'month' as const,
  //   currency: 'USD' as const,
  //   credits: 6000,
  //   features: [
  //     {
  //       name: 'Access to all AI models',
  //       info: ALL_MODELS_INFO,
  //     },
  //     {
  //       name: 'Maximum concurrent generations',
  //       info: 'Generate multiple videos and images simultaneously for maximum productivity',
  //     },
  //     {
  //       name: 'Early access to advanced features',
  //       info: 'Get first access to new AI models, features, and experimental capabilities',
  //     },
  //     personalSupportFeature,
  //     {
  //       name: 'Commercial license',
  //       info: 'Full commercial license to use generated content for any purpose',
  //     },
  //     {
  //       name: 'Priority processing',
  //       info: 'Your generations are processed with higher priority for faster results',
  //     },
  //     {
  //       name: 'Unlimited Instagram & TikTok connections',
  //       info: 'Connect as many Instagram and TikTok accounts as you need for publishing, autopost, and related workflows',
  //     },
  //     {
  //       name: 'Unlimited automations',
  //       info: 'Create as many autopost and workflow automations as you need, no caps on scheduled jobs',
  //     },
  //   ],
  //   },
];

const presenceMonthlyPlans: PricingPlan[] = [
  freePlan,
  {
    ...monthlyPlans[1],
    id: 'starter-monthly',
    name: 'Starter',
    price: FANVUE_PLAN_PRICES_USD.starter,
    priceId: undefined,
    credits: FANVUE_MONTHLY_CREDITS.starter,
    creditsLabel: `${FANVUE_MONTHLY_CREDITS.starter} credits / month`,
  },
  {
    ...monthlyPlans[2],
    id: 'pro-monthly',
    name: 'Pro',
    price: FANVUE_PLAN_PRICES_USD.pro,
    priceId: undefined,
    credits: FANVUE_MONTHLY_CREDITS.pro,
    creditsLabel: `${FANVUE_MONTHLY_CREDITS.pro} credits / month`,
    popular: true,
  },
];

const yearlyPlans: PricingPlan[] = [
  {
    ...freePlan,
    id: 'free-yearly',
  },
  {
    id: 'starter-yearly',
    name: 'Starter',
    description: 'For getting started',
    price: 240.0,
    priceId: 'price_1TQK4BGYRyfMJZ0CdR1RMtUm',
    interval: 'year' as const,
    currency: 'USD' as const,
    credits: 400,
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
      personalSupportFeature,
      {
        name: 'Commercial license',
        info: 'Use generated content for commercial purposes without attribution requirements',
      },
      {
        name: 'Unlimited Instagram & TikTok connections',
        info: 'Connect as many Instagram and TikTok accounts as you need for publishing, autopost, and related workflows',
      },
      {
        name: 'Unlimited automations',
        info: 'Create as many autopost and workflow automations as you need, no caps on scheduled jobs',
      },
    ],
  },
  {
    id: 'plus-yearly',
    name: 'Plus',
    description: 'For growing creators',
    price: 360.0,
    priceId: 'price_1TQIrfGYRyfMJZ0C7s5GmQSw',
    interval: 'year' as const,
    currency: 'USD' as const,
    credits: 1000,
    features: [
      {
        name: 'Access to all AI models',
        info: ALL_MODELS_INFO,
      },
      {
        name: 'Expanded concurrent generations',
        info: 'Run more image and video generations in parallel as your production volume grows',
      },
      {
        name: 'Early access to new models',
        info: 'Be among the first to try new AI models and features as they are released',
      },
      personalSupportFeature,
      {
        name: 'Commercial license',
        info: 'Use generated content for commercial purposes without attribution requirements',
      },
      {
        name: 'Unlimited Instagram & TikTok connections',
        info: 'Connect as many Instagram and TikTok accounts as you need for publishing, autopost, and related workflows',
      },
      {
        name: 'Unlimited automations',
        info: 'Create as many autopost and workflow automations as you need, no caps on scheduled jobs',
      },
    ],
    popular: true,
  },
  // Max yearly plan hidden for conversion test — re-enable to restore
  // {
  //   id: 'max-yearly',
  //   name: 'Max',
  //   description: 'For power users and teams',
  //   price: 792.0,
  //   priceId: 'price_1TQKZwGYRyfMJZ0CcVI6e5wM',
  //   interval: 'year' as const,
  //   currency: 'USD' as const,
  //   credits: 6000,
  //   features: [
  //     {
  //       name: 'Access to all AI models',
  //       info: ALL_MODELS_INFO,
  //     },
  //     {
  //       name: 'Maximum concurrent generations',
  //       info: 'Generate multiple videos and images simultaneously for maximum productivity',
  //     },
  //     {
  //       name: 'Early access to advanced features',
  //       info: 'Get first access to new AI models, features, and experimental capabilities',
  //     },
  //     personalSupportFeature,
  //     {
  //       name: 'Commercial license',
  //       info: 'Full commercial license to use generated content for any purpose',
  //     },
  //     {
  //       name: 'Priority processing',
  //       info: 'Your generations are processed with higher priority for faster results',
  //     },
  //     {
  //       name: 'Unlimited Instagram & TikTok connections',
  //       info: 'Connect as many Instagram and TikTok accounts as you need for publishing, autopost, and related workflows',
  //     },
  //     {
  //       name: 'Unlimited automations',
  //       info: 'Create as many autopost and workflow automations as you need, no caps on scheduled jobs',
  //     },
  //   ],
  // },
];

const ENTERPRISE_CONTACT_EMAIL =
  process.env.NEXT_PUBLIC_ENTERPRISE_CONTACT_EMAIL ?? 'support@synthetichumanlabs.com';

function formatPlanCurrency(amount: number, currency: 'USD' | 'CAD') {
  const prefix = currency === 'CAD' ? 'CA$' : '$';
  const body = amount % 1 === 0 ? amount.toFixed(0) : amount.toFixed(2);
  return `${prefix}${body}`;
}

const enterpriseFeatures: PlanFeature[] = [
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
    name: 'Unlimited or custom social connections',
    info: 'Typically unlimited Instagram and TikTok accounts; we can also set a custom limit to match procurement or policy',
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
  const [open, setOpen] = useState(false);
  const closeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (closeTimeoutRef.current) {
        clearTimeout(closeTimeoutRef.current);
      }
    };
  }, []);

  const clearCloseTimeout = () => {
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
  };

  const handleMouseEnter = () => {
    clearCloseTimeout();
    setOpen(true);
  };

  const handleMouseLeave = () => {
    clearCloseTimeout();
    closeTimeoutRef.current = setTimeout(() => {
      setOpen(false);
      closeTimeoutRef.current = null;
    }, 120);
  };

  return (
    <Popover
      open={open}
      onOpenChange={(nextOpen) => {
        clearCloseTimeout();
        setOpen(nextOpen);
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          className="shrink-0 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          aria-label={label}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          <Info className="w-4 h-4" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="max-w-sm text-sm leading-relaxed"
        align="end"
        sideOffset={8}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {children}
      </PopoverContent>
    </Popover>
  );
}

function PlanFeatureList({ features, className }: { features: PlanFeature[]; className?: string }) {
  return (
    <ul className={cn('mb-6 space-y-2.5', className)}>
      {features.map((feature, index) => (
        <li key={index} className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-2 flex-1">
            <svg
              className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground/80"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path d="M5 13l4 4L19 7"></path>
            </svg>
            <span className="text-sm text-foreground/90">{feature.name}</span>
          </div>
          <InfoPopover label={`More information about ${feature.name}`}>
            {feature.infoContent ?? <p>{feature.info}</p>}
          </InfoPopover>
        </li>
      ))}
    </ul>
  );
}

function getSubscriptionCardBullets(plan: PricingPlan) {
  const isPresence = isPresenceProduct();

  switch (plan.name) {
    case 'Free':
      return ['All AI models', 'Personal use license', 'Community support'];
    case 'Starter':
      return isPresence
        ? ['All AI models', 'Commercial license', 'Unlimited Fanvue connections']
        : ['All AI models', 'Commercial license', 'Unlimited Instagram & TikTok connections'];
    case 'Plus':
      return ['Everything in Starter', 'Priority support', 'Faster generations and more concurrency'];
    default:
      return ['Custom credit volume', 'Dedicated support', 'Tailored terms and onboarding'];
  }
}

function PlanCreditEstimates({
  credits,
  creditsLabel,
  hideVideoEstimate = false,
}: {
  credits: number;
  creditsLabel?: string;
  hideVideoEstimate?: boolean;
}) {
  const featured = getFeaturedPlanEstimates(credits);
  const modelLines = getModelEstimateLines(credits);

  return (
    <div className="rounded-xl border border-border/60 bg-muted/20 p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground/90">
            {creditsLabel ?? `${credits} credits / month`}
          </p>
          <p className="text-xs text-muted-foreground">Credits never expire</p>
        </div>
        <InfoPopover label="See what you can create with these credits">
          <div className="space-y-3">
            <p className="font-medium text-foreground">With these credits you can create about</p>
            <ul className="space-y-1.5 text-muted-foreground">
              {modelLines.map((line) => (
                <li key={line.id}>{line.label}</li>
              ))}
            </ul>
            <p className="border-t border-border/60 pt-2 text-xs text-muted-foreground">
              Estimates use typical defaults. Exact use depends on model settings and length.
            </p>
          </div>
        </InfoPopover>
      </div>
      <div className="mt-2 space-y-0.5">
        <p className="text-xs leading-relaxed text-muted-foreground">{featured.imageLine}</p>
        <p
          className="text-xs leading-relaxed text-muted-foreground"
          aria-hidden={hideVideoEstimate}
        >
          {hideVideoEstimate ? '\u00A0' : featured.videoLine}
        </p>
      </div>
    </div>
  );
}

function PricingSpinner() {
  return (
    <svg
      className="h-5 w-5 animate-spin"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      aria-hidden
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}

function PlanCardCta({
  cta,
  loading,
  pending,
  onCheckout,
  onPortal,
  signupHref,
  popular,
}: {
  cta: { kind: PlanCtaKind; label: string } | null;
  loading: boolean;
  pending: boolean;
  onCheckout: () => void;
  onPortal: () => void;
  signupHref: string;
  popular: boolean;
}) {
  if (pending || !cta) {
    return (
      <div
        className="h-[50px] w-full animate-pulse rounded-2xl bg-muted/50"
        aria-hidden
      />
    );
  }

  if (cta.kind === 'current' || cta.kind === 'inactive') {
    return (
      <button
        type="button"
        disabled
        className={cn(
          'w-full cursor-default rounded-2xl px-6 py-3 font-semibold',
          cta.kind === 'current'
            ? 'border border-primary/25 bg-primary/5 text-primary'
            : 'border border-border/60 bg-muted/30 text-muted-foreground'
        )}
      >
        {cta.label}
      </button>
    );
  }

  if (cta.kind === 'signup') {
    return (
      <Link
        href={signupHref}
        className={cn(
          'inline-flex w-full items-center justify-center rounded-2xl px-6 py-3 text-center font-semibold shadow-sm shadow-black/10 transition-all hover:shadow-md',
          'bg-secondary text-secondary-foreground hover:bg-secondary/80'
        )}
      >
        {cta.label}
      </Link>
    );
  }

  const isPortal = cta.kind === 'portal';
  const handleClick = isPortal ? onPortal : onCheckout;

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      className={cn(
        'w-full rounded-2xl px-6 py-3 font-semibold shadow-sm shadow-black/10 transition-all hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50',
        popular && !isPortal
          ? 'bg-primary text-primary-foreground hover:bg-primary/90'
          : isPortal
            ? 'border border-border bg-background text-foreground hover:bg-muted/60'
            : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
      )}
    >
      {loading ? (
        <span className="flex items-center justify-center gap-2">
          <PricingSpinner />
          Processing...
        </span>
      ) : (
        cta.label
      )}
    </button>
  );
}

type ComparisonCell = string;

type ComparisonRow = {
  feature: string;
  free: ComparisonCell;
  starter: ComparisonCell;
  plus: ComparisonCell;
};

function getPlanComparisonRows(
  starterCredits: number,
  paidCredits: number,
  isPresence = false,
): ComparisonRow[] {
  const free = getFeaturedPlanEstimates(freePlan.credits);
  const starter = getFeaturedPlanEstimates(starterCredits);
  const plus = getFeaturedPlanEstimates(paidCredits);

  return [
    {
      feature: 'Monthly credits',
      free: String(freePlan.credits),
      starter: starterCredits.toLocaleString(),
      plus: paidCredits.toLocaleString(),
    },
    {
      feature: 'NB2 images',
      free: `Up to ${free.nanoBanana2LiteImages}`,
      starter: `Up to ${starter.nanoBanana2LiteImages}`,
      plus: `Up to ${plus.nanoBanana2LiteImages}`,
    },
    {
      feature: 'Veo 3.1 Fast (5s)',
      free: `Approx. ${free.veo5sVideos}`,
      starter: `Approx. ${starter.veo5sVideos}`,
      plus: `Approx. ${plus.veo5sVideos}`,
    },
    {
      feature: 'Commercial license',
      free: 'Personal use',
      starter: 'Yes',
      plus: 'Yes',
    },
    {
      feature: 'Support',
      free: 'Community',
      starter: 'Personal',
      plus: 'Priority',
    },
    {
      feature: 'Concurrent generations',
      free: 'Standard',
      starter: 'Standard',
      plus: 'Expanded',
    },
    {
      feature: isPresence ? 'Fanvue' : 'Instagram & TikTok',
      free: '—',
      starter: 'Unlimited',
      plus: 'Unlimited',
    },
    {
      feature: 'Automations',
      free: '—',
      starter: 'Unlimited',
      plus: 'Unlimited',
    },
  ];
}

function PlanComparisonDetails({ proLabel = 'Plus' }: { proLabel?: string }) {
  const [open, setOpen] = useState(false);
  const isPresence = isPresenceProduct();
  const rows = getPlanComparisonRows(
    isPresence ? FANVUE_MONTHLY_CREDITS.starter : 400,
    isPresence ? FANVUE_MONTHLY_CREDITS.pro : 1000,
    isPresence,
  );

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="mt-10">
      <div className="flex justify-center">
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            Compare plan details
            <CaretDown
              className={cn('h-3.5 w-3.5 transition-transform', open && 'rotate-180')}
              weight="bold"
            />
          </button>
        </CollapsibleTrigger>
      </div>
      <CollapsibleContent className="mt-6 data-[state=closed]:animate-out data-[state=open]:animate-in">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[32rem] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="py-3 pr-4 font-medium text-muted-foreground">Feature</th>
                <th className="px-3 py-3 font-medium text-foreground">Free</th>
                <th className="px-3 py-3 font-medium text-foreground">Starter</th>
                <th className="px-3 py-3 font-medium text-foreground">{proLabel}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.feature} className="border-b border-border/60">
                  <th scope="row" className="py-3 pr-4 font-normal text-foreground/90">
                    {row.feature}
                  </th>
                  <td className="px-3 py-3 text-muted-foreground">{row.free}</td>
                  <td className="px-3 py-3 text-muted-foreground">{row.starter}</td>
                  <td className="px-3 py-3 text-muted-foreground">{row.plus}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-center text-xs text-muted-foreground">
          Output estimates use typical defaults and may vary with model settings.
        </p>
      </CollapsibleContent>
    </Collapsible>
  );
}

function scrollCardIntoView(el: HTMLElement | null) {
  el?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
}

function EnterprisePlanCard({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'relative mx-auto flex h-full w-full max-w-3xl flex-col rounded-lg border-2 border-border bg-card p-8 shadow-md transition-shadow hover:shadow-lg',
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

type PricingSectionProps = {
  embedded?: boolean;
  compact?: boolean;
  initialTab?: PricingTab;
};

type SubscriptionUiState =
  | { status: 'pending' }
  | {
      status: 'ready';
      isLoggedIn: boolean;
      activePriceId: string | null;
      activePlanUuid: string | null;
      activePlanName: string | null;
    };

export function PricingSection({
  embedded = false,
  compact = false,
  initialTab = 'monthly',
}: PricingSectionProps) {
  const isPresence = isPresenceProduct();
  const [loading, setLoading] = useState<string | null>(null);
  const [activePricingTab, setActivePricingTab] = useState<PricingTab>(initialTab);
  const [subscriptionState, setSubscriptionState] = useState<SubscriptionUiState>({
    status: 'pending',
  });
  const reduceMotion = useReducedMotion();
  const router = useRouter();
  const supabase = createClient();
  const carouselRef = useRef<HTMLDivElement>(null);
  const freeCardRef = useRef<HTMLDivElement>(null);
  const starterCardRef = useRef<HTMLDivElement>(null);
  const plusCardRef = useRef<HTMLDivElement>(null);
  const maxCardRef = useRef<HTMLDivElement>(null);

  const isSubscriptionTab = activePricingTab === 'monthly' || (!isPresence && activePricingTab === 'yearly');
  const pricingPlans = isPresence
    ? presenceMonthlyPlans
    : activePricingTab === 'yearly'
      ? yearlyPlans
      : monthlyPlans;
  const staticHeaderCopy = {
    title: 'Pick Your Plan',
    description: 'Simple affordable pricing. Credits never expire.',
  };
  const headerCopy: Record<PricingTab, { footer: string }> = {
    monthly: {
      footer:
        'Create consistently with credits that stay in your balance, plus priority access on higher tiers and unlimited Instagram and TikTok connections on every plan. Cancel anytime.',
    },
    yearly: {
      footer:
        'Get the best value, keep receiving credits each month, and use your balance when your workflow is ready. Manage renewal anytime.',
    },
    'one-time': {
      footer:
        'Top up once and create on your own schedule. Credits do not expire, do not renew, and do not change your current plan.',
    },
    enterprise: {
      footer:
        'Enterprise pricing is scoped with your team and can include custom credit volume, security review, invoicing, and implementation support.',
    },
  };
  const activeCopy = headerCopy[activePricingTab];
  const motionTransition = reduceMotion
    ? { duration: 0 }
    : { duration: 0.24, ease: [0.22, 1, 0.36, 1] as const };

  useEffect(() => {
    let cancelled = false;

    async function loadSubscription() {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (cancelled) return;

        if (isPresence) {
          if (!user) {
            if (!cancelled) {
              setSubscriptionState({
                status: 'ready',
                isLoggedIn: false,
                activePriceId: null,
                activePlanUuid: null,
                activePlanName: null,
              });
            }
            return;
          }

          const response = await fetch('/api/billing/subscription');
          const data = (await response.json()) as {
            activePlanUuid?: string | null;
            activePlanName?: string | null;
          };

          if (!cancelled) {
            setSubscriptionState({
              status: 'ready',
              isLoggedIn: true,
              activePriceId: null,
              activePlanUuid: data.activePlanUuid ?? null,
              activePlanName: data.activePlanName ?? null,
            });
          }
          return;
        }

        let activePriceId: string | null = null;
        if (user) {
          const { data } = await supabase
            .from('subscriptions')
            .select('price_id')
            .eq('user_id', user.id)
            .in('status', ['active', 'trialing'])
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          activePriceId = data?.price_id ?? null;
        }

        if (!cancelled) {
          setSubscriptionState({
            status: 'ready',
            isLoggedIn: Boolean(user),
            activePriceId,
            activePlanUuid: null,
            activePlanName: null,
          });
        }
      } catch (error) {
        console.error('Failed to load subscription for pricing:', error);
        if (!cancelled) {
          setSubscriptionState({
            status: 'ready',
            isLoggedIn: false,
            activePriceId: null,
            activePlanUuid: null,
            activePlanName: null,
          });
        }
      }
    }

    void loadSubscription();

    return () => {
      cancelled = true;
    };
  }, [supabase, isPresence]);

  const planStateReady = subscriptionState.status === 'ready';
  const activePriceId =
    subscriptionState.status === 'ready' ? subscriptionState.activePriceId : null;
  const activePlanUuid =
    subscriptionState.status === 'ready' ? subscriptionState.activePlanUuid : null;
  const activePlanName =
    subscriptionState.status === 'ready' ? subscriptionState.activePlanName : null;
  const isLoggedIn = subscriptionState.status === 'ready' ? subscriptionState.isLoggedIn : false;

  const handleManageBilling = async (planId: string) => {
    setLoading(planId);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push('/login?redirect=/pricing');
        return;
      }

      if (isPresenceProduct()) {
        const checkoutUrl = await fetchFanvueBillingUrl({ kind: 'listing' });
        window.location.assign(checkoutUrl);
        return;
      }

      const response = await fetch('/api/customer-portal', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          returnUrl: window.location.href,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to open billing portal');
      }

      if (data.url) {
        window.location.assign(data.url);
      }
    } catch (error) {
      console.error('Error:', error);
      alert(
        error instanceof Error ? error.message : 'Failed to open billing portal. Please try again.'
      );
    } finally {
      setLoading(null);
    }
  };

  const handleSubscribe = async (priceId: string, planId: string) => {
    setLoading(planId);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push('/login?redirect=/pricing');
        return;
      }

      if (isPresenceProduct()) {
        const fanvuePlan = mapInternalPlanToFanvue(planId);
        const checkoutUrl = fanvuePlan
          ? await fetchFanvueBillingUrl({ kind: 'plan', plan: fanvuePlan })
          : await fetchFanvueBillingUrl({ kind: 'listing' });
        window.location.assign(checkoutUrl);
        return;
      }

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

      if (data.url) {
        window.location.assign(data.url);
      }
    } catch (error) {
      console.error('Error:', error);
      alert(error instanceof Error ? error.message : 'Failed to start checkout. Please try again.');
    } finally {
      setLoading(null);
    }
  };

  return (
    <section
      id={embedded && !compact ? 'pricing' : undefined}
      className={cn(
        'bg-background px-4 sm:px-6 lg:px-8',
        embedded && !compact && 'scroll-mt-24',
        embedded
          ? compact
            ? 'w-full py-4 sm:py-6'
            : 'w-full py-16 sm:py-24'
          : 'min-h-[90vh] pt-4 pb-2 sm:pt-6'
      )}
    >
      <div className="max-w-7xl mx-auto">
        <motion.div
          className={cn('text-center', compact ? 'mb-4 sm:mb-6' : 'mb-2 sm:mb-4')}
          initial={reduceMotion ? false : 'hidden'}
          animate="visible"
          variants={pageFade}
          transition={motionTransition}
        >
          <div
            className={cn(
              'mx-auto flex max-w-5xl flex-col items-center justify-center',
              compact ? 'mb-3 min-h-0' : 'mb-2 min-h-0'
            )}
          >
            <h1 className={cn('font-bold uppercase tracking-tight', compact ? 'mb-3 text-3xl sm:text-4xl' : 'mb-2 text-4xl')}>
              {staticHeaderCopy.title}
            </h1>
            <p className={cn('max-w-5xl text-muted-foreground', compact ? 'text-base sm:text-lg' : 'text-xs sm:text-sm')}>
              {staticHeaderCopy.description}
            </p>
          </div>

          <Tabs
            value={activePricingTab}
            onValueChange={(value) => setActivePricingTab(value as PricingTab)}
            className="mx-auto flex w-full max-w-xl flex-col items-stretch"
          >
            <TabsList
              variant="default"
              className={cn(
                '!mx-auto grid !h-auto min-h-10 w-full max-w-xl gap-0.5 rounded-4xl p-0.5',
                isPresence ? 'grid-cols-2' : 'grid-cols-4',
                'border border-border/65 bg-muted/95',
                'shadow-[inset_0_2px_6px_rgba(0,0,0,0.10),inset_0_1px_2px_rgba(0,0,0,0.06),inset_0_-1px_1px_rgba(255,255,255,0.35)]',
                'dark:border-border/45 dark:bg-muted/55',
                'dark:shadow-[inset_0_2px_12px_rgba(0,0,0,0.55),inset_0_1px_2px_rgba(0,0,0,0.45),inset_0_-1px_0_rgba(255,255,255,0.04)]'
              )}
            >
              <TabsTrigger
                value="monthly"
                className="flex min-h-8 w-full min-w-0 shrink-0 items-center justify-center rounded-2xl border border-transparent px-1.5 py-1.5 text-center text-xs font-medium text-muted-foreground transition-[color,box-shadow,border-color,background-color] hover:text-foreground data-active:border-border/80 data-active:bg-background data-active:text-foreground data-active:shadow-sm dark:data-active:border-border/60 dark:data-active:bg-card/90 sm:px-3 sm:text-sm"
              >
                Monthly
              </TabsTrigger>
              {!isPresence ? (
                <TabsTrigger
                  value="yearly"
                  className="flex min-h-8 w-full min-w-0 shrink-0 items-center justify-center rounded-2xl border border-transparent px-1.5 py-1.5 text-center text-xs font-medium text-muted-foreground transition-[color,box-shadow,border-color,background-color] hover:text-foreground data-active:border-border/80 data-active:bg-background data-active:text-foreground data-active:shadow-sm dark:data-active:border-border/60 dark:data-active:bg-card/90 sm:px-3 sm:text-sm"
                >
                  <span>Yearly</span>
                </TabsTrigger>
              ) : null}
              <TabsTrigger
                value="one-time"
                className="flex min-h-8 w-full min-w-0 shrink-0 items-center justify-center rounded-2xl border border-transparent px-1.5 py-1.5 text-center text-xs font-medium text-muted-foreground transition-[color,box-shadow,border-color,background-color] hover:text-foreground data-active:border-border/80 data-active:bg-background data-active:text-foreground data-active:shadow-sm dark:data-active:border-border/60 dark:data-active:bg-card/90 sm:px-3 sm:text-sm"
              >
                Credits
              </TabsTrigger>
              {!isPresence ? (
                <TabsTrigger
                  value="enterprise"
                  className="flex min-h-8 w-full min-w-0 shrink-0 items-center justify-center rounded-2xl border border-transparent px-1.5 py-1.5 text-center text-xs font-medium text-muted-foreground transition-[color,box-shadow,border-color,background-color] hover:text-foreground data-active:border-border/80 data-active:bg-background data-active:text-foreground data-active:shadow-sm dark:data-active:border-border/60 dark:data-active:bg-card/90 sm:px-3 sm:text-sm"
                >
                  Enterprise
                </TabsTrigger>
              ) : null}
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
                      onClick={() => scrollCardIntoView(freeCardRef.current)}
                    >
                      Free
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="rounded-full"
                      onClick={() => scrollCardIntoView(starterCardRef.current)}
                    >
                      Starter
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="rounded-full"
                      onClick={() => scrollCardIntoView(plusCardRef.current)}
                    >
                      {isPresence ? 'Pro' : 'Plus'}
                    </Button>
                    {/* Max jump-to button hidden for conversion test — re-enable to restore */}
                    {/* <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="rounded-full"
                      onClick={() => scrollCardIntoView(maxCardRef.current)}
                    >
                      Max
                    </Button> */}
                  </div>
                </div>
              </div>

              <motion.div
                ref={carouselRef}
                className={[
                  'flex max-w-7xl mx-auto items-stretch',
                  '-mx-4 flex-row gap-3 overflow-x-auto overscroll-x-contain pb-4 px-[calc((100vw-85vw)/2)] pt-3',
                  'snap-x snap-mandatory scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
                  'sm:mx-auto sm:grid sm:grid-cols-2 sm:gap-6 sm:overflow-visible sm:overscroll-auto sm:pb-0 sm:px-0 sm:pt-0',
                  // 'lg:grid-cols-3', // hidden while Max plan is disabled — restore alongside Max plan
                  'sm:max-w-5xl lg:grid-cols-3',
                  'sm:snap-none lg:gap-8',
                ].join(' ')}
                variants={cardList}
              >
                {pricingPlans.map((plan) => {
                  const listMonthly = monthlyPlans.find((p) => p.name === plan.name)?.price;
                  const annualMonthly = plan.price / 12;
                  const hasYearlyDiscount =
                    plan.interval === 'year' && listMonthly != null && annualMonthly < listMonthly;
                  const cta = planStateReady
                    ? isPresence
                      ? getFanvuePlanCtaState({
                          planName: plan.name,
                          activePlanUuid,
                          activePlanName,
                          isLoggedIn,
                        })
                      : getPlanCtaState({
                          planName: plan.name,
                          planInterval: plan.interval,
                          planPriceId: plan.priceId,
                          activePriceId,
                          isLoggedIn,
                        })
                    : null;
                  const isCurrentPlan = planStateReady && cta?.kind === 'current';

                  return (
                    <motion.div
                      key={plan.id}
                      ref={
                        plan.name === 'Free'
                          ? freeCardRef
                          : plan.name === 'Starter'
                            ? starterCardRef
                            : plan.name === 'Plus' || plan.name === 'Pro'
                              ? plusCardRef
                              : maxCardRef
                      }
                      variants={cardFade}
                      transition={motionTransition}
                      className={cn(
                        'relative flex h-full min-h-[460px] flex-col rounded-[22px] border bg-card/90 p-6 shadow-md transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg',
                        'max-sm:snap-center max-sm:shrink-0 max-sm:w-[85vw] max-sm:max-w-md sm:w-auto sm:max-w-none',
                        isCurrentPlan
                          ? 'border-primary/40 ring-1 ring-primary/20'
                          : 'border-border/70 hover:border-border',
                        plan.popular && !isCurrentPlan ? 'bg-card/95' : ''
                      )}
                    >
                      {isCurrentPlan ? (
                        <div className="pointer-events-none absolute right-4 top-4 z-20">
                          <span className="inline-flex rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-primary backdrop-blur-sm">
                            Your plan
                          </span>
                        </div>
                      ) : plan.popular ? (
                        <div className="pointer-events-none absolute right-4 top-4 z-20">
                          <span className="inline-flex rounded-full border border-border/70 bg-background/70 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground backdrop-blur-sm">
                            Most Popular
                          </span>
                        </div>
                      ) : null}

                      <div className="space-y-4">
                        <div
                          className={cn(
                            'space-y-1',
                            (isCurrentPlan || plan.popular) && 'pr-20'
                          )}
                        >
                          <h2 className="text-2xl font-semibold tracking-tight">{plan.name}</h2>
                          <p
                            className={cn(
                              'text-sm text-muted-foreground',
                              plan.name === 'Free' && 'whitespace-nowrap'
                            )}
                          >
                            {plan.description}
                          </p>
                        </div>

                        <div className="space-y-1.5">
                          {plan.price === 0 ? (
                            <div className="flex items-baseline gap-2">
                              <span className="text-4xl font-semibold tracking-tight">Free</span>
                            </div>
                          ) : hasYearlyDiscount ? (
                            <div
                              className="flex flex-col gap-2 w-full"
                              aria-label={`${formatPlanCurrency(annualMonthly, plan.currency)} per month, billed annually (${formatPlanCurrency(plan.price, plan.currency)} per year), compared to ${formatPlanCurrency(listMonthly, plan.currency)} per month on the monthly plan`}
                            >
                              <div className="flex items-baseline gap-2 flex-wrap">
                                <span className="text-3xl font-semibold text-primary line-through decoration-2 decoration-primary">
                                  {formatPlanCurrency(listMonthly, plan.currency)}
                                </span>
                                <span className="text-4xl font-semibold tracking-tight text-foreground">
                                  {formatPlanCurrency(annualMonthly, plan.currency)}
                                </span>
                                <span className="text-xs font-medium text-muted-foreground">
                                  /month, billed annually
                                </span>
                              </div>
                            </div>
                          ) : plan.interval === 'year' && listMonthly != null ? (
                            <div
                              className="flex items-baseline gap-1.5 flex-wrap"
                              aria-label={`${formatPlanCurrency(annualMonthly, plan.currency)} per month, billed annually (${formatPlanCurrency(plan.price, plan.currency)} per year)`}
                            >
                              <span className="text-4xl font-semibold tracking-tight">
                                {formatPlanCurrency(annualMonthly, plan.currency)}
                              </span>
                              <span className="text-xs text-muted-foreground">/month, billed annually</span>
                            </div>
                          ) : plan.interval === 'year' ? (
                            <div className="flex items-baseline gap-1.5">
                              <span className="text-4xl font-semibold tracking-tight">
                                {formatPlanCurrency(plan.price, plan.currency)}
                              </span>
                              <span className="text-muted-foreground">/year</span>
                            </div>
                          ) : (
                            <div className="flex items-baseline gap-1.5">
                              <span className="text-4xl font-semibold tracking-tight">
                                {formatPlanCurrency(plan.price, plan.currency)}
                              </span>
                              <span className="text-muted-foreground">/{plan.interval}</span>
                            </div>
                          )}
                          {plan.priceNote ? (
                            <span className="text-xs text-muted-foreground">{plan.priceNote}</span>
                          ) : null}
                        </div>
                      </div>

                      <div className="mt-5 space-y-3.5">
                        <PlanCreditEstimates
                          credits={plan.credits}
                          creditsLabel={plan.creditsLabel}
                          hideVideoEstimate={plan.name === 'Free'}
                        />

                        <ul className="space-y-2">
                          {getSubscriptionCardBullets(plan).map((bullet) => (
                            <li key={bullet} className="flex items-start gap-2 text-sm text-foreground/90">
                              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-foreground/70" />
                              <span>{bullet}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      <div className="mt-auto pt-5">
                        <PlanCardCta
                          cta={cta}
                          pending={!planStateReady}
                          loading={loading === plan.id}
                          popular={Boolean(plan.popular)}
                          signupHref={plan.ctaHref ?? '/login?mode=signup'}
                          onCheckout={() => handleSubscribe(plan.priceId ?? '', plan.id)}
                          onPortal={() => handleManageBilling(plan.id)}
                        />
                      </div>
                    </motion.div>
                  );
                })}
              </motion.div>
              <PlanComparisonDetails proLabel={isPresence ? 'Pro' : 'Plus'} />
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
              <CreditPackGrid redirectPath="/pricing" />
            </motion.div>
          ) : (
            <motion.div
              key="enterprise"
              initial={reduceMotion ? false : 'hidden'}
              animate="visible"
              exit="exit"
              variants={pageFade}
              transition={motionTransition}
            >
              <EnterprisePlanCard />
            </motion.div>
          )}
        </div>

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
    </section>
  );
}
