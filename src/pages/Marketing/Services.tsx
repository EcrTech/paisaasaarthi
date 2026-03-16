import { Link } from "react-router-dom";
import { PageHeroBanner } from "@/components/Marketing/PageHeroBanner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowRight, CheckCircle, Stethoscope, GraduationCap, Heart, Home, Plane, ShoppingBag, Check } from "lucide-react";

const loanFeatures = [
  "Loan amount from ₹10,000 to ₹1,00,000",
  "Flexible tenure from 1 to 90 days",
  "10% processing fee (transparent pricing)",
  "No collateral or guarantor required",
  "Minimal documentation",
  "Quick disbursement within 24 hours",
  "No hidden charges",
  "Easy online application",
];

const useCases = [
  { icon: Stethoscope, title: "Medical Emergency", desc: "Unexpected medical expenses shouldn't wait" },
  { icon: GraduationCap, title: "Education", desc: "Invest in your or your child's future" },
  { icon: Heart, title: "Wedding/Celebration", desc: "Make your special moments memorable" },
  { icon: Home, title: "Home Renovation", desc: "Transform your living space" },
  { icon: Plane, title: "Travel", desc: "Plan that dream vacation" },
  { icon: ShoppingBag, title: "Shopping", desc: "Buy what you need, when you need" },
];

const eligibility = [
  "Indian citizen aged 21-55 years",
  "Salaried employee with minimum 6 months experience",
  "Monthly income of at least ₹15,000",
  "Valid bank account for disbursement",
  "Valid ID proof (Aadhaar/PAN)",
];

export default function Services() {
  return (
    <>
      <PageHeroBanner title="Our" highlightedWord="Services" subtitle="Flexible personal loans tailored to your needs" />

      {/* What We Offer */}
      <section className="py-16 md:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="text-sm font-semibold uppercase tracking-wide mb-2" style={{ color: "hsl(var(--gold-500))" }}>What We Offer</p>
          <h2 className="font-heading text-3xl md:text-4xl font-bold text-foreground">Personal Loans Made Simple</h2>
          <p className="mt-4 text-muted-foreground max-w-2xl leading-relaxed">
            At Paisaa Saarthi, we offer quick and hassle-free personal loans designed specifically for salaried individuals. Our streamlined process ensures you get the money you need without the usual banking headaches.
          </p>
          <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-3">
            {loanFeatures.map((f) => (
              <div key={f} className="flex items-center gap-3">
                <CheckCircle className="h-5 w-5 shrink-0" style={{ color: "hsl(var(--teal-500))" }} />
                <span className="text-sm text-foreground">{f}</span>
              </div>
            ))}
          </div>
          <Button asChild size="lg" className="mt-8 rounded-full px-8 font-semibold" style={{ background: "hsl(var(--gold-500))", color: "#000" }}>
            <Link to="/apply/ref/REF-MIUHLOTL">Apply Now <ArrowRight className="ml-2 h-5 w-5" /></Link>
          </Button>
        </div>
      </section>

      {/* Use Cases */}
      <section className="py-16 bg-muted">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="text-sm font-semibold uppercase tracking-wide text-center mb-2" style={{ color: "hsl(var(--gold-500))" }}>Use Your Loan For</p>
          <h2 className="font-heading text-3xl font-bold text-center text-foreground mb-10">Loans for Every Need</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {useCases.map((u) => (
              <Card key={u.title} className="border-border card-hover-lift">
                <CardContent className="pt-6 text-center">
                  <div className="mx-auto h-14 w-14 rounded-full flex items-center justify-center mb-4" style={{ background: "hsl(var(--teal-100))" }}>
                    <u.icon className="h-7 w-7" style={{ color: "hsl(var(--teal-500))" }} />
                  </div>
                  <h3 className="font-heading font-bold text-foreground">{u.title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{u.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Eligibility */}
      <section className="py-16 md:py-24">
        <div className="max-w-3xl mx-auto px-4 text-center">
          <h2 className="font-heading text-3xl font-bold text-foreground mb-8">Eligibility Criteria</h2>
          <div className="space-y-3 text-left max-w-md mx-auto">
            {eligibility.map((e) => (
              <div key={e} className="flex items-center gap-3">
                <Check className="h-5 w-5 shrink-0" style={{ color: "hsl(var(--teal-500))" }} />
                <span className="text-foreground">{e}</span>
              </div>
            ))}
          </div>
          <div className="mt-10 p-6 rounded-2xl" style={{ background: "hsl(var(--teal-100))" }}>
            <h3 className="font-heading font-bold text-foreground">Check Your Eligibility</h3>
            <p className="text-sm text-muted-foreground mt-1">It takes just 2 minutes and won't affect your credit score</p>
            <Button asChild size="lg" className="mt-4 rounded-full px-8 font-semibold" style={{ background: "hsl(var(--teal-500))" }}>
              <Link to="/apply/ref/REF-MIUHLOTL">Check Now</Link>
            </Button>
          </div>
        </div>
      </section>
    </>
  );
}
