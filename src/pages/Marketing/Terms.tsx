import { PageHeroBanner } from "@/components/Marketing/PageHeroBanner";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

export default function Terms() {
  return (
    <>
      <PageHeroBanner title="Terms &" highlightedWord="Conditions" subtitle="Please read these terms carefully before using our services" />
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <p className="text-sm text-muted-foreground mb-10">Effective Date: 01-02-2026</p>

        <div className="space-y-10 text-sm leading-relaxed text-muted-foreground">

          {/* Section 1 */}
          <div>
            <div className="flex items-center gap-3 mb-3">
              <span className="flex items-center justify-center h-7 w-7 rounded-full text-xs font-bold text-white" style={{ background: "hsl(var(--teal-500))" }}>1</span>
              <h2 className="font-heading text-xl font-bold text-foreground">Service Overview</h2>
            </div>
            <p>Paisaa Saarthi ("we," "us," or "our") operates as a Loan Service Provider (LSP) and serves as a digital intermediary connecting borrowers with Skyrise Credit and Marketing Limited, a Reserve Bank of India (RBI)-registered Non-Banking Financial Company (NBFC).</p>
            <p className="mt-3">All loans facilitated through our platform are originated, sanctioned, and disbursed exclusively by our lending partner NBFC in accordance with applicable laws and RBI guidelines.</p>
            <p className="mt-3">Paisaa Saarthi does not provide loans directly. Our role is limited to facilitating the loan application process and acting as an intermediary between borrowers and the lending NBFC.</p>
          </div>

          {/* Section 2 */}
          <div>
            <div className="flex items-center gap-3 mb-3">
              <span className="flex items-center justify-center h-7 w-7 rounded-full text-xs font-bold text-white" style={{ background: "hsl(var(--teal-500))" }}>2</span>
              <h2 className="font-heading text-xl font-bold text-foreground">Eligibility</h2>
            </div>
            <ul className="list-disc pl-5 space-y-1">
              <li>Be an Indian resident</li>
              <li>Be at least 18 years of age</li>
              <li>Possess valid KYC documentation</li>
              <li>Meet the creditworthiness standards set by the NBFC</li>
            </ul>
          </div>

          {/* Section 3 */}
          <div>
            <div className="flex items-center gap-3 mb-3">
              <span className="flex items-center justify-center h-7 w-7 rounded-full text-xs font-bold text-white" style={{ background: "hsl(var(--teal-500))" }}>3</span>
              <h2 className="font-heading text-xl font-bold text-foreground">Loan Terms</h2>
            </div>
            <p>All applicable interest rates, loan tenure, processing fees, late payment charges, and other terms will be disclosed to the borrower through a Key Fact Statement (KFS) prior to loan disbursal, in compliance with RBI Digital Lending Directions.</p>
            <p className="mt-3">Loan terms are determined solely by the NBFC based on the borrower's credit profile and applicable lending policies.</p>
          </div>

          {/* Section 4 */}
          <div>
            <div className="flex items-center gap-3 mb-3">
              <span className="flex items-center justify-center h-7 w-7 rounded-full text-xs font-bold text-white" style={{ background: "hsl(var(--teal-500))" }}>4</span>
              <h2 className="font-heading text-xl font-bold text-foreground">User Obligations</h2>
            </div>
            <ul className="list-disc pl-5 space-y-1">
              <li>Provide accurate, complete, and truthful information during the application process</li>
              <li>Not use our services for any fraudulent, illegal, or unauthorized purpose</li>
              <li>Comply with all terms and conditions of the loan agreement executed with the NBFC</li>
            </ul>
          </div>

          {/* Section 5 */}
          <div>
            <div className="flex items-center gap-3 mb-3">
              <span className="flex items-center justify-center h-7 w-7 rounded-full text-xs font-bold text-white" style={{ background: "hsl(var(--teal-500))" }}>5</span>
              <h2 className="font-heading text-xl font-bold text-foreground">Liability & Limitations</h2>
            </div>
            <p>Paisaa Saarthi acts solely as a facilitator and does not assume liability for the approval, rejection, or terms of any loan offered by the NBFC.</p>
            <p className="mt-3">All lending decisions, including interest rates, loan amounts, and eligibility criteria, are made by the NBFC at its sole discretion.</p>
          </div>

          {/* Section 6 */}
          <div>
            <div className="flex items-center gap-3 mb-3">
              <span className="flex items-center justify-center h-7 w-7 rounded-full text-xs font-bold text-white" style={{ background: "hsl(var(--teal-500))" }}>6</span>
              <h2 className="font-heading text-xl font-bold text-foreground">Data Usage & Privacy</h2>
            </div>
            <p>By using our platform, you consent to the collection, storage, and processing of your personal and financial data in accordance with our Privacy Policy. Your data may be shared with the NBFC and authorized third parties solely for loan processing and verification purposes.</p>
          </div>

          {/* Section 7 */}
          <div>
            <div className="flex items-center gap-3 mb-3">
              <span className="flex items-center justify-center h-7 w-7 rounded-full text-xs font-bold text-white" style={{ background: "hsl(var(--teal-500))" }}>7</span>
              <h2 className="font-heading text-xl font-bold text-foreground">Dispute Resolution & Support</h2>
            </div>
            <p className="mb-3">For any grievances, complaints, or queries related to your loan application or our services, you may contact us at:</p>
            <p>Email: <a href="mailto:info@paisaasaarthi.com" className="underline" style={{ color: "hsl(var(--teal-500))" }}>info@paisaasaarthi.com</a></p>
            <p>Grievance: <a href="mailto:grievance@paisaasaarthi.com" className="underline" style={{ color: "hsl(var(--teal-500))" }}>grievance@paisaasaarthi.com</a></p>
            <p className="mt-3">For loan-specific disputes, users may also contact the NBFC directly using details provided in the loan agreement.</p>
          </div>

          {/* Section 8 */}
          <div>
            <div className="flex items-center gap-3 mb-3">
              <span className="flex items-center justify-center h-7 w-7 rounded-full text-xs font-bold text-white" style={{ background: "hsl(var(--teal-500))" }}>8</span>
              <h2 className="font-heading text-xl font-bold text-foreground">Amendments</h2>
            </div>
            <p>Paisaa Saarthi reserves the right to amend these Terms & Conditions at any time without prior notice. Any changes will be updated on our website/app and shall be effective immediately upon posting. Continued use of our services constitutes acceptance of the revised terms.</p>
          </div>

          {/* Section 9 */}
          <div>
            <div className="flex items-center gap-3 mb-3">
              <span className="flex items-center justify-center h-7 w-7 rounded-full text-xs font-bold text-white" style={{ background: "hsl(var(--teal-500))" }}>9</span>
              <h2 className="font-heading text-xl font-bold text-foreground">Licensing & Compliance</h2>
            </div>
            <p>Paisaa Saarthi operates as an authorized Loan Service Provider (LSP) and acts solely as an intermediary between borrowers and the NBFC.</p>
            <p className="mt-3">All loans are extended by Skyrise Credit and Marketing Limited, a company registered under the Companies Act, 2013 and licensed by the Reserve Bank of India as a Non-Banking Financial Company (NBFC).</p>
          </div>
        </div>

        {/* CTA */}
        <div className="mt-16 rounded-2xl p-8 text-center text-white" style={{ background: "linear-gradient(135deg, hsl(var(--teal-600)), hsl(var(--teal-500)))" }}>
          <h2 className="font-heading text-2xl font-bold">Ready to Apply for a Loan?</h2>
          <p className="mt-2 text-white/70">By applying, you agree to these Terms & Conditions and our Privacy Policy</p>
          <Button asChild size="lg" className="mt-6 rounded-full px-10 font-semibold" style={{ background: "hsl(var(--gold-500))", color: "#000" }}>
            <Link to="/apply/ref/REF-MIUHLOTL">Apply Now <ArrowRight className="ml-2 h-5 w-5" /></Link>
          </Button>
        </div>
      </div>
    </>
  );
}
