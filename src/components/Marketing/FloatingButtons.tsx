import { MessageCircle, Phone } from "lucide-react";

const WHATSAPP_NUMBER = "919654485776";
const WHATSAPP_TEXT = "Hi, I'm interested in a loan from Paisaa Saarthi";
const CALL_NUMBER = "+919654485776";

export function FloatingButtons() {
  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-3">
      <a
        href={`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(WHATSAPP_TEXT)}`}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center justify-center h-14 w-14 rounded-full shadow-lg hover:scale-110 transition-transform"
        style={{ background: "#25D366" }}
        aria-label="Contact us on WhatsApp"
      >
        <MessageCircle className="h-6 w-6 text-white" />
      </a>
      <a
        href={`tel:${CALL_NUMBER}`}
        className="flex items-center justify-center h-14 w-14 rounded-full shadow-lg hover:scale-110 transition-transform"
        style={{ background: "hsl(var(--teal-500))" }}
        aria-label="Call us"
      >
        <Phone className="h-6 w-6 text-white" />
      </a>
    </div>
  );
}
