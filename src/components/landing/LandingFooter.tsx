import { Link } from "react-router-dom";
import { Snowflake } from "lucide-react";

export function LandingFooter() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="py-12 bg-gradient-to-b from-card to-muted/30 border-t border-border">
      <div className="container mx-auto px-4">
        <div className="grid md:grid-cols-4 gap-8 mb-10">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="h-9 w-9 rounded-xl bg-primary flex items-center justify-center shadow-md shadow-primary/20">
                <Snowflake className="h-4.5 w-4.5 text-primary-foreground" />
              </div>
              <span className="text-lg font-bold text-foreground">Tecvo</span>
            </div>
            <p className="text-sm text-muted-foreground max-w-xs leading-relaxed">
              O sistema completo para empresas de climatização crescerem com organização e inteligência artificial.
            </p>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-foreground mb-3">Acesso Rápido</h4>
            <nav className="flex flex-col gap-2">
              <Link to="/cadastro" className="text-sm text-muted-foreground hover:text-primary transition-colors">Criar conta</Link>
              <Link to="/login" className="text-sm text-muted-foreground hover:text-primary transition-colors">Entrar</Link>
              <Link to="/instalar" className="text-sm text-muted-foreground hover:text-primary transition-colors">Instalar App</Link>
            </nav>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-foreground mb-3">Recursos</h4>
            <nav className="flex flex-col gap-2">
              <Link to="/tutorial" className="text-sm text-muted-foreground hover:text-primary transition-colors">Tutorial</Link>
              <Link to="/atualizacoes" className="text-sm text-muted-foreground hover:text-primary transition-colors">Novidades</Link>
              <Link to="/suporte" className="text-sm text-muted-foreground hover:text-primary transition-colors">Suporte</Link>
            </nav>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-foreground mb-3">Legal</h4>
            <nav className="flex flex-col gap-2">
              <Link to="/termos-de-uso" className="text-sm text-muted-foreground hover:text-primary transition-colors">Termos de Uso</Link>
              <Link to="/politica-de-privacidade" className="text-sm text-muted-foreground hover:text-primary transition-colors">Privacidade</Link>
              <Link to="/lgpd" className="text-sm text-muted-foreground hover:text-primary transition-colors">LGPD</Link>
            </nav>
          </div>
        </div>

        <div className="border-t pt-6 flex flex-col md:flex-row items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">© {currentYear} Tecvo. Todos os direitos reservados.</p>
          <p className="text-xs text-muted-foreground">Feito com ❄️ para climatização brasileira.</p>
        </div>
      </div>
    </footer>
  );
}
