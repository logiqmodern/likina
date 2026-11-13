import { Suspense } from "react";
import { staticMetadata } from "@/components/site/pages/content";
import { CartPage } from "@/components/site/pages/cart";
import { messages } from "@/i18n";

export const metadata = { ...staticMetadata("bg", "cart", messages["bg"].cart.title), robots: { index: false } };

export default function Page() {
  return (
    <Suspense fallback={<div className="min-h-dvh" />}>
      <CartPage lang={"bg"} />
    </Suspense>
  );
}
