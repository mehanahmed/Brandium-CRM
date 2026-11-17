import {
  Circle,
  Document,
  Font,
  Image,
  Page,
  Path,
  Rect,
  StyleSheet,
  Svg,
  Text,
  View,
} from "@react-pdf/renderer";
import type { SalesPdfData } from "@/lib/sales-pdf";

// Wrap whole words only; the default hyphenation split names like "Sys-tem Admin"
Font.registerHyphenationCallback((word) => [word]);

// A4 in points; letterhead clearances match the on-screen sheet (38mm top, 30mm bottom, 16mm sides).
const MM = 2.8346;

// Same palette as the on-screen invoice (/track/[id], /quotations/[id])
const C = {
  green: "#67B239",
  navy: "#0a2e5c",
  text: "#0f172a",
  muted: "#64748b",
  line: "#e2e8f0",
  headBg: "#f1f5f9",
  paid: "#059669",
  due: "#EF1E1E",
};

const styles = StyleSheet.create({
  page: {
    paddingTop: 38 * MM,
    paddingBottom: 30 * MM,
    paddingHorizontal: 16 * MM,
    fontFamily: "Helvetica",
    fontSize: 9,
    color: C.text,
  },
  // A4 is 595.28 × 841.89pt; "fill" stretches the letterhead to the page like the on-screen sheet
  letterhead: {
    position: "absolute",
    top: 0,
    left: 0,
    width: 595.28,
    height: 841.89,
    objectFit: "fill",
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 16,
    paddingBottom: 10,
    marginBottom: 14,
    borderBottomWidth: 0.5,
    borderBottomColor: C.line,
  },
  smallCaps: {
    fontSize: 7.5,
    fontFamily: "Helvetica-Bold",
    color: C.muted,
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  iconRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  billName: { fontSize: 13, fontFamily: "Helvetica-Bold", color: C.text, marginTop: 5 },
  billLine: { fontSize: 8.5, color: C.muted },
  meta: { alignItems: "flex-end", gap: 5 },
  codePill: {
    fontFamily: "Courier-Bold",
    fontSize: 11,
    color: C.navy,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderWidth: 0.75,
    borderColor: "#cbd5e1",
    borderRadius: 3,
    backgroundColor: "#f8fafc",
  },
  metaLabel: { color: C.muted, fontSize: 8.5 },
  metaValue: { fontFamily: "Helvetica-Bold", color: C.text, fontSize: 8.5 },
  barcode: { width: 130, height: 28, marginTop: 2 },
  sectionTitle: { flexDirection: "row", alignItems: "center", gap: 5, marginBottom: 7 },
  sectionTitleText: { fontSize: 11, fontFamily: "Helvetica-Bold", color: C.text },
  table: {
    borderWidth: 0.5,
    borderColor: C.line,
    borderRadius: 6,
    marginBottom: 14,
    overflow: "hidden",
  },
  thead: { flexDirection: "row", backgroundColor: C.headBg },
  th: {
    paddingVertical: 7,
    paddingHorizontal: 8,
    fontSize: 7.5,
    fontFamily: "Helvetica-Bold",
    color: C.muted,
    letterSpacing: 0.5,
  },
  upper: { textTransform: "uppercase" },
  tr: { flexDirection: "row", borderTopWidth: 0.5, borderTopColor: C.line },
  td: { paddingVertical: 7, paddingHorizontal: 8 },
  center: { textAlign: "center" },
  right: { textAlign: "right" },
  bold: { fontFamily: "Helvetica-Bold" },
  mutedText: { color: C.muted },
  gift: { color: "#6b7280", textDecoration: "line-through" },
  notes: {
    backgroundColor: "#fffbeb",
    borderWidth: 0.5,
    borderColor: "#fde68a",
    borderRadius: 6,
    padding: 8,
    color: "#92400e",
    marginBottom: 14,
    lineHeight: 1.4,
  },
  // marginTop "auto" anchors terms + totals to the bottom of the sheet, above the letterhead footer
  bottomRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    gap: 20,
    marginTop: "auto",
    paddingTop: 10,
    borderTopWidth: 0.5,
    borderTopColor: C.line,
  },
  terms: { width: "55%" },
  termsTitle: { flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 4 },
  termsTitleText: {
    fontSize: 7.5,
    fontFamily: "Helvetica-Bold",
    color: C.navy,
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  termItem: { flexDirection: "row", fontSize: 7.5, color: C.muted, marginTop: 1.5 },
  termIndex: { width: 11 },
  summary: { width: 200 },
  sumRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 4, fontSize: 9 },
  sumLabel: { color: C.muted },
  sumValue: { color: C.text },
  sumStrongRow: {
    borderTopWidth: 0.5,
    borderTopColor: C.line,
    borderStyle: "dashed",
    paddingTop: 3,
  },
  sumMinus: { color: "#ef4444" },
  sumPaid: { color: C.paid },
  due: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 7,
    paddingTop: 7,
    borderTopWidth: 0.5,
    borderTopColor: C.line,
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
    color: C.due,
  },
  stamp: { width: 90, height: 90, alignSelf: "flex-end", marginTop: 4 },
});

