import { PageHeroBanner } from "@/components/Marketing/PageHeroBanner";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight, Mail } from "lucide-react";

export default function Privacy() {
  return (
    <>
      <PageHeroBanner title="Privacy" highlightedWord="Policy" subtitle="How we collect, use, and protect your personal information" />
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="flex flex-wrap items-center gap-4 mb-10">
          <p className="text-sm text-muted-foreground">Effective: 18-02-2025</p>
          <span className="inline-block rounded-full px-4 py-1 text-xs font-semibold" style={{ background: "hsl(var(--teal-100))", color: "hsl(var(--teal-600))" }}>DPDPA 2023 Compliant</span>
        </div>

        <div className="space-y-10 text-sm leading-relaxed text-muted-foreground">

          {/* Section 1 */}
          <div>
            <div className="flex items-center gap-3 mb-3">
              <span className="flex items-center justify-center h-7 w-7 rounded-full text-xs font-bold text-white" style={{ background: "hsl(var(--teal-500))" }}>1</span>
              <h2 className="font-heading text-xl font-bold text-foreground">Introduction</h2>
            </div>
            <p>Paisaa Saarthi ("we," "us," or "our") operates as a Loan Service Provider (LSP) in partnership with Skyrise Credit and Marketing Limited, an RBI-registered Non-Banking Financial Company (NBFC). We are committed to protecting your personal data in compliance with the Digital Personal Data Protection Act (DPDPA), 2023 and applicable RBI guidelines.</p>
            <p className="mt-3">This Privacy Policy outlines how we collect, use, share, and protect your information when you use our platform to access loan services.</p>
          </div>

          {/* Section 2 */}
          <div>
            <div className="flex items-center gap-3 mb-3">
              <span className="flex items-center justify-center h-7 w-7 rounded-full text-xs font-bold text-white" style={{ background: "hsl(var(--teal-500))" }}>2</span>
              <h2 className="font-heading text-xl font-bold text-foreground">Data We Collect</h2>
            </div>
            <p className="mb-4">We may collect the following categories of personal data:</p>
            <div className="space-y-3">
              <div>
                <h4 className="font-semibold text-foreground">Identification Data</h4>
                <p>Full name, date of birth, gender, PAN, Aadhaar (with consent), photographs</p>
              </div>
              <div>
                <h4 className="font-semibold text-foreground">Contact Information</h4>
                <p>Mobile number, email address, residential/office address</p>
              </div>
              <div>
                <h4 className="font-semibold text-foreground">Financial Information</h4>
                <p>Bank account details, income proof, employment details, credit history</p>
              </div>
              <div>
                <h4 className="font-semibold text-foreground">Device & Usage Data</h4>
                <p>IP address, device ID, browser type, app usage logs, location data (with consent)</p>
              </div>
              <div>
                <h4 className="font-semibold text-foreground">Loan Application Data</h4>
                <p>Requested loan amount, purpose, repayment preferences</p>
              </div>
              <div>
                <h4 className="font-semibold text-foreground">Third-Party Data</h4>
                <p>Credit bureau reports, employment verification, alternative data sources (with consent)</p>
              </div>
            </div>
          </div>

          {/* Section 3 */}
          <div>
            <div className="flex items-center gap-3 mb-3">
              <span className="flex items-center justify-center h-7 w-7 rounded-full text-xs font-bold text-white" style={{ background: "hsl(var(--teal-500))" }}>3</span>
              <h2 className="font-heading text-xl font-bold text-foreground">Purpose of Use</h2>
            </div>
            <p className="mb-3">Your data is processed for the following purposes:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>To verify identity and complete KYC as required by law</li>
              <li>To assess loan eligibility and creditworthiness</li>
              <li>To facilitate the loan application process with the NBFC</li>
              <li>To prevent fraud and ensure platform security</li>
              <li>To comply with legal and regulatory requirements</li>
              <li>To provide customer support and respond to inquiries</li>
              <li>To improve our platform and services</li>
            </ul>
          </div>

          {/* Section 4 */}
          <div>
            <div className="flex items-center gap-3 mb-3">
              <span className="flex items-center justify-center h-7 w-7 rounded-full text-xs font-bold text-white" style={{ background: "hsl(var(--teal-500))" }}>4</span>
              <h2 className="font-heading text-xl font-bold text-foreground">Data Sharing & Third Parties</h2>
            </div>
            <p className="mb-3">We may share your data with:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Our NBFC Partner (Skyrise Credit and Marketing Limited)</strong> – for credit evaluation and loan processing</li>
              <li><strong>Credit Information Companies (CICs)</strong> – as required for credit assessment</li>
              <li><strong>Government and Regulatory Bodies</strong> – upon lawful request or as mandated</li>
              <li><strong>Technical & Service Providers</strong> – cloud hosting, analytics, and communication services (only verified and contractually bound partners)</li>
            </ul>
            <p className="mt-3">We do not sell your personal data to third parties.</p>
          </div>

          {/* Section 5 */}
          <div>
            <div className="flex items-center gap-3 mb-3">
              <span className="flex items-center justify-center h-7 w-7 rounded-full text-xs font-bold text-white" style={{ background: "hsl(var(--teal-500))" }}>5</span>
              <h2 className="font-heading text-xl font-bold text-foreground">Consent, Control & Withdrawal</h2>
            </div>
            <p className="mb-3">You may provide or withdraw consent at any time for:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Collection and use of personal data</li>
              <li>Marketing and promotional communications</li>
              <li>Sharing of data with third parties beyond what is necessary for service delivery</li>
            </ul>
            <p className="mt-3">Note: Withdrawal of consent for essential services may impact your ability to use our platform and complete loan transactions.</p>
          </div>

          {/* Section 6 */}
          <div>
            <div className="flex items-center gap-3 mb-3">
              <span className="flex items-center justify-center h-7 w-7 rounded-full text-xs font-bold text-white" style={{ background: "hsl(var(--teal-500))" }}>6</span>
              <h2 className="font-heading text-xl font-bold text-foreground">Data Security & Retention</h2>
            </div>
            <p className="mb-3">We implement industry-standard security measures to safeguard your data, including:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>End-to-end encryption (AES-256)</li>
              <li>Secure transmission protocols (TLS/HTTPS)</li>
              <li>Access controls and audit trails</li>
              <li>Data stored only on servers located within India</li>
            </ul>
            <p className="mt-3">We retain your data only as long as necessary to provide services or as required by law. Upon request, data will be securely deleted in accordance with applicable regulations.</p>
          </div>

          {/* Section 7 */}
          <div>
            <div className="flex items-center gap-3 mb-3">
              <span className="flex items-center justify-center h-7 w-7 rounded-full text-xs font-bold text-white" style={{ background: "hsl(var(--teal-500))" }}>7</span>
              <h2 className="font-heading text-xl font-bold text-foreground">Your Rights</h2>
            </div>
            <p className="mb-3">Under DPDPA 2023, you have the right to:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Access your personal data held by us</li>
              <li>Request correction of inaccurate or incomplete data</li>
              <li>Request deletion of your data (subject to legal obligations)</li>
              <li>Obtain data portability in a structured format</li>
              <li>Lodge a complaint with the Data Protection Board of India</li>
            </ul>
            <div className="mt-4 rounded-lg border border-border p-4 bg-muted">
              <p className="font-semibold text-foreground mb-2">Data Protection Officer</p>
              <p><strong>Name:</strong> Mr. Abhishek</p>
              <p><a href="mailto:info@PaisaaSaarthi.com" className="underline" style={{ color: "hsl(var(--teal-500))" }}>info@PaisaaSaarthi.com</a></p>
              <p><a href="tel:+919654485776" className="underline" style={{ color: "hsl(var(--teal-500))" }}>96544 85776</a></p>
            </div>
          </div>

          {/* Section 8 */}
          <div>
            <div className="flex items-center gap-3 mb-3">
              <span className="flex items-center justify-center h-7 w-7 rounded-full text-xs font-bold text-white" style={{ background: "hsl(var(--teal-500))" }}>8</span>
              <h2 className="font-heading text-xl font-bold text-foreground">Children's Privacy</h2>
            </div>
            <p>Our services are not intended for individuals under the age of 18. We do not knowingly collect personal data from minors. If we become aware of such data being collected, we will take steps to delete it promptly.</p>
          </div>

          {/* Section 9 */}
          <div>
            <div className="flex items-center gap-3 mb-3">
              <span className="flex items-center justify-center h-7 w-7 rounded-full text-xs font-bold text-white" style={{ background: "hsl(var(--teal-500))" }}>9</span>
              <h2 className="font-heading text-xl font-bold text-foreground">Policy Updates</h2>
            </div>
            <p>We may update this Privacy Policy from time to time to reflect changes in our practices or legal requirements. Notifications of significant changes will be made via our app or customer support page. Continued use of our services after updates constitutes acceptance of the revised policy.</p>
          </div>

          {/* Section 10 */}
          <div>
            <div className="flex items-center gap-3 mb-3">
              <span className="flex items-center justify-center h-7 w-7 rounded-full text-xs font-bold text-white" style={{ background: "hsl(var(--teal-500))" }}>10</span>
              <h2 className="font-heading text-xl font-bold text-foreground">Regulatory Compliance</h2>
            </div>
            <p className="mb-3">Paisaa Saarthi operates as a Loan Service Provider (LSP) under the framework of the RBI's Digital Lending Directions, 2022 (updated 2025). We are not the lender; we act solely as a technology platform facilitating digital loan applications on behalf of our partner NBFC.</p>
            <p className="font-semibold text-foreground mb-2">Applicable Regulations:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>RBI Digital Lending Directions, 2025</li>
              <li>Digital Personal Data Protection Act (DPDP Act), 2023</li>
              <li>Information Technology Act, 2000</li>
              <li>Prevention of Money Laundering Act (PMLA)</li>
            </ul>
          </div>
        </div>

        {/* CTA */}
        <div className="mt-16 rounded-2xl p-8 text-center text-white" style={{ background: "linear-gradient(135deg, hsl(var(--teal-600)), hsl(var(--teal-500)))" }}>
          <h2 className="font-heading text-2xl font-bold">Questions About Your Data?</h2>
          <p className="mt-2 text-white/70">Contact our Data Protection Officer for any privacy-related inquiries</p>
          <div className="flex flex-wrap justify-center gap-4 mt-6">
            <Button asChild size="lg" className="rounded-full px-8 font-semibold" style={{ background: "hsl(var(--gold-500))", color: "#000" }}>
              <Link to="/apply/ref/REF-MIUHLOTL">Apply Now <ArrowRight className="ml-2 h-5 w-5" /></Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="rounded-full px-8 font-semibold border-white text-white hover:bg-white/10">
              <a href="mailto:info@PaisaaSaarthi.com"><Mail className="mr-2 h-5 w-5" /> Contact DPO</a>
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
