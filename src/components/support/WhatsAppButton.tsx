import { MessageCircle } from "lucide-react";
import { SupportCard } from "./SupportCard";

interface WhatsAppButtonProps {
  phoneNumber?: string;
  message?: string;
}

export function WhatsAppButton({
  phoneNumber = "5519996933014",
  message = "Olá! Preciso de ajuda com a plataforma Tecvo.",
}: WhatsAppButtonProps) {
  const handleClick = () => {
    const encodedMessage = encodeURIComponent(message);
    const whatsappUrl = `https://wa.me/${phoneNumber}?text=${encodedMessage}`;
    window.open(whatsappUrl, "_blank");
  };

  return (
    <SupportCard
      icon={MessageCircle}
      title="WhatsApp"
      description="Resposta imediata via WhatsApp. Atendimento em horário comercial."
      buttonText="Abrir WhatsApp"
      onClick={handleClick}
      variant="whatsapp"
    />
  );
}
