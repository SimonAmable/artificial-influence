import { DashboardPage } from "@/components/dashboard/dashboard-page"
import { currentProduct } from "@/lib/product/current"

const dashboardPageVariants = {
  default: DashboardPage,
  presence: DashboardPage,
}

export default function Page() {
  const ProductDashboardPage =
    dashboardPageVariants[currentProduct.pageOverrides?.dashboard ?? "default"] ??
    dashboardPageVariants.default

  return <ProductDashboardPage />
}
