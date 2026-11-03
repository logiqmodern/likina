import { Body, Container, Head, Hr, Html, Link, Preview, Section, Text } from "@react-email/components";
import type { ReactNode } from "react";

/*
 * Shared e-mail frame. Colours = docs/DESIGN.md tokens; never white text on
 * the brand gold (buttons are gold with ink text). Inline styles only — e-mail
 * clients ignore stylesheets. System font stack (web fonts are unreliable in mail).
 */

export const C = {
  bg: "#FBF9F5",
  tint50: "#F7F2EA",
  accent: "#E2B866",
  ink: "#2A1F1A",
  ink2: "#4A3D35",
  muted: "#6F6258",
  line: "#ECE4D8",
  white: "#FFFFFF",
} as const;

// No -apple-system / BlinkMacSystemFont and no lang="bg": in Gmail for iOS that combination
// (SF with Bulgarian letter forms) dropped spaces between words (test e-mail, 13.10.2026).
const font = "'Helvetica Neue', Helvetica, Arial, sans-serif";

export const text = { fontSize: "16px", lineHeight: "24px", color: C.ink, margin: "0 0 14px" } as const;
export const small = { fontSize: "13px", lineHeight: "20px", color: C.muted, margin: "0 0 6px" } as const;

export function Layout({
  preview,
  children,
  footer,
}: {
  preview?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <Html>
      <Head>
        <meta name="color-scheme" content="light" />
        <meta name="supported-color-schemes" content="light" />
      </Head>
      {preview ? <Preview>{preview}</Preview> : null}
      <Body style={{ backgroundColor: C.bg, fontFamily: font, margin: 0, padding: "24px 0" }}>
        <Container style={{ maxWidth: "560px", margin: "0 auto", padding: "0 16px" }}>
          <Text style={{ fontSize: "15px", fontWeight: 800, letterSpacing: "0.02em", color: C.ink, margin: "0 0 16px" }}>
            Likina
          </Text>
          <Section
            style={{
              backgroundColor: C.white,
              border: `1px solid ${C.line}`,
              borderRadius: "16px",
              padding: "24px 20px",
            }}
          >
            {children}
          </Section>
          {footer ? (
            <Section style={{ padding: "16px 4px 0" }}>
              <Hr style={{ borderColor: C.line, margin: "0 0 12px" }} />
              {footer}
            </Section>
          ) : null}
        </Container>
      </Body>
    </Html>
  );
}

export function Heading({ children }: { children: ReactNode }) {
  return (
    <Text style={{ fontSize: "22px", lineHeight: "28px", fontWeight: 800, color: C.ink, margin: "0 0 16px" }}>
      {children}
    </Text>
  );
}

export function Paragraphs({ items }: { items: string[] }) {
  return (
    <>
      {items.map((p, i) => (
        <Text key={i} style={{ ...text, whiteSpace: "pre-line" }}>
          {p}
        </Text>
      ))}
    </>
  );
}

export function Details({ rows }: { rows: Array<{ label: string; value: ReactNode }> }) {
  return (
    <Section style={{ backgroundColor: C.tint50, borderRadius: "12px", padding: "12px 16px", margin: "4px 0 18px" }}>
      <table role="presentation" width="100%" cellPadding={0} cellSpacing={0} style={{ borderCollapse: "collapse" }}>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label}>
              <td style={{ fontSize: "14px", color: C.muted, padding: "6px 12px 6px 0", verticalAlign: "top", width: "34%" }}>
                {r.label}
              </td>
              <td style={{ fontSize: "15px", color: C.ink, fontWeight: 600, padding: "6px 0", verticalAlign: "top" }}>
                {r.value}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Section>
  );
}

export function ButtonLink({ href, children, variant = "primary" }: { href: string; children: ReactNode; variant?: "primary" | "secondary" }) {
  const primary = variant === "primary";
  return (
    <Link
      href={href}
      style={{
        display: "inline-block",
        backgroundColor: primary ? C.accent : C.white,
        color: C.ink,
        border: `1.5px solid ${primary ? C.accent : C.ink}`,
        borderRadius: "999px",
        padding: "12px 22px",
        fontSize: "16px",
        fontWeight: 700,
        textDecoration: "none",
        margin: "0 8px 10px 0",
      }}
    >
      {children}
    </Link>
  );
}

export function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Section style={{ borderTop: `1px solid ${C.line}`, padding: "14px 0 0", margin: "14px 0 0" }}>
      <Text style={{ ...text, fontWeight: 800, margin: "0 0 6px" }}>{title}</Text>
      {children}
    </Section>
  );
}

export function A({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} style={{ color: C.ink, textDecoration: "underline" }}>
      {children}
    </Link>
  );
}