const COLS = { service: "52%", qty: "16%", unit: "16%", total: "16%" } as const;
const PAY_COLS = { date: "22%", amount: "15%", method: "17%", notes: "16%", by: "30%" } as const;

type IconName = "building" | "pin" | "phone" | "calendar" | "receipt" | "scroll" | "note";

// Lucide outline icons (24×24 grid), drawn natively in the PDF like the on-screen icons
const ICON_PATHS: Record<IconName, string> = {
  building:
    "M6 2h12a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2ZM9 22v-4h6v4M8 6h.01M12 6h.01M16 6h.01M8 10h.01M12 10h.01M16 10h.01M8 14h.01M12 14h.01M16 14h.01",
  pin: "M20 10c0 5-5.5 10.2-7.4 11.8a1 1 0 0 1-1.2 0C9.5 20.2 4 15 4 10a8 8 0 0 1 16 0",
  phone:
    "M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z",
  calendar:
    "M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2ZM16 2v4M8 2v4M3 10h18",
  receipt:
    "M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1ZM14 8H8M16 12H8M13 16H8",
  scroll:
    "M15 12h-5M15 8h-5M19 17V5a2 2 0 0 0-2-2H4M8 21h12a2 2 0 0 0 2-2v-1a1 1 0 0 0-1-1H11a1 1 0 0 0-1 1v1a2 2 0 1 1-4 0V5a2 2 0 1 0-4 0v2a1 1 0 0 0 1 1h3",
  note: "M16 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8ZM15 3v4a2 2 0 0 0 2 2h4",
};

function Icon({
  name,
  color = C.green,
  size = 9,
}: {
  name: IconName;
  color?: string;
  size?: number;
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d={ICON_PATHS[name]} stroke={color} strokeWidth={2} fill="none" />
      {name === "pin" && (
        <Circle cx={12} cy={10} r={3} stroke={color} strokeWidth={2} fill="none" />
      )}
    </Svg>
  );
}

