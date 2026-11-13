import { Suspense } from "react";
import { staticMetadata } from "@/components/site/pages/content";
import { CheckoutPage } from "@/components/site/pages/cart";
import { messages } from "@/i18n";

export const metadata = { ...staticMetadata("bg", "checkout", messages["bg"].checkout.title), robots: { index: false } };

export default function Page() {
  return (
    <Suspense fallback={<div className="min-h-dvh" />}>
      <CheckoutPage lang={"bg"} />
    </Suspense>
  );
}
