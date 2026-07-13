import path from "node:path";
import {
  Document,
  Font,
  Page,
  StyleSheet,
  Text,
  View,
  renderToBuffer,
  type TextProps,
} from "@react-pdf/renderer";

const thaiFontPath = path.join(
  process.cwd(),
  "node_modules",
  "@fontsource",
  "noto-sans-thai",
  "files",
  "noto-sans-thai-thai-400-normal.woff",
);

Font.register({ family: "NotoSansThaiPdf", src: thaiFontPath });

const styles = StyleSheet.create({
  page: {
    padding: 38,
    backgroundColor: "#fffefa",
    color: "#0d2851",
  },
  frame: {
    height: "100%",
    border: "2px solid #e58b07",
    padding: 38,
    alignItems: "center",
    justifyContent: "center",
    textAlign: "center",
  },
  eyebrow: { fontSize: 12, color: "#bd6700", marginBottom: 14, letterSpacing: 1.6 },
  brand: { fontSize: 25, marginBottom: 28 },
  title: { fontSize: 19, marginBottom: 14 },
  learner: { fontSize: 30, color: "#bd6700", marginBottom: 14 },
  body: { fontSize: 14, lineHeight: 1.8, marginBottom: 8, maxWidth: 560 },
  course: { fontSize: 21, marginBottom: 22, maxWidth: 560 },
  divider: { width: 90, height: 2, backgroundColor: "#e58b07", marginVertical: 18 },
  footer: { flexDirection: "row", width: "100%", justifyContent: "space-between", marginTop: 28 },
  footerBlock: { width: "44%", borderTop: "1px solid #dcd3c6", paddingTop: 8 },
  footerText: { fontSize: 10, color: "#526077" },
  code: { fontFamily: "Helvetica", fontSize: 9, color: "#526077", marginTop: 22 },
});

function isThaiRun(value: string) {
  return /[\u0E00-\u0E7F]/.test(value);
}

function MixedText({
  value,
  style,
}: {
  value: string;
  style?: TextProps["style"];
}) {
  const runs = value.match(/[\u0E00-\u0E7F\s]+|[^\u0E00-\u0E7F\s]+/g) ?? [value];
  return (
    <Text style={style}>
      {runs.map((run, index) => (
        <Text
          key={`${run}-${index}`}
          style={{ fontFamily: isThaiRun(run) ? "NotoSansThaiPdf" : "Helvetica" }}
        >
          {run}
        </Text>
      ))}
    </Text>
  );
}

export type CertificatePdfInput = {
  certificateCode: string;
  learnerName: string;
  courseTitle: string;
  instructorName: string;
  completedAt: Date;
  templateVersion: string;
};

function CertificateDocument({ certificate }: { certificate: CertificatePdfInput }) {
  return (
    <Document
      title={`Certificate ${certificate.certificateCode}`}
      author="AI เริ่มได้"
      subject={certificate.courseTitle}
    >
      <Page size="A4" orientation="landscape" style={styles.page}>
        <View style={styles.frame}>
          <MixedText value="ใบประกาศการจบหลักสูตร" style={styles.eyebrow} />
          <MixedText value="AI เริ่มได้" style={styles.brand} />
          <MixedText value="ขอมอบใบประกาศนี้ให้แก่" style={styles.title} />
          <MixedText value={certificate.learnerName} style={styles.learner} />
          <MixedText value="เพื่อรับรองว่าได้ผ่านเกณฑ์การจบหลักสูตร" style={styles.body} />
          <MixedText value={certificate.courseTitle} style={styles.course} />
          <View style={styles.divider} />
          <View style={styles.footer}>
            <View style={styles.footerBlock}>
              <MixedText value={certificate.instructorName} style={styles.body} />
              <MixedText value="ผู้สอน" style={styles.footerText} />
            </View>
            <View style={styles.footerBlock}>
              <MixedText
                value={certificate.completedAt.toLocaleDateString("th-TH", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                  timeZone: "Asia/Bangkok",
                })}
                style={styles.body}
              />
              <MixedText value="วันที่จบหลักสูตร" style={styles.footerText} />
            </View>
          </View>
          <Text style={styles.code}>
            {certificate.certificateCode} · template {certificate.templateVersion}
          </Text>
        </View>
      </Page>
    </Document>
  );
}

export async function renderCertificatePdf(certificate: CertificatePdfInput) {
  return renderToBuffer(<CertificateDocument certificate={certificate} />);
}
