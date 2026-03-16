import { PageHeroBanner } from "@/components/Marketing/PageHeroBanner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Phone, Mail, MapPin, Clock, MessageCircle, Send } from "lucide-react";

const contactInfo = [
  { icon: Phone, title: "Phone", details: ["+91 96544 85776"] },
  { icon: Mail, title: "Email", details: ["info@paisaasaarthi.com", "support@paisaasaarthi.com"] },
  { icon: MapPin, title: "Address", details: ["Paisaa Saarthi, Office no. 110 1st floor", "H-161, BSI Business Park Sec-63, Noida, UP-201301"] },
  { icon: Clock, title: "Working Hours", details: ["Monday - Saturday", "9:00 AM - 6:00 PM"] },
];

export default function Contact() {
  return (
    <>
      <PageHeroBanner title="Contact" highlightedWord="Us" subtitle="We're here to help with any questions you may have" />

      <section className="py-16 md:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
            {/* Contact Form */}
            <Card className="border-border">
              <CardHeader>
                <CardTitle className="font-heading text-2xl">Send us a Message</CardTitle>
              </CardHeader>
              <CardContent>
                <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="name">Full Name <span className="text-destructive">*</span></Label>
                      <Input id="name" placeholder="Your name" />
                    </div>
                    <div>
                      <Label htmlFor="phone">Phone Number <span className="text-destructive">*</span></Label>
                      <Input id="phone" placeholder="Your phone number" />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="email">Email Address</Label>
                    <Input id="email" type="email" placeholder="your.email@example.com" />
                  </div>
                  <div>
                    <Label htmlFor="subject">Subject</Label>
                    <Input id="subject" placeholder="How can we help?" />
                  </div>
                  <div>
                    <Label htmlFor="message">Message</Label>
                    <Textarea id="message" placeholder="Tell us more about your query..." rows={5} />
                  </div>
                  <Button type="submit" className="w-full rounded-full font-semibold" style={{ background: "hsl(var(--gold-500))", color: "#000" }}>
                    Send Message <Send className="ml-2 h-4 w-4" />
                  </Button>
                </form>
              </CardContent>
            </Card>

            {/* Contact Info */}
            <div>
              <h2 className="font-heading text-2xl font-bold text-foreground mb-2">Get in Touch</h2>
              <p className="text-muted-foreground mb-6">Have questions about our loan services? Want to know more about eligibility? Or just need some guidance? We're here to help you every step of the way.</p>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {contactInfo.map((c) => (
                  <Card key={c.title} className="border-border">
                    <CardContent className="py-4">
                      <div className="h-10 w-10 rounded-full flex items-center justify-center mb-3" style={{ background: "hsl(var(--teal-100))" }}>
                        <c.icon className="h-5 w-5" style={{ color: "hsl(var(--teal-500))" }} />
                      </div>
                      <h3 className="font-heading font-bold text-foreground text-sm">{c.title}</h3>
                      {c.details.map((d, i) => (
                        <p key={i} className="text-sm text-muted-foreground">{d}</p>
                      ))}
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* WhatsApp CTA */}
              <Card className="mt-4 border-border" style={{ background: "hsl(var(--teal-100))" }}>
                <CardContent className="py-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full flex items-center justify-center" style={{ background: "#25D366" }}>
                      <MessageCircle className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <h3 className="font-heading font-bold text-foreground text-sm">Chat on WhatsApp</h3>
                      <p className="text-xs text-muted-foreground">Get instant responses to your queries</p>
                    </div>
                  </div>
                  <Button asChild size="sm" className="rounded-full" style={{ background: "#25D366" }}>
                    <a href="https://wa.me/919654485776?text=Hi,%20I%20have%20a%20query%20about%20your%20loan%20services" target="_blank" rel="noopener noreferrer">Chat Now</a>
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
