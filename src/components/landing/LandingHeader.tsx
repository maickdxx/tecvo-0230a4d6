import { useState, useEffect } from "react";
import { analytics } from "@/lib/analytics";
import { Link } from "react-router-dom";
import { Snowflake, Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const navLinks = [
  { label: "Funcionalidades", id: "funcionalidades" },
  { label: "Planos", id: "planos" },
  { label: "FAQ", id: "faq" },
];

export function LandingHeader() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const scrollToSection = (id: string) => {
    setMobileMenuOpen(false);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <header
      className={cn(
        "fixed top-0 left-0 right-0 z-50 transition-all duration-300",
        scrolled
          ? "bg-background/80 backdrop-blur-xl border-b border-border/50 shadow-xs"
          : "bg-transparent"
      )}
    >
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5 group">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary shadow-lg shadow-primary/25 group-hover:shadow-primary/35 transition-all duration-200">
              <Snowflake className="h-4.5 w-4.5 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold text-foreground tracking-tight">Tecvo</span>
          </Link>

          <nav className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => (
              <button
                key={link.id}
                onClick={() => {
                  analytics.track("interaction", null, null, { action: "nav_click", target: link.id });
                  scrollToSection(link.id);
                }}
                className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted/50 transition-all duration-200"
              >
                {link.label}
              </button>
            ))}
          </nav>

          <div className="hidden md:flex items-center gap-2.5">
            <Button variant="ghost" size="sm" asChild>
              <Link to="/login" onClick={() => analytics.track("interaction", null, null, { action: "login_click", location: "header" })}>Entrar</Link>
            </Button>
            <Button size="sm" asChild className="shadow-lg shadow-primary/20 px-5">
              <Link to="/cadastro" onClick={() => analytics.track("create_account_click", null, null, { location: "header" })}>Começar Grátis</Link>
            </Button>
          </div>

          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>
      </div>

      <div
        className={cn(
          "md:hidden overflow-hidden transition-all duration-300 bg-background/95 backdrop-blur-xl border-b border-border",
          mobileMenuOpen ? "max-h-80" : "max-h-0 border-b-0"
        )}
      >
        <nav className="container mx-auto px-4 py-4 flex flex-col gap-1">
          {navLinks.map((link) => (
            <button
              key={link.id}
              onClick={() => scrollToSection(link.id)}
              className="text-left py-2.5 px-3 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-lg transition-colors"
            >
              {link.label}
            </button>
          ))}
          <div className="flex flex-col gap-2 pt-3 mt-2 border-t border-border">
            <Button variant="outline" asChild className="w-full">
              <Link to="/login">Entrar</Link>
            </Button>
            <Button asChild className="w-full shadow-lg shadow-primary/20">
              <Link to="/cadastro">Começar Grátis</Link>
            </Button>
          </div>
        </nav>
      </div>
    </header>
  );
}
