import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowRight, Shield, Smartphone, Lock, Zap, Eye, Clock, Star, Users, CheckCircle } from "lucide-react";

const REFERRAL_LINK = "/apply/ref/REF-MIUHLOTL";

const trustBadges = [
  { icon: Shield, label: "RBI Registered" },
  { icon: Star, label: "4.5★ Play Store" },
  { icon: Users, label: "50,000+ Customers" },
  { icon: Lock, label: "256-bit Secure" },
];

const features = [
  { icon: Shield, title: "RBI Registered Partner", desc: "We partner with RBI-regulated NBFCs for your complete safety and peace of mind." },
  { icon: Smartphone, title: "100% Digital Process", desc: "Apply from anywhere, anytime. No branch visits, no paperwork, no hassle." },
  { icon: Lock, title: "Bank-Grade Security", desc: "Your data is protected with 256-bit SSL encryption. Your information is always safe." },
  { icon: Zap, title: "Instant Approval", desc: "Get your loan approved within minutes. No long waiting times." },
  { icon: Eye, title: "Transparent Pricing", desc: "No hidden charges. See exactly what you pay before you apply." },
  { icon: Clock, title: "Flexible Repayment", desc: "Choose tenure from 7 to 90 days. Pay back when it's convenient for you." },
];

const stats = [
  { value: "50,000+", label: "Happy Customers" },
  { value: "₹25 Cr+", label: "Loans Disbursed" },
  { value: "4.5★", label: "Play Store Rating" },
  { value: "<4 hours", label: "Average Disbursal" },
];

const testimonials = [
  { name: "Rahul S.", city: "Mumbai", text: "Bohot fast service! 3 ghante mein paisa aa gaya. Thank you PaisaaSaarthi!", initial: "R" },
  { name: "Priya M.", city: "Delhi", text: "Very easy process. No paperwork tension. Highly recommended for emergency loans.", initial: "P" },
  { name: "Amit K.", city: "Bangalore", text: "Finally a loan app that doesn't harass you. Transparent charges, good service.", initial: "A" },
];

export default function Home() {
  return (
    <>
      {/* Hero Section - Teal gradient like real site */}
      <section
        className="relative py-20 md:py-28 text-center text-white"
        style={{ background: "linear-gradient(135deg, hsl(var(--teal-600)) 0%, hsl(var(--teal-500)) 50%, hsl(var(--teal-400)) 100%)" }}
      >
        <div className="max-w-4xl mx-auto px-4">
          <p className="text-sm md:text-base mb-4" style={{ color: "hsl(var(--gold-500))" }}>
            Chhote Loans, Badi Udaan ✨
          </p>
          <h1 className="font-heading text-4xl md:text-6xl font-extrabold leading-tight">
            Get ₹5,000 to ₹1,00,000 in Your Account{" "}
            <span style={{ color: "hsl(var(--gold-500))" }}>Within 24 Hours</span>
          </h1>
          <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-6 text-sm text-white/80">
            <span className="flex items-center gap-2"><CheckCircle className="h-4 w-4 text-green-400" /> 100% Digital - No branch visit, no paperwork</span>
            <span className="flex items-center gap-2"><CheckCircle className="h-4 w-4 text-green-400" /> Instant Approval - Know in 10 minutes</span>
            <span className="flex items-center gap-2"><Shield className="h-4 w-4 text-white/70" /> RBI Registered Partner - Safe & Secure</span>
          </div>
          <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
            <Button asChild size="lg" className="rounded-full text-base px-8 font-semibold" style={{ background: "hsl(var(--gold-500))", color: "#000" }}>
              <Link to={REFERRAL_LINK}>Apply Now - Takes 3 Minutes</Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="rounded-full text-base px-8 font-semibold border-white/30 text-white hover:bg-white/10 bg-transparent">
              <Link to={REFERRAL_LINK}>Check Eligibility</Link>
            </Button>
          </div>
          <p className="mt-3 text-xs text-white/50">(won't affect your credit score)</p>

          {/* Trust badges */}
          <div className="mt-10 bg-white/10 backdrop-blur rounded-2xl px-6 py-4 max-w-2xl mx-auto">
            <div className="flex flex-wrap items-center justify-center gap-6 md:gap-10">
              {trustBadges.map((b) => (
                <div key={b.label} className="flex items-center gap-2 text-sm text-white/90">
                  <b.icon className="h-4 w-4" />
                  <span className="font-medium">{b.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Why Choose Section */}
      <section className="py-16 md:py-24 bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="font-heading text-3xl md:text-4xl font-bold text-center text-foreground">
            Why Choose <span style={{ color: "hsl(var(--gold-500))" }}>PaisaaSaarthi?</span>
          </h2>
          <p className="mt-3 text-center text-muted-foreground max-w-xl mx-auto">
            We're trusted by over 50,000+ customers for fast, secure, and transparent loans.
          </p>
          <div className="mt-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((f) => (
              <Card key={f.title} className="border-border card-hover-lift">
                <CardContent className="pt-6">
                  <div className="h-12 w-12 rounded-full flex items-center justify-center mb-4" style={{ background: "hsl(var(--teal-100))" }}>
                    <f.icon className="h-6 w-6" style={{ color: "hsl(var(--teal-500))" }} />
                  </div>
                  <h3 className="font-heading font-bold text-foreground">{f.title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{f.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="py-12" style={{ background: "hsl(var(--teal-100))" }}>
        <div className="max-w-5xl mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            {stats.map((s) => (
              <div key={s.label}>
                <div className="font-heading text-3xl md:text-4xl font-extrabold" style={{ color: "hsl(var(--teal-600))" }}>{s.value}</div>
                <div className="text-sm mt-1 text-muted-foreground">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-16 md:py-24 bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="font-heading text-3xl font-bold text-center text-foreground">What Our Customers Say</h2>
          <p className="mt-3 text-center text-muted-foreground">Real reviews from real customers who got their loans without the hassle.</p>
          <div className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-6">
            {testimonials.map((t) => (
              <Card key={t.name} className="border-border">
                <CardContent className="pt-6">
                  <p className="text-sm text-muted-foreground italic mb-4">"{t.text}"</p>
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full flex items-center justify-center font-bold text-white" style={{ background: "hsl(var(--teal-500))" }}>
                      {t.initial}
                    </div>
                    <div>
                      <p className="font-semibold text-foreground text-sm">{t.name}</p>
                      <p className="text-xs text-muted-foreground">{t.city}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 md:py-20 text-center text-white" style={{ background: "linear-gradient(135deg, hsl(var(--teal-600)) 0%, hsl(var(--teal-500)) 100%)" }}>
        <div className="max-w-3xl mx-auto px-4">
          <p className="text-sm mb-2" style={{ color: "hsl(var(--gold-500))" }}>Start Your Journey Today</p>
          <h2 className="font-heading text-3xl md:text-4xl font-bold">Ready for Your Financial Freedom?</h2>
          <p className="mt-4 text-white/70">Join 50,000+ Indians who got loans without the hassle. Your money is just a few clicks away.</p>
          <Button asChild size="lg" className="mt-8 rounded-full text-base px-10 font-semibold" style={{ background: "hsl(var(--gold-500))", color: "#000" }}>
            <Link to={REFERRAL_LINK}>Apply Now - Get Money Today <ArrowRight className="ml-2 h-5 w-5" /></Link>
          </Button>
          <p className="mt-3 text-xs text-white/50">100% safe and secure. Takes only 3 minutes.</p>
        </div>
      </section>
    </>
  );
}
