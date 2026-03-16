import { PageHeroBanner } from "@/components/Marketing/PageHeroBanner";
import { Card, CardContent } from "@/components/ui/card";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Target, Eye, Heart, Lightbulb, ArrowRight } from "lucide-react";

const values = [
  { icon: Heart, title: "Customer First", desc: "We put our customers at the heart of everything we do." },
  { icon: Eye, title: "Transparency", desc: "No hidden charges, clear terms, and honest communication." },
  { icon: Lightbulb, title: "Innovation", desc: "Continuously improving our processes for faster service." },
  { icon: Target, title: "Trust", desc: "Building lasting relationships through reliability." },
];

export default function About() {
  return (
    <>
      <PageHeroBanner title="About" highlightedWord="Paisaa Saarthi" subtitle="Your trusted companion for small-ticket personal loans" />

      {/* Our Story */}
      <section className="py-16 md:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide mb-2" style={{ color: "hsl(var(--gold-500))" }}>Our Story</p>
              <h2 className="font-heading text-3xl md:text-4xl font-bold text-foreground">Empowering Dreams, One Loan at a Time</h2>
              <div className="mt-6 space-y-4 text-muted-foreground leading-relaxed">
                <p>Paisaa Saarthi was founded with a simple yet powerful mission: to make financial assistance accessible to every salaried individual in India, regardless of their credit history or financial background.</p>
                <p>We understand that life's unexpected moments don't wait for the right time. Whether it's a medical emergency, a family celebration, or an educational opportunity, we're here to ensure that money never becomes a barrier to your dreams.</p>
                <p>Our name, "Paisaa Saarthi," means "Money Companion" – and that's exactly what we strive to be. A trusted partner who stands by you during your financial needs with quick, transparent, and hassle-free loan services.</p>
              </div>
            </div>
            <div className="rounded-2xl p-10 text-center text-white" style={{ background: "linear-gradient(135deg, hsl(var(--teal-600)), hsl(var(--teal-500)))" }}>
              <div className="text-6xl mb-4">🤝</div>
              <h3 className="font-heading text-2xl font-bold">Chhote Loans, Badi Udaan</h3>
              <p className="mt-2 text-white/70">Small loans that help you take big leaps in life</p>
            </div>
          </div>
        </div>
      </section>

      {/* Mission & Vision */}
      <section className="py-16 bg-muted">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <Card className="border-border">
              <CardContent className="pt-6">
                <div className="h-12 w-12 rounded-full flex items-center justify-center mb-4" style={{ background: "hsl(var(--teal-100))" }}>
                  <Target className="h-6 w-6" style={{ color: "hsl(var(--teal-500))" }} />
                </div>
                <h3 className="font-heading font-bold text-xl text-foreground">Our Mission</h3>
                <p className="mt-2 text-muted-foreground">To provide quick, transparent, and accessible small-ticket personal loans to salaried individuals across India, helping them overcome financial challenges and achieve their goals without the burden of complex procedures.</p>
              </CardContent>
            </Card>
            <Card className="border-border">
              <CardContent className="pt-6">
                <div className="h-12 w-12 rounded-full flex items-center justify-center mb-4" style={{ background: "hsl(var(--teal-100))" }}>
                  <Eye className="h-6 w-6" style={{ color: "hsl(var(--teal-500))" }} />
                </div>
                <h3 className="font-heading font-bold text-xl text-foreground">Our Vision</h3>
                <p className="mt-2 text-muted-foreground">To become India's most trusted small-ticket loan provider, known for our customer-centric approach, lightning-fast disbursements, and commitment to financial inclusion for all.</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Core Values */}
      <section className="py-16 md:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="text-sm font-semibold uppercase tracking-wide text-center mb-2" style={{ color: "hsl(var(--gold-500))" }}>What We Stand For</p>
          <h2 className="font-heading text-3xl font-bold text-center text-foreground mb-10">Our Core Values</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {values.map((v) => (
              <Card key={v.title} className="border-border card-hover-lift text-center">
                <CardContent className="pt-6">
                  <div className="mx-auto h-12 w-12 rounded-full flex items-center justify-center mb-4" style={{ background: "hsl(var(--teal-100))" }}>
                    <v.icon className="h-6 w-6" style={{ color: "hsl(var(--teal-500))" }} />
                  </div>
                  <h3 className="font-heading font-bold text-foreground">{v.title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{v.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 text-center text-white" style={{ background: "linear-gradient(135deg, hsl(var(--teal-600)), hsl(var(--teal-500)))" }}>
        <div className="max-w-3xl mx-auto px-4">
          <h2 className="font-heading text-3xl font-bold">Join 10,000+ Happy Customers</h2>
          <p className="mt-4 text-white/70">Experience the Paisaa Saarthi difference. Quick loans, transparent terms, and a team that truly cares about your financial well-being.</p>
          <Button asChild size="lg" className="mt-8 rounded-full px-10 font-semibold" style={{ background: "hsl(var(--gold-500))", color: "#000" }}>
            <Link to="/apply/ref/REF-MIUHLOTL">Apply Now <ArrowRight className="ml-2 h-5 w-5" /></Link>
          </Button>
        </div>
      </section>
    </>
  );
}
