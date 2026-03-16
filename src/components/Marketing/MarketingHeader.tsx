import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Menu, X, Phone, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import logo from "@/assets/paisaa-saarthi-logo.jpeg";

const navLinks = [
  { label: "Home", to: "/" },
  { label: "About Us", to: "/about" },
  { label: "Services", to: "/services" },
  { label: "How to Apply", to: "/how-to-apply" },
  { label: "FAQ", to: "/faq" },
  { label: "Contact", to: "/contact" },
];

const PHONE_NUMBER = "+91 96544 85776";
const REFERRAL_LINK = "/apply";

export function MarketingHeader() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  return (
    <header className="sticky top-0 z-50 bg-background border-b border-border shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo + Tagline */}
          <Link to="/home" className="flex items-center gap-3">
            <img src={logo} alt="Paisaa Saarthi" className="h-11 w-11 rounded-xl object-cover" />
            <div>
              <span className="font-heading font-bold text-lg text-foreground leading-none block">Paisaa Saarthi</span>
              <span className="text-xs font-medium" style={{ color: "hsl(var(--gold-500))" }}>Chhote loans, badi udaan</span>
            </div>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden lg:flex items-center gap-1">
            {navLinks.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  location.pathname === link.to
                    ? "text-foreground border-b-2 border-primary"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          {/* Right side: Login + Phone + Quick Apply */}
          <div className="hidden lg:flex items-center gap-4">
            <Link to="/login" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              Login
            </Link>
            <a href={`tel:${PHONE_NUMBER.replace(/\s/g, "")}`} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
              <div className="h-8 w-8 rounded-full border border-border flex items-center justify-center">
                <Phone className="h-4 w-4 text-primary" />
              </div>
              <span className="font-medium">{PHONE_NUMBER}</span>
            </a>
            <Button asChild size="sm" className="rounded-full px-5 font-semibold" style={{ background: "hsl(var(--teal-500))" }}>
              <Link to={REFERRAL_LINK}>Quick Apply <ArrowRight className="ml-1.5 h-4 w-4" /></Link>
            </Button>
          </div>

          {/* Mobile toggle */}
          <button
            className="lg:hidden p-2 text-foreground"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="lg:hidden border-t border-border bg-background">
          <div className="px-4 py-3 space-y-1">
            {navLinks.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                onClick={() => setMobileOpen(false)}
                className={`block px-3 py-2 rounded-md text-sm font-medium ${
                  location.pathname === link.to
                    ? "text-primary bg-primary/10"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                }`}
              >
                {link.label}
              </Link>
            ))}
            <Link
              to="/login"
              onClick={() => setMobileOpen(false)}
              className="block px-3 py-2 rounded-md text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted"
            >
              Login
            </Link>
            <a href={`tel:${PHONE_NUMBER.replace(/\s/g, "")}`} className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground">
              <Phone className="h-4 w-4 text-primary" />
              <span>{PHONE_NUMBER}</span>
            </a>
            <div className="pt-2">
              <Button asChild size="sm" className="w-full rounded-full font-semibold" style={{ background: "hsl(var(--teal-500))" }}>
                <Link to={REFERRAL_LINK} onClick={() => setMobileOpen(false)}>Quick Apply <ArrowRight className="ml-1.5 h-4 w-4" /></Link>
              </Button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
