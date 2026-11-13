import { Suspense } from "react";
import { staticMetadata } from "@/components/site/pages/content";
import { CheckoutPage } from "@/components/site/pages/cart";
import { messages } from "@/i18n";

export const metadata = { ...staticMetadata("en", "checkout", messages["en"].checkout.title), robots: { index: false } };

export default function Page() {
  return (
    <Suspense fallback={<div className="min-h-dvh" />}>
      <CheckoutPage lang={"en"} />
    </Suspense>
  );
}
