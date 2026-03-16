import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowRight, LinkIcon, Phone } from "lucide-react";

export default function Apply() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center py-16">
      <div className="max-w-3xl mx-auto px-4 text-center">
        <h1 className="font-heading text-4xl font-extrabold text-foreground">
          Apply for a <span style={{ color: "hsl(var(--gold-500))" }}>Loan</span>
        </h1>
        <p className="mt-4 text-lg text-muted-foreground">Choose how you'd like to get started.</p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-10">
          <Card className="border-border card-hover-lift">
            <CardContent className="pt-6 text-center">
              <div className="mx-auto h-14 w-14 rounded-full flex items-center justify-center mb-4" style={{ background: "hsl(var(--teal-100))" }}>
                <LinkIcon className="h-7 w-7" style={{ color: "hsl(var(--teal-500))" }} />
              </div>
              <h3 className="font-heading font-bold text-lg text-foreground">Via Referral Link</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                If you have a referral link from one of our agents, use it to start your application directly.
              </p>
            </CardContent>
          </Card>

          <Card className="border-border card-hover-lift">
            <CardContent className="pt-6 text-center">
              <div className="mx-auto h-14 w-14 rounded-full flex items-center justify-center mb-4" style={{ background: "hsl(var(--teal-100))" }}>
                <Phone className="h-7 w-7" style={{ color: "hsl(var(--teal-500))" }} />
              </div>
              <h3 className="font-heading font-bold text-lg text-foreground">Contact Us</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Don't have a referral link? Contact us and our team will assist you with the application.
              </p>
              <div className="mt-4 flex flex-col gap-2">
                <Button asChild variant="default" size="sm" className="rounded-full" style={{ background: "hsl(var(--teal-500))" }}>
                  <Link to="/contact">Get in Touch <ArrowRight className="ml-2 h-4 w-4" /></Link>
                </Button>
                <Button asChild variant="outline" size="sm" className="rounded-full">
                  <a href="tel:+919654485776"><Phone className="mr-2 h-4 w-4" />+91 96544 85776</a>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
