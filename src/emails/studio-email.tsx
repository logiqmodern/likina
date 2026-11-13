import { Text } from "@react-email/components";
import { ButtonLink, Details, Heading, Layout, Paragraphs, small, text, C } from "./layout";

/*
 * Internal e-mails (studio notifications, daily schedule, alerts). Fixed
 * Bulgarian texts in code; never shown to customers.
 */

export interface StudioEmailModel {
  heading: string;
  preview?: string;
  lines?: string[];
  rows?: Array<{ label: string; value: string }>;
  /** e.g. the day's appointments */
  list?: { title: string; items: Array<{ time: string; text: string; note?: string }>; empty: string };
  link?: { label: string; url: string };
  /** footer line (default: the BG "automatic message" note) */
  footer?: string;
}

export function StudioEmail({ m }: { m: StudioEmailModel }) {
  return (
    <Layout
      preview={m.preview}
      footer={<Text style={small}>{m.footer ?? "Автоматично съобщение от сайта likina.com."}</Text>}
    >
      <Heading>{m.heading}</Heading>
      {m.lines?.length ? <Paragraphs items={m.lines} /> : null}
      {m.rows?.length ? <Details rows={m.rows} /> : null}
      {m.list ? (
        <>
          <Text style={{ ...text, fontWeight: 800, margin: "4px 0 8px" }}>{m.list.title}</Text>
          {m.list.items.length === 0 ? (
            <Text style={text}>{m.list.empty}</Text>
          ) : (
            <table role="presentation" width="100%" cellPadding={0} cellSpacing={0} style={{ borderCollapse: "collapse", margin: "0 0 16px" }}>
              <tbody>
                {m.list.items.map((it, i) => (
                  <tr key={i}>
                    <td style={{ fontSize: "15px", fontWeight: 800, color: C.ink, padding: "8px 12px 8px 0", verticalAlign: "top", width: "64px", borderBottom: `1px solid ${C.line}` }}>
                      {it.time}
                    </td>
                    <td style={{ fontSize: "15px", color: C.ink, padding: "8px 0", verticalAlign: "top", borderBottom: `1px solid ${C.line}` }}>
                      {it.text}
                      {it.note ? <div style={{ fontSize: "13px", color: C.muted }}>{it.note}</div> : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      ) : null}
      {m.link ? <ButtonLink href={m.link.url}>{m.link.label}</ButtonLink> : null}
    </Layout>
  );
}

export function studioEmailText(m: StudioEmailModel): string {
  const out: string[] = [m.heading, ""];
  if (m.lines?.length) out.push(...m.lines, "");
  for (const r of m.rows ?? []) out.push(`${r.label}: ${r.value}`);
  if (m.rows?.length) out.push("");
  if (m.list) {
    out.push(m.list.title);
    if (m.list.items.length === 0) out.push(m.list.empty);
    for (const it of m.list.items) out.push(`${it.time}  ${it.text}${it.note ? ` (${it.note})` : ""}`);
    out.push("");
  }
  if (m.link) out.push(`${m.link.label}: ${m.link.url}`);
  return out.join("\n").trim() + "\n";
}