/** Shared A4 PDF for order invoices and quotations, styled like the on-screen sheet. */
export function SalesPdfDocument({ data }: { data: SalesPdfData }) {
  return (
    <Document title={data.documentTitle} author="Brandium" creator="Brandium CRM">
      <Page size="A4" style={styles.page}>
        {data.letterheadUrl && <Image src={data.letterheadUrl} style={styles.letterhead} fixed />}

        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <View style={styles.iconRow}>
              <Icon name="building" />
              <Text style={styles.smallCaps}>Bill To:</Text>
            </View>
            <Text style={styles.billName}>{data.billTo.name || "N/A"}</Text>
            <View style={{ marginTop: 4, gap: 3 }}>
              {data.billTo.company ? (
                <Text style={styles.billLine}>{data.billTo.company}</Text>
              ) : null}
              {data.billTo.address ? (
                <View style={styles.iconRow}>
                  <Icon name="pin" color={C.muted} size={8} />
                  <Text style={styles.billLine}>{data.billTo.address}</Text>
                </View>
              ) : null}
              {data.billTo.phone ? (
                <View style={styles.iconRow}>
                  <Icon name="phone" color={C.muted} size={8} />
                  <Text style={styles.billLine}>{data.billTo.phone}</Text>
                </View>
              ) : null}
            </View>
          </View>
          <View style={styles.meta}>
            <View style={[styles.iconRow, { gap: 6 }]}>
              <Text style={styles.smallCaps}>{data.codeLabel}</Text>
              <Text style={styles.codePill}>#{data.code}</Text>
            </View>
            {data.dates.map((d, index) => (
              <View key={d.label} style={styles.iconRow}>
                <Icon name="calendar" color={index === 0 ? C.green : C.muted} size={8} />
                <Text style={styles.metaLabel}>{d.label}</Text>
                <Text style={styles.metaValue}>{d.value}</Text>
              </View>
            ))}
            {data.barcodeDataUrl && <Image src={data.barcodeDataUrl} style={styles.barcode} />}
          </View>
        </View>

        <View style={styles.sectionTitle}>
          <Text style={styles.sectionTitleText}>{data.itemsTitle}</Text>
        </View>
        <View style={styles.table}>
          <View style={styles.thead} fixed>
            <Text style={[styles.th, styles.upper, { width: COLS.service }]}>Service</Text>
            <Text style={[styles.th, styles.upper, styles.center, { width: COLS.qty }]}>
              Quantity
            </Text>
            <Text style={[styles.th, styles.upper, styles.right, { width: COLS.unit }]}>
              Unit Price
            </Text>
            <Text style={[styles.th, styles.upper, styles.right, { width: COLS.total }]}>
              Total Price
            </Text>
          </View>
          {data.items.length === 0 ? (
            <View style={styles.tr}>
              <Text style={[styles.td, styles.mutedText]}>No service items specified.</Text>
            </View>
          ) : (
            data.items.map((item, index) => (
              <View key={index} style={styles.tr} wrap={false}>
                <Text style={[styles.td, { width: COLS.service }]}>{item.name}</Text>
                <Text style={[styles.td, styles.center, { width: COLS.qty }]}>{item.quantity}</Text>
                <Text style={[styles.td, styles.right, { width: COLS.unit }]}>
                  {item.unitPrice}
                </Text>
                <Text
                  style={[
                    styles.td,
                    styles.right,
                    styles.bold,
                    { width: COLS.total },
                    item.isGift ? styles.gift : {},
                  ]}
                >
                  {item.total}
                  {item.isGift ? " (Gift)" : ""}
                </Text>
              </View>
            ))
          )}
        </View>

        {data.notes ? (
          <View wrap={false}>
            <View style={styles.sectionTitle}>
              <Icon name="note" size={10} />
              <Text style={styles.sectionTitleText}>{data.notesTitle}</Text>
            </View>
            <Text style={styles.notes}>{data.notes}</Text>
          </View>
        ) : null}

        {data.payments.length > 0 && (
          <View>
            <View style={styles.sectionTitle}>
              <Icon name="receipt" size={10} />
              <Text style={styles.sectionTitleText}>Payments History</Text>
            </View>
            <View style={styles.table}>
              <View style={styles.thead}>
                <Text style={[styles.th, { width: PAY_COLS.date }]}>Date</Text>
                <Text style={[styles.th, { width: PAY_COLS.amount }]}>Amount</Text>
                <Text style={[styles.th, { width: PAY_COLS.method }]}>Method</Text>
                <Text style={[styles.th, { width: PAY_COLS.notes }]}>Notes</Text>
                <Text style={[styles.th, { width: PAY_COLS.by }]}>Recorded By</Text>
              </View>
              {data.payments.map((p, index) => (
                <View key={index} style={[styles.tr, { fontSize: 8 }]} wrap={false}>
                  <Text style={[styles.td, styles.mutedText, { width: PAY_COLS.date }]}>
                    {p.date}
                  </Text>
                  <Text
                    style={[styles.td, styles.bold, styles.sumPaid, { width: PAY_COLS.amount }]}
                  >
                    {p.amount}
                  </Text>
                  <Text style={[styles.td, { width: PAY_COLS.method }]}>{p.method}</Text>
                  <Text style={[styles.td, styles.mutedText, { width: PAY_COLS.notes }]}>
                    {p.notes}
                  </Text>
                  <Text style={[styles.td, styles.mutedText, { width: PAY_COLS.by }]}>
                    {p.recordedBy}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        <View style={styles.bottomRow} wrap={false}>
          <View style={styles.terms}>
            <View style={styles.termsTitle}>
              <Icon name="scroll" size={8} />
              <Text style={styles.termsTitleText}>Terms & Conditions</Text>
            </View>
            {data.terms.map((term, index) => (
              <View key={index} style={styles.termItem}>
                <Text style={styles.termIndex}>{index + 1}.</Text>
                <Text style={{ flex: 1 }}>{term}</Text>
              </View>
            ))}
          </View>
          <View style={styles.summary}>
            {data.totals.map((row) => {
              const strong = row.tone === "strong";
              return (
                <View key={row.label} style={[styles.sumRow, strong ? styles.sumStrongRow : {}]}>
                  <Text style={strong ? [styles.sumValue, styles.bold] : styles.sumLabel}>
                    {row.label}
                  </Text>
                  <Text
                    style={[
                      styles.sumValue,
                      strong ? styles.bold : {},
                      row.tone === "minus" ? styles.sumMinus : {},
                      row.tone === "paid" ? styles.sumPaid : {},
                    ]}
                  >
                    {row.value}
                  </Text>
                </View>
              );
            })}
            {data.amountDue ? (
              <View style={styles.due}>
                <Text>Amount Due:</Text>
                <Text>{data.amountDue}</Text>
              </View>
            ) : null}
            {data.paidStampUrl && <Image src={data.paidStampUrl} style={styles.stamp} />}
          </View>
        </View>
      </Page>
    </Document>
  );
}
