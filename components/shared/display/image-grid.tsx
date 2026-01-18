"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { CircleNotch } from "@phosphor-icons/react"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Slider } from "@/components/ui/slider"

interface ImageGridProps {
  images: string[]  // Array of hosted image URLs
  isGenerating?: boolean  // Show generating card in grid
  className?: string
  onImageClick?: (imageUrl: string, index: number) => void
}

export function ImageGrid({
  images,
  isGenerating = false,
  className,
  onImageClick,
}: ImageGridProps) {
  const [columnCount, setColumnCount] = React.useState(4) // Default 4 columns

  // Grid column class mapping
  const gridColsClass = {
    2: 'grid-cols-2',
    3: 'grid-cols-3',
    4: 'grid-cols-4',
    5: 'grid-cols-5',
    6: 'grid-cols-6',
  }[columnCount] || 'grid-cols-4'

  // Gap class mapping - reduce gap for more columns to prevent excessive vertical spacing
  const gapClass = {
    2: 'gap-2 sm:gap-3 md:gap-4',
    3: 'gap-1.5 sm:gap-2 md:gap-3',
    4: 'gap-1.5 sm:gap-2 md:gap-3',
    5: 'gap-1 sm:gap-1.5 md:gap-2',
    6: 'gap-1 sm:gap-1.5 md:gap-2',
  }[columnCount] || 'gap-1.5 sm:gap-2 md:gap-3'

  return (
    <Card className={cn("w-full h-full flex flex-col p-0", className)}>
      {/* Column Count Slider - Integrated header, matches card styling */}
      <CardHeader className="  p-3 sm:p-4 pb-3 sm:pb-4 ">
        <div className="flex items-center justify-end gap-3 sm:gap-4 w-full">
          <label className="text-xs sm:text-sm font-medium whitespace-nowrap text-foreground">
            Columns: <span className="text-primary">{columnCount}</span>
          </label>
          <Slider
            value={[columnCount]}
            onValueChange={(value) => setColumnCount(value[0])}
            min={2}
            max={6}
            step={1}
            className="w-24 sm:w-32"
          />
        </div>
      </CardHeader>

      {/* Image Grid - Masonry style with fixed row heights */}
      <CardContent className="flex-1 min-h-0 p-0 pt-0">
        <div 
          className={cn(
            "grid p-2 overflow-auto h-full",
            gridColsClass,
            gapClass,
            // Hide scrollbar while maintaining scrollability
            "[&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
          )}
          style={{
            gridAutoRows: 'auto', // Let aspect-square determine row height
            gridAutoFlow: 'row', // Ensure proper row wrapping
          }}
        >
          {/* Generating card - appears first (top-left) when generating */}
          {isGenerating && (
            <Card className="relative aspect-square flex items-center justify-center w-full">
              <CardContent className="flex flex-col items-center justify-center gap-3 p-4">
                <CircleNotch className="size-8 animate-spin text-primary" />
                <p className="text-xs sm:text-sm text-muted-foreground">Generating...</p>
              </CardContent>
            </Card>
          )}
          
          {/* Render existing images - square cards with natural aspect ratio images */}
          {images.map((imageUrl, index) => (
            <div
              key={`image-${index}-${imageUrl}`}
              className="relative aspect-square bg-background border border-border flex items-center justify-center w-full cursor-pointer"
              onClick={() => onImageClick?.(imageUrl, index)}
            >
              <img
                src={imageUrl}
                alt={`Generated image ${index + 1}`}
                className="max-w-full max-h-full w-auto h-auto object-contain"
                loading="lazy"
              />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
