'use client';
import React, { useState } from 'react';
import { Sparkles, Star, Coins, Zap } from 'lucide-react';
import { Liquid } from '@/components/ui/button-1';
import { ShinyButton } from '@/components/ui/shiny-button';
import { GlassButton as GlassButtonV2 } from '@/components/ui/glass-button';
import { GlassButton } from '@/components/glass-button';

// Primary blue color scheme matching project theme
const COLORS = {
  color1: '#3B82F6',  // blue-500
  color2: '#60A5FA',  // blue-400
  color3: '#93C5FD',  // blue-300
  color4: '#DBEAFE',  // blue-100
  color5: '#EFF6FF',  // blue-50
  color6: '#BFDBFE',  // blue-200
  color7: '#2563EB',  // blue-600
  color8: '#1D4ED8',  // blue-700
  color9: '#1E40AF',  // blue-800
  color10: '#1E3A8A',  // blue-900
  color11: '#3B82F6',  // blue-500
  color12: '#93C5FD',  // blue-300
  color13: '#2563EB',  // blue-600
  color14: '#BFDBFE',  // blue-200
  color15: '#DBEAFE',  // blue-100
  color16: '#1D4ED8',  // blue-700
  color17: '#1E40AF',  // blue-800
};

const GenerateButton = ({ disabled = false, cost = 2 }: { disabled?: boolean; cost?: number }) => {
  const [isHovered, setIsHovered] = useState(false);
  
  return (
    <div className="flex justify-center">
      <button
        disabled={disabled}
        className={`relative inline-block sm:w-48 w-36 h-[3.5em] group dark:bg-black bg-white dark:border-white border-black border-2 rounded-lg transition-all duration-300 ${
          disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
        } ${
          disabled 
            ? '' 
            : isHovered 
              ? 'shadow-[0_0_30px_rgba(59,130,246,0.7)]' 
              : 'shadow-[0_0_8px_rgba(59,130,246,0.3)]'
        }`}
        onMouseEnter={() => !disabled && setIsHovered(true)}
        onMouseLeave={() => !disabled && setIsHovered(false)}
      >
        <div className="absolute w-[112.81%] h-[128.57%] top-[8.57%] left-1/2 -translate-x-1/2 filter blur-[19px] opacity-70">
          <span className="absolute inset-0 rounded-lg bg-[#d9d9d9] filter blur-[6.5px]"></span>
          {!disabled && (
            <div className="relative w-full h-full overflow-hidden rounded-lg">
              <Liquid isHovered={isHovered} colors={COLORS} />
            </div>
          )}
        </div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-[40%] w-[92.23%] h-[112.85%] rounded-lg bg-[#010128] filter blur-[7.3px]"></div>
        <div className="relative w-full h-full overflow-hidden rounded-lg">
          <span className="absolute inset-0 rounded-lg bg-[#d9d9d9]"></span>
          <span className="absolute inset-0 rounded-lg bg-black"></span>
          {!disabled && <Liquid isHovered={isHovered} colors={COLORS} />}
          {[1, 2, 3, 4, 5].map((i) => (
            <span
              key={i}
              className={`absolute inset-0 rounded-lg border-solid border-[3px] border-gradient-to-b from-transparent to-white mix-blend-overlay filter ${i <= 2 ? 'blur-[3px]' : i === 3 ? 'blur-[5px]' : 'blur-xs'}`}
            ></span>
          ))}
          <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-[40%] w-[70.8%] h-[42.85%] rounded-lg filter blur-[15px] bg-[#006]"></span>
        </div>
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 rounded-lg text-white">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 fill-white" />
            <span className="text-lg font-semibold tracking-wide">Generate</span>
          </div>
          <div className="flex items-center gap-1 text-xs text-blue-200">
            <Coins className="w-3 h-3" />
            <span>{cost} credits</span>
          </div>
        </div>
      </button>
    </div>
  );
};

export default function TestPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-black p-8">
      <div className="max-w-5xl w-full space-y-12">
        <div className="text-center space-y-4">
          <h1 className="text-5xl font-bold text-white mb-4">
            Animated Button Showcase
          </h1>
          <p className="text-lg text-gray-300">
            Hover over the buttons to see the effects
          </p>
        </div>

        {/* Liquid Generate Button Section */}
        <div className="p-12 space-y-8">
          <h3 className="text-2xl font-semibold text-white text-center mb-6">Liquid Button</h3>
          <div className="grid md:grid-cols-2 gap-8">
            <div>
              <p className="text-center text-sm text-gray-400 mb-4">Active State (with glow)</p>
              <GenerateButton cost={2} />
            </div>
            <div>
              <p className="text-center text-sm text-gray-400 mb-4">Disabled State</p>
              <GenerateButton cost={2} disabled />
            </div>
          </div>
        </div>

        {/* Shiny Button Section */}
        <div className="p-12 space-y-8">
          <h3 className="text-2xl font-semibold text-white text-center mb-6">Shiny Button</h3>
          <div className="flex justify-center">
            <ShinyButton onClick={() => alert('Generate clicked!')}>
              <div className="flex flex-col items-center gap-1.5">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5" />
                  <span>Generate Image</span>
                </div>
                <div className="flex items-center gap-1 text-xs opacity-70">
                  <Coins className="w-3.5 h-3.5" />
                  <span>2</span>
                </div>
              </div>
            </ShinyButton>
          </div>
        </div>

        {/* Glass Button Section - Reference Design */}
        <div className="p-12 space-y-8">
          <h3 className="text-2xl font-semibold text-white text-center mb-6">Glass Button (Reference)</h3>
          <div className="flex flex-wrap items-center justify-center gap-6">
            <GlassButton size="sm">
              Small
            </GlassButton>
            <GlassButton size="default" contentClassName="flex items-center gap-2">
              <span>Generate</span>
              <Zap className="h-5 w-5" />
            </GlassButton>
            <GlassButton size="lg">
              Submit
            </GlassButton>
            <GlassButton size="icon">
              <Zap className="h-5 w-5" />
            </GlassButton>
          </div>
        </div>

        {/* Glass Button V2 Section - Enhanced */}
        <div className="p-12 space-y-8">
          <h3 className="text-2xl font-semibold text-white text-center mb-6">Glass Button v2 (Enhanced)</h3>
          <div className="flex flex-wrap items-center justify-center gap-6">
            <GlassButtonV2 size="sm">
              Small
            </GlassButtonV2>
            <GlassButtonV2 size="default" contentClassName="flex items-center gap-2">
              <span>Generate</span>
              <Zap className="h-5 w-5" />
            </GlassButtonV2>
            <GlassButtonV2 size="lg">
              Submit
            </GlassButtonV2>
            <GlassButtonV2 size="icon">
              <Zap className="h-5 w-5" />
            </GlassButtonV2>
          </div>
        </div>

        {/* Features Comparison */}
        <div className="grid md:grid-cols-4 gap-6 text-gray-300">
          <div className="p-6">
            <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-blue-400" />
              Liquid Button
            </h2>
            <ul className="space-y-2">
              <li className="flex items-start gap-2">
                <Star className="w-4 h-4 mt-1 shrink-0 text-blue-400" />
                <span className="text-sm">Smooth liquid gradient animation</span>
              </li>
              <li className="flex items-start gap-2">
                <Star className="w-4 h-4 mt-1 shrink-0 text-blue-400" />
                <span className="text-sm">Blue glow on hover</span>
              </li>
              <li className="flex items-start gap-2">
                <Star className="w-4 h-4 mt-1 shrink-0 text-blue-400" />
                <span className="text-sm">Disabled state support</span>
              </li>
              <li className="flex items-start gap-2">
                <Star className="w-4 h-4 mt-1 shrink-0 text-blue-400" />
                <span className="text-sm">Cost display with icon</span>
              </li>
            </ul>
          </div>
          
          <div className="p-6">
            <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-purple-400" />
              Shiny Button
            </h2>
            <ul className="space-y-2">
              <li className="flex items-start gap-2">
                <Star className="w-4 h-4 mt-1 shrink-0 text-purple-400" />
                <span className="text-sm">Conic gradient border animation</span>
              </li>
              <li className="flex items-start gap-2">
                <Star className="w-4 h-4 mt-1 shrink-0 text-purple-400" />
                <span className="text-sm">Shimmer effect on hover</span>
              </li>
              <li className="flex items-start gap-2">
                <Star className="w-4 h-4 mt-1 shrink-0 text-purple-400" />
                <span className="text-sm">Dot pattern overlay</span>
              </li>
              <li className="flex items-start gap-2">
                <Star className="w-4 h-4 mt-1 shrink-0 text-purple-400" />
                <span className="text-sm">CSS-based animations</span>
              </li>
            </ul>
          </div>

          <div className="p-6">
            <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-cyan-400" />
              Glass Button
            </h2>
            <ul className="space-y-2">
              <li className="flex items-start gap-2">
                <Star className="w-4 h-4 mt-1 shrink-0 text-cyan-400" />
                <span className="text-sm">Clean reference design</span>
              </li>
              <li className="flex items-start gap-2">
                <Star className="w-4 h-4 mt-1 shrink-0 text-cyan-400" />
                <span className="text-sm">Subtle glassmorphism</span>
              </li>
              <li className="flex items-start gap-2">
                <Star className="w-4 h-4 mt-1 shrink-0 text-cyan-400" />
                <span className="text-sm">20px backdrop blur</span>
              </li>
              <li className="flex items-start gap-2">
                <Star className="w-4 h-4 mt-1 shrink-0 text-cyan-400" />
                <span className="text-sm">Modern component library style</span>
              </li>
            </ul>
          </div>

          <div className="p-6">
            <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-emerald-400" />
              Glass Button v2
            </h2>
            <ul className="space-y-2">
              <li className="flex items-start gap-2">
                <Star className="w-4 h-4 mt-1 shrink-0 text-emerald-400" />
                <span className="text-sm">Enhanced dramatic effect</span>
              </li>
              <li className="flex items-start gap-2">
                <Star className="w-4 h-4 mt-1 shrink-0 text-emerald-400" />
                <span className="text-sm">Strong blue glow shadow</span>
              </li>
              <li className="flex items-start gap-2">
                <Star className="w-4 h-4 mt-1 shrink-0 text-emerald-400" />
                <span className="text-sm">Prominent on dark backgrounds</span>
              </li>
              <li className="flex items-start gap-2">
                <Star className="w-4 h-4 mt-1 shrink-0 text-emerald-400" />
                <span className="text-sm">High-impact gradient borders</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
