'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Sparkle, Info } from '@phosphor-icons/react';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

// Define pricing plans with TEST MODE Stripe Price IDs
const monthlyPlans = [
  {
    id: 'basic-monthly',
    name: 'Basic',
    description: 'Perfect for getting started',
    price: 5.00,
    priceId: 'price_1SrXYkK2MiVk67BiHuwPn21M', // TEST MODE
    interval: 'month',
    credits: 100,
    features: [
      {
        name: 'Access to all AI models',
        info: 'Includes image generation (Nano Banana, FLUX.2 Flex), video generation (Fabric 1.0), and audio models',
      },
      {
        name: 'Image generation',
        info: 'Generate high-quality images using state-of-the-art AI models like Nano Banana and FLUX.2 Flex',
      },
      {
        name: 'Video generation',
        info: 'Create videos with lip sync and animation using Fabric 1.0 and other video models',
      },
      {
        name: 'Concurrent generations',
        info: 'Generate multiple images and videos simultaneously for faster workflow',
      },
      {
        name: 'Commercial license',
        info: 'Use generated content for commercial purposes without attribution requirements',
      },
      {
        name: 'Email support',
        info: 'Get help via email with standard response times',
      },
    ],
  },
  {
    id: 'pro-monthly',
    name: 'Pro',
    description: 'For professional users',
    price: 20.00,
    priceId: 'price_1SrXZ0K2MiVk67BiQY0XpX7z', // TEST MODE
    interval: 'month',
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
    ],
    popular: true,
  },
  {
    id: 'creator-monthly',
    name: 'Creator',
    description: 'For content creators',
    price: 50.00,
    priceId: 'price_1SrXZDK2MiVk67Bi0Y57icpS', // TEST MODE
    interval: 'month',
    credits: 1750,
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
    ],
  },
];

export default function PricingTestPage() {
  const [loading, setLoading] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClient();

  const handleSubscribe = async (priceId: string, planId: string) => {
    setLoading(planId);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push('/login?redirect=/pricing-test');
        return;
      }

      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priceId }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to create checkout session');
      if (data.url) window.location.href = data.url;
    } catch (error) {
      console.error('Error:', error);
      alert('Failed to start checkout. Please try again.');
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="min-h-screen bg-linear-to-b from-background to-muted py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Test Mode Banner */}
        <div className="bg-yellow-100 dark:bg-yellow-900 border border-yellow-400 dark:border-yellow-600 rounded-lg p-4 mb-6">
          <div className="flex items-start gap-3">
            <svg
              className="w-6 h-6 text-yellow-600 dark:text-yellow-400 shrink-0 mt-0.5"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
            </svg>
            <div>
              <p className="text-yellow-800 dark:text-yellow-200 text-sm font-semibold mb-1">
                TEST MODE: Stripe Test Mode Price IDs
              </p>
              <p className="text-yellow-700 dark:text-yellow-300 text-xs">
                This page uses Stripe test mode Price IDs. Use test cards (e.g., 4242 4242 4242 4242) for checkout.
                No real charges will be made. For production pricing, visit{' '}
                <a href="/pricing" className="underline font-medium">/pricing</a>.
              </p>
            </div>
          </div>
        </div>

        {/* Header */}
        <div className="text-center mb-12 pt-6">
          <h1 className="text-4xl font-bold tracking-tight mb-4">
            Choose Your Plan (Test Mode)
          </h1>
          <p className="text-xl text-muted-foreground mb-6">
            Select the perfect plan for your needs
          </p>
        </div>

        {/* Pricing Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {monthlyPlans.map((plan) => (
            <div
              key={plan.id}
              className={`relative bg-card rounded-lg border-2 p-8 shadow-lg hover:shadow-xl transition-shadow ${
                plan.popular
                  ? 'border-primary scale-105'
                  : 'border-border'
              }`}
            >
              {/* Popular Badge */}
              {plan.popular && (
                <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                  <span className="bg-primary text-primary-foreground px-4 py-1 rounded-full text-sm font-semibold">
                    Most Popular
                  </span>
                </div>
              )}

              {/* Plan Header */}
              <div className="text-center mb-6">
                <h2 className="text-2xl font-bold mb-2">{plan.name}</h2>
                <p className="text-muted-foreground mb-4">{plan.description}</p>
                <div className="flex flex-col items-center gap-1">
                  <div className="flex items-baseline justify-center gap-1">
                    <span className="text-5xl font-bold">${plan.price}</span>
                    <span className="text-muted-foreground">/{plan.interval}</span>
                  </div>
                </div>
              </div>

              {/* Credits Display */}
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
                      className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
                      aria-label="Credit usage information"
                    >
                      <span>
                        ~{plan.credits} images or ~{Math.floor(plan.credits / 20)} videos
                      </span>
                      <Info className="w-3 h-3" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <div className="text-sm space-y-1">
                      <p>1 credit = 1 image generation</p>
                      <p>20 credits = 1 video generation</p>
                    </div>
                  </TooltipContent>
                </Tooltip>
              </div>

              {/* Subscribe Button */}
              <button
                onClick={() => handleSubscribe(plan.priceId, plan.id)}
                disabled={loading === plan.id}
                className={`w-full py-3 px-6 rounded-lg font-semibold transition-colors mb-6 ${
                  plan.popular
                    ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                    : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {loading === plan.id ? 'Loading...' : 'Subscribe'}
              </button>

              {/* Features List */}
                <ul className="space-y-3 mb-8">
                  {plan.features.map((feature, index) => (
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
            </div>
          ))}
        </div>

        {/* Footer Note */}
        <div className="text-center mt-12">
          <p className="text-sm text-muted-foreground">
            Cancel anytime. No long-term commitments. All plans include full access to features.
          </p>
          <p className="text-xs text-muted-foreground mt-2">
            This is a test mode page. Use test cards for checkout. No real charges will be made.
          </p>
        </div>
      </div>
    </div>
  );
}
