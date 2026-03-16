import { Link } from "react-router-dom";
import { PageHeroBanner } from "@/components/Marketing/PageHeroBanner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowRight, Smartphone, Upload, UserCheck, CheckCircle, Banknote, Clock, FileText, CreditCard, Home as HomeIcon, Landmark } from "lucide-react";

const steps = [
  { icon: Smartphone, step: "01", title: "Fill Online Application", desc: "Visit our website and fill out the simple online application form. Provide your basic personal and employment details.", time: "2 minutes" },
  { icon: Upload, step: "02", title: "Upload Documents", desc: "Upload your KYC documents (Aadhaar, PAN) and income proof (salary slips, bank statements) through our secure portal.", time: "3 minutes" },
  { icon: UserCheck, step: "03", title: "Quick Verification", desc: "Our team verifies your documents and assesses your eligibility. We'll contact you if any additional information is needed.", time: "2-4 hours" },
  { icon: CheckCircle, step: "04", title: "Loan Approval", desc: "Once verified, you'll receive your loan offer with terms and conditions. Review and accept the offer digitally.", time: "Same day" },
  { icon: Banknote, step: "05", title: "Money in Your Account", desc: "After approval, the loan amount is transferred directly to your bank account. Start using it immediately!", time: "Within 24 hours" },
];

const documents = [
  { title: "Identity Proof", items: ["Aadhaar Card", "PAN Card", "Voter ID", "Passport"] },
  { title: "Address Proof", items: ["Aadhaar Card", "Utility Bills", "Rent Agreement", "Bank Statement"] },
  { title: "Income Proof", items: ["Last 3 months salary slips", "Last 6 months bank statement", "Employment letter"] },
  { title: "Other", items: ["Passport size photograph", "Active bank account details"] },
];

export default function HowToApply() {
  return (
    <>
      <PageHeroBanner title="How to" highlightedWord="Apply" subtitle="Get your loan in 5 simple steps" />

      {/* Steps */}
      <section className="py-16 md:py-24">
        <div className="max-w-4xl mx-auto px-4">
          <p className="text-sm font-semibold uppercase tracking-wide text-center mb-2" style={{ color: "hsl(var(--gold-500))" }}>Application Process</p>
          <h2 className="font-heading text-3xl font-bold text-center text-foreground mb-12">Step-by-Step Guide</h2>

          <div className="space-y-6">
            {steps.map((s, i) => (
              <div key={i} className="flex gap-4 md:gap-6">
                <div className="flex flex-col items-center">
                  <div className="h-12 w-12 rounded-full flex items-center justify-center shrink-0" style={{ background: "hsl(var(--teal-100))" }}>
                    <s.icon className="h-6 w-6" style={{ color: "hsl(var(--teal-500))" }} />
                  </div>
                  {i < steps.length - 1 && <div className="w-0.5 flex-1 mt-2" style={{ background: "hsl(var(--teal-500))" }} />}
                </div>
                <Card className="flex-1 border-border">
                  <CardContent className="py-4">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-xs font-bold px-2.5 py-1 rounded-full" style={{ background: "hsl(var(--gold-500))", color: "#000" }}>Step {s.step}</span>
                      <span className="flex items-center gap-1 text-xs text-muted-foreground"><Clock className="h-3 w-3" /> {s.time}</span>
                    </div>
                    <h3 className="font-heading font-bold text-foreground">{s.title}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">{s.desc}</p>
                  </CardContent>
                </Card>
              </div>
            ))}
          </div>

          <div className="text-center mt-10">
            <Button asChild size="lg" className="rounded-full px-10 font-semibold" style={{ background: "hsl(var(--gold-500))", color: "#000" }}>
              <Link to="/apply/ref/REF-MIUHLOTL">Start Application <ArrowRight className="ml-2 h-5 w-5" /></Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Documents */}
      <section className="py-16 bg-muted">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="text-sm font-semibold uppercase tracking-wide text-center mb-2" style={{ color: "hsl(var(--gold-500))" }}>Be Prepared</p>
          <h2 className="font-heading text-3xl font-bold text-center text-foreground mb-10">Documents Required</h2>
          <p className="text-center text-muted-foreground mb-8">Keep these documents ready to ensure a smooth and quick application process</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {documents.map((d) => (
              <Card key={d.title} className="border-border">
                <CardContent className="pt-6">
                  <h3 className="font-heading font-bold text-foreground mb-3">{d.title}</h3>
                  <ul className="space-y-2">
                    {d.items.map((item) => (
                      <li key={item} className="flex items-center gap-2 text-sm text-muted-foreground">
                        <CheckCircle className="h-4 w-4 shrink-0" style={{ color: "hsl(var(--teal-500))" }} />
                        {item}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 text-center">
        <div className="max-w-3xl mx-auto px-4">
          <h2 className="font-heading text-3xl font-bold text-foreground">Ready to Get Started?</h2>
          <p className="mt-3 text-muted-foreground">Apply now and get your loan approved within 24 hours. No lengthy paperwork, no hidden charges.</p>
          <Button asChild size="lg" className="mt-8 rounded-full px-10 font-semibold" style={{ background: "hsl(var(--teal-500))" }}>
            <Link to="/apply/ref/REF-MIUHLOTL">Apply for Loan <ArrowRight className="ml-2 h-5 w-5" /></Link>
          </Button>
        </div>
      </section>
    </>
  );
}
