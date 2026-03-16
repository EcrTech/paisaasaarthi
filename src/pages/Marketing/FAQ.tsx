import { Link } from "react-router-dom";
import { PageHeroBanner } from "@/components/Marketing/PageHeroBanner";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Phone } from "lucide-react";

const faqCategories = [
  {
    number: "1",
    title: "General",
    items: [
      { q: "What is Paisaa Saarthi?", a: "Paisaa Saarthi is a digital lending platform that provides quick personal loans from ₹5,000 to ₹1,00,000 to salaried individuals. We partner with RBI-registered NBFCs to provide safe and transparent loan services." },
      { q: "Who can apply for a loan at Paisaa Saarthi?", a: "Any Indian citizen aged 21-55 years who is a salaried employee with minimum 6 months of work experience and a monthly income of at least ₹15,000 can apply." },
      { q: "Is Paisaa Saarthi a registered company?", a: "Yes, Paisaa Saarthi Fintech Pvt Ltd is a registered company. We operate as a digital lending platform in partnership with RBI-regulated NBFCs." },
    ],
  },
  {
    number: "2",
    title: "Loan Process",
    items: [
      { q: "How long does the loan approval take?", a: "Most loan applications are reviewed and approved within minutes. The entire process from application to disbursal typically takes less than 4 hours." },
      { q: "What documents are required?", a: "You need your Aadhaar card and PAN card. The process is mostly digital with minimal paperwork required." },
      { q: "How will I receive the loan amount?", a: "The approved loan amount is transferred directly to your registered bank account within 24 hours of approval." },
      { q: "Can I track my application status?", a: "Yes, you can track your application status through our platform or by contacting our support team." },
    ],
  },
  {
    number: "3",
    title: "Repayment",
    items: [
      { q: "What are the repayment options?", a: "Repayment is done as per the agreed schedule. You can choose tenure from 7 to 90 days based on your convenience." },
      { q: "What happens if I miss an EMI payment?", a: "Late payment charges may apply as per the loan agreement. We recommend contacting our support team immediately if you're facing difficulty in repayment." },
      { q: "Can I prepay or foreclose my loan?", a: "Yes! We have a 0% prepayment penalty. You can repay your loan early without any additional charges." },
      { q: "How is the EMI calculated?", a: "Interest is charged at 1% per day on the loan amount. A processing fee of 10% is deducted upfront. The total repayment amount is clearly shown before you confirm." },
    ],
  },
  {
    number: "4",
    title: "Fees & Charges",
    items: [
      { q: "What is the interest rate?", a: "Our interest rate is 1% per day flat rate on the loan amount. Actual rates may vary based on your eligibility and profile." },
      { q: "Are there any processing fees?", a: "Yes, a processing fee of 10% of the loan amount is charged. This is deducted from the loan amount at the time of disbursement." },
      { q: "Are there any hidden charges?", a: "Absolutely not. We believe in complete transparency. All charges are clearly communicated before you accept the loan offer." },
    ],
  },
];

export default function FAQ() {
  return (
    <>
      <PageHeroBanner title="Frequently Asked" highlightedWord="Questions" subtitle="Everything you need to know about our loan services" />

      <section className="py-16 md:py-24">
        <div className="max-w-3xl mx-auto px-4">
          {faqCategories.map((cat) => (
            <div key={cat.number} className="mb-10">
              <div className="flex items-center gap-3 mb-4">
                <span className="h-8 w-8 rounded-full flex items-center justify-center text-sm font-bold text-white" style={{ background: "hsl(var(--teal-500))" }}>
                  {cat.number}
                </span>
                <h2 className="font-heading text-xl font-bold text-foreground">{cat.title}</h2>
              </div>
              <Accordion type="single" collapsible className="space-y-2">
                {cat.items.map((faq, i) => (
                  <AccordionItem key={i} value={`${cat.number}-${i}`} className="border border-border rounded-lg px-4 bg-background">
                    <AccordionTrigger className="font-medium text-foreground text-left text-sm">{faq.q}</AccordionTrigger>
                    <AccordionContent className="text-muted-foreground text-sm">{faq.a}</AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </div>
          ))}

          {/* Still have questions */}
          <div className="mt-10 text-center p-8 rounded-2xl" style={{ background: "hsl(var(--teal-100))" }}>
            <h3 className="font-heading text-xl font-bold text-foreground">Still Have Questions?</h3>
            <p className="mt-2 text-muted-foreground text-sm">Our friendly support team is here to help. Reach out to us and we'll get back to you as soon as possible.</p>
            <div className="mt-4 flex flex-col sm:flex-row gap-3 justify-center">
              <Button asChild variant="default" className="rounded-full" style={{ background: "hsl(var(--teal-500))" }}>
                <Link to="/contact">Contact Us</Link>
              </Button>
              <Button asChild variant="outline" className="rounded-full">
                <a href="tel:+919654485776"><Phone className="mr-2 h-4 w-4" />Call: +91 96544 85776</a>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
