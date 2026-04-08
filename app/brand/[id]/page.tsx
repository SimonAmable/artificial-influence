import { BrandKitEditor } from "@/components/brand-kit/brand-kit-editor"

export default async function BrandKitPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params

  return (
    <div className="min-h-screen bg-background px-4 pb-24 pt-20 text-foreground md:px-6 md:pt-24">
      <div className="mx-auto max-w-6xl py-6 md:py-10">
        <BrandKitEditor variant="page" forcedKitId={id} backHref="/brand" />
      </div>
    </div>
  )
}
