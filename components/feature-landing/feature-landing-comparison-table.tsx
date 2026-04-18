import type { FeatureLandingConfig } from "@/lib/types/feature-landing"
import { cn } from "@/lib/utils"

type ComparisonProps = {
  comparison: NonNullable<FeatureLandingConfig["comparison"]>
}

export function FeatureLandingComparisonTable({ comparison }: ComparisonProps) {
  const { heading, columns, rows } = comparison
  return (
    <section className="border-b border-border/60 bg-background py-12 sm:py-16" aria-labelledby="comparison-heading">
      <div className="mx-auto w-full max-w-6xl px-4 lg:px-8">
        <h2 id="comparison-heading" className="text-balance text-2xl font-semibold text-foreground sm:text-3xl">
          {heading}
        </h2>
        <div className="mt-8 overflow-x-auto rounded-xl border border-border/60 bg-background shadow-sm">
          <table className="w-full min-w-[640px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-border/80 bg-muted/40">
                <th scope="col" className="px-4 py-3 font-semibold text-foreground">
                  Criteria
                </th>
                {columns.map((col) => (
                  <th key={col} scope="col" className="px-4 py-3 font-semibold text-foreground">
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.label} className="border-b border-border/50 last:border-0">
                  <th scope="row" className="px-4 py-3 font-medium text-foreground">
                    {row.label}
                  </th>
                  {row.cells.map((cell, i) => (
                    <td
                      key={`${row.label}-${columns[i] ?? i}`}
                      className={cn("px-4 py-3 text-muted-foreground", i === 0 && "text-foreground/90")}
                    >
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  )
}
