import type { GuideCompareTable } from "@/lib/guides/types"
import { cn } from "@/lib/utils"

export function GuideCompareTableSection({ table }: { table: GuideCompareTable }) {
  return (
    <section className="flex flex-col gap-4 border-t border-border/70 pt-8">
      <div>
        <h2 className="text-sm font-medium uppercase tracking-[0.14em] text-muted-foreground">
          {table.heading}
        </h2>
        {table.description ? (
          <p className="mt-2 text-sm leading-6 text-muted-foreground">{table.description}</p>
        ) : null}
      </div>

      <div className="w-full overflow-x-auto rounded-2xl border border-border/70">
        <table className="w-full min-w-md border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-border/70 bg-muted/30">
              {table.columns.map((column, index) => (
                <th
                  key={column || `col-${index}`}
                  scope="col"
                  className={cn(
                    "px-3 py-2.5 text-xs font-semibold tracking-tight sm:px-4",
                    index === 0 ? "text-muted-foreground" : "text-foreground"
                  )}
                >
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.rows.map((row) => (
              <tr key={row.label} className="border-b border-border/50 last:border-b-0">
                <th
                  scope="row"
                  className="px-3 py-2.5 text-xs font-medium text-muted-foreground sm:px-4"
                >
                  {row.label}
                </th>
                {row.values.map((value, index) => (
                  <td
                    key={`${row.label}-${index}`}
                    className={cn(
                      "px-3 py-2.5 text-sm tabular-nums text-foreground sm:px-4",
                      index === 0 && "font-medium"
                    )}
                  >
                    {value}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {table.footnote ? (
        <p className="text-xs leading-5 text-muted-foreground">{table.footnote}</p>
      ) : null}

      {table.sources && table.sources.length > 0 ? (
        <p className="text-xs leading-5 text-muted-foreground">
          Sources:{" "}
          {table.sources.map((source, index) => (
            <span key={source.href}>
              {index > 0 ? " · " : null}
              <a
                href={source.href}
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-2 transition-colors hover:text-foreground"
              >
                {source.label}
              </a>
            </span>
          ))}
        </p>
      ) : null}
    </section>
  )
}
