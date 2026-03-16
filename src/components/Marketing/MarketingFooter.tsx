import { Link } from "react-router-dom";
import logo from "@/assets/paisaa-saarthi-logo.jpeg";

const quickLinks = [
  { label: "Home", to: "/" },
  { label: "About Us", to: "/about" },
  { label: "Our Services", to: "/services" },
  { label: "How to Apply", to: "/how-to-apply" },
  { label: "FAQ", to: "/faq" },
  { label: "Apply Now", to: "/apply/ref/REF-MIUHLOTL" },
];

const loanInfoItems = [
  "Loan Amount: ₹10,000 - ₹1,00,000",
  "Tenure: 1 to 90 days",
  "Processing Fee: 10%",
  "Quick Disbursement",
  "Minimal Documentation",
  "No Collateral Required",
  "Flexible Repayment",
];

const loanTypes = [
  "Personal Loan",
  "Short Term Personal Loan",
  "Instant Personal Loan",
  "Quick Personal Loan",
  "Emergency Loan",
  "Quick Loans For Medical Emergency",
];

export function MarketingFooter() {
  return (
    <footer className="text-white" style={{ background: "hsl(220, 13%, 12%)" }}>
      {/* Main footer grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="md:col-span-1">
            <div className="flex items-center gap-2 mb-4">
              <img src={logo} alt="Paisaa Saarthi" className="h-10 w-10 rounded-lg object-cover" />
              <div>
                <span className="font-heading font-bold text-lg block">Paisaa Saarthi</span>
                <span className="text-xs" style={{ color: "hsl(var(--gold-500))" }}>Chhote loans, badi udaan</span>
              </div>
            </div>
            <p className="text-sm text-white/60 leading-relaxed">
              Your trusted partner for small-ticket personal loans. Quick, easy, and hassle-free loans up to ₹1,00,000 for salaried individuals.
            </p>
            <div className="flex gap-3 mt-4">
              <a href="#" className="w-8 h-8 rounded-full border border-white/20 flex items-center justify-center text-white/60 hover:text-white hover:border-white/40 transition-colors text-xs">f</a>
              <a href="#" className="w-8 h-8 rounded-full border border-white/20 flex items-center justify-center text-white/60 hover:text-white hover:border-white/40 transition-colors text-xs">𝕏</a>
              <a href="#" className="w-8 h-8 rounded-full border border-white/20 flex items-center justify-center text-white/60 hover:text-white hover:border-white/40 transition-colors text-xs">📷</a>
              <a href="#" className="w-8 h-8 rounded-full border border-white/20 flex items-center justify-center text-white/60 hover:text-white hover:border-white/40 transition-colors text-xs">in</a>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="font-heading font-semibold text-base mb-4">Quick Links</h3>
            <ul className="space-y-2">
              {quickLinks.map((link) => (
                <li key={link.to}>
                  <Link to={link.to} className="text-sm text-white/60 hover:text-white transition-colors">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Loan Info */}
          <div>
            <h3 className="font-heading font-semibold text-base mb-4">Loan Info</h3>
            <ul className="space-y-2">
              {loanInfoItems.map((item) => (
                <li key={item} className="text-sm text-white/60 flex items-start gap-2">
                  <span className="mt-1.5 w-2 h-2 rounded-full flex-shrink-0" style={{ background: "hsl(var(--gold-500))" }} />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h3 className="font-heading font-semibold text-base mb-4">Contact Us</h3>
            <div className="space-y-3 text-sm text-white/60">
              <p className="flex items-start gap-2">📍 Paisaa Saarthi, Office no. 110, 1st floor, H-161, BSI Business Park Sec-63, Noida, UP-201301</p>
              <p>📞 <a href="tel:+919654485776" className="hover:text-white transition-colors">+91 96544 85776</a></p>
              <p>📧 <a href="mailto:info@paisaasaarthi.com" className="hover:text-white transition-colors">info@paisaasaarthi.com</a></p>
            </div>
          </div>
        </div>
      </div>

      {/* Fraud Warning */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-10">
        <div className="rounded-xl border border-yellow-600/40 p-6" style={{ background: "hsl(220, 13%, 15%)" }}>
          <p className="text-center font-bold text-yellow-400 mb-4">⚠️ NEVER PAY IN CASH OR INTO ANYONE'S PERSONAL ACCOUNT ⚠️</p>
          <div className="space-y-2 text-sm text-white/70">
            <p>• We never ask to deposit any cash/funds in any personal bank account. If anyone claims to be Paisaa Saarthi's representative and asks you to deposit funds in their bank account, please be aware that they are not associated with Paisaa Saarthi.</p>
            <p>• We will not be held liable for any loss arising out of any such deposits made in any personal bank account.</p>
            <p>• We never entertain any demand to pay any commission to process a loan. If you come across any such demand, please report it to us immediately.</p>
          </div>
          <p className="mt-4 text-sm text-white/70">
            📞 Report suspicious activity: <a href="tel:+919654485776" className="font-semibold" style={{ color: "hsl(var(--gold-500))" }}>+91 96544 85776</a> | 📧 Email: <a href="mailto:info@paisaasaarthi.com" className="font-semibold" style={{ color: "hsl(var(--gold-500))" }}>info@paisaasaarthi.com</a>
          </p>
        </div>
      </div>

      {/* NBFC & Grievance */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 text-center">
        <p className="font-bold text-lg">A unit of Skyrise Credit and Marketing Limited</p>
        <p className="text-sm mt-1" style={{ color: "hsl(var(--gold-500))" }}>RBI Licence No: B-14.02284</p>
        <p className="font-bold text-base mt-3">Paisaa Saarthi</p>
        <p className="font-bold mt-1" style={{ color: "hsl(var(--gold-500))" }}>GRIEVANCE REDRESSAL CELL</p>
        <p className="text-sm text-white/70 mt-3 max-w-3xl mx-auto">We at Paisaa Saarthi follow all the directives of RBI for grievance redressal.</p>
        <p className="text-sm text-white/70 mt-2 max-w-3xl mx-auto">We practice responsible lending within the regulatory framework in the best interests of our customers. In case you are not satisfied with our services, our dedicated grievance redressal team is always there to look into the matter and address issues within 5 working days.</p>
        <p className="mt-4 text-sm text-white/70">
          📞 Call us at: <a href="tel:+919654485776" className="font-semibold" style={{ color: "hsl(var(--gold-500))" }}>+91 96544 85776</a> | 📧 Email us at: <a href="mailto:info@paisaasaarthi.com" className="font-semibold" style={{ color: "hsl(var(--gold-500))" }}>info@paisaasaarthi.com</a>
        </p>
      </div>

      {/* Loan type links */}
      <div className="border-t border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-wrap justify-center gap-x-2 text-sm text-white/50">
          {loanTypes.map((t, i) => (
            <span key={t}>
              <Link to="/services" className="hover:text-white transition-colors">{t}</Link>
              {i < loanTypes.length - 1 && <span className="mx-2">|</span>}
            </span>
          ))}
        </div>
      </div>

      {/* Important disclaimer */}
      <div style={{ background: "hsl(220, 13%, 8%)" }} className="py-4">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-xs text-white/50">
          <p><span className="font-bold" style={{ color: "hsl(var(--gold-500))" }}>Important*</span> – As a registered entity, Paisaa Saarthi adheres to all regulatory guidelines and offers loans to eligible customers through our website and CRM platform. We would like to inform our customers and the general public that we do not have any mobile app on Android or the App Store, nor do we disburse loans through any mobile application. Please be cautious of any unauthorized lending apps using our name, and notify us immediately if you encounter such fraudulent activities where our name and logo are being misused.</p>
        </div>
      </div>

      {/* Copyright */}
      <div className="border-t border-white/10 py-4 text-center text-sm text-white/40">
        © {new Date().getFullYear()} Paisaa Saarthi Fintech Pvt Ltd. All rights reserved.
      </div>
    </footer>
  );
}
