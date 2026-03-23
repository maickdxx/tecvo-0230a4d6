import { Link } from "react-router-dom";
import { ArrowLeft, Snowflake, ShieldCheck, Download, Pencil, Trash2, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const LAST_UPDATED = "15 de março de 2026";

const RIGHTS = [
  {
    icon: Eye,
    title: "Acesso aos dados",
    description: "Você pode solicitar uma cópia completa de todos os dados pessoais que possuímos sobre você e sua organização.",
  },
  {
    icon: Pencil,
    title: "Correção de dados",
    description: "Você pode solicitar a correção de dados pessoais incompletos, inexatos ou desatualizados.",
  },
  {
    icon: Download,
    title: "Exportação de dados",
    description: "Você pode solicitar a exportação dos seus dados em formato estruturado para portabilidade.",
  },
  {
    icon: Trash2,
    title: "Exclusão de dados",
    description: "Você pode solicitar a exclusão dos seus dados pessoais e o encerramento da sua conta.",
  },
];

export default function LGPD() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-30">
        <div className="container mx-auto px-4 h-16 flex items-center gap-3">
          <Link to="/">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary">
              <Snowflake className="h-4 w-4 text-primary-foreground" />
            </div>
          </Link>
          <span className="font-bold text-foreground">Tecvo</span>
          <span className="text-muted-foreground text-sm">/ LGPD — Direitos de Dados</span>
        </div>
      </header>

      <main className="container mx-auto px-4 py-12 max-w-3xl">
        <Button variant="ghost" size="sm" asChild className="mb-6">
          <Link to="/"><ArrowLeft className="h-4 w-4 mr-1" />Voltar</Link>
        </Button>

        <div className="flex items-center gap-3 mb-2">
          <ShieldCheck className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold text-foreground">Direitos de Dados — LGPD</h1>
        </div>
        <p className="text-sm text-muted-foreground mb-8">Última atualização: {LAST_UPDATED}</p>

        <div className="prose prose-sm max-w-none text-foreground/90 space-y-6">
          <section>
            <h2 className="text-xl font-semibold text-foreground">Seus direitos garantidos pela LGPD</h2>
            <p>
              A Lei Geral de Proteção de Dados (Lei nº 13.709/2018) garante diversos direitos aos titulares de dados pessoais.
              Na Tecvo, respeitamos e facilitamos o exercício desses direitos.
            </p>
          </section>
        </div>

        <div className="grid sm:grid-cols-2 gap-4 my-8">
          {RIGHTS.map((right) => (
            <Card key={right.title} className="border border-border">
              <CardContent className="pt-6">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                    <right.icon className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground text-sm">{right.title}</h3>
                    <p className="text-xs text-muted-foreground mt-1">{right.description}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="prose prose-sm max-w-none text-foreground/90 space-y-6">
          <section>
            <h2 className="text-xl font-semibold text-foreground">Como exercer seus direitos</h2>
            <p>Para exercer qualquer um dos direitos acima, você pode:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Acessar <strong>Configurações → Minha Conta</strong> dentro da plataforma para editar ou exportar seus dados.</li>
              <li>Solicitar a exclusão da sua conta em <strong>Configurações → Minha Conta → Excluir Conta</strong>.</li>
              <li>Entrar em contato pelo nosso <Link to="/suporte" className="text-primary hover:underline">canal de suporte</Link> para solicitações específicas.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">Exclusão de conta</h2>
            <p>Ao solicitar a exclusão da sua conta:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Todos os seus dados pessoais serão removidos em até 30 dias.</li>
              <li>Dados da organização serão excluídos se você for o único proprietário.</li>
              <li>A exclusão é irreversível — recomendamos exportar seus dados antes.</li>
              <li>Dados que devam ser retidos por obrigação legal serão mantidos pelo prazo necessário.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">Transparência</h2>
            <p>A Tecvo se compromete com a total transparência no uso de dados:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Os dados coletados são usados exclusivamente para o funcionamento da plataforma.</li>
              <li>Não vendemos, alugamos ou compartilhamos dados pessoais com terceiros.</li>
              <li>Não utilizamos dados para fins publicitários externos.</li>
              <li>Todo o processamento de dados tem base legal conforme a LGPD.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">Encarregado de dados (DPO)</h2>
            <p>
              Para questões relacionadas à proteção de dados, entre em contato pelo nosso{" "}
              <Link to="/suporte" className="text-primary hover:underline">canal de suporte</Link>.
            </p>
          </section>
        </div>

        <div className="mt-12 pt-6 border-t border-border flex flex-col sm:flex-row gap-3">
          <Button variant="outline" size="sm" asChild>
            <Link to="/termos-de-uso">Termos de Uso</Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link to="/politica-de-privacidade">Política de Privacidade</Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link to="/politica-de-cookies">Política de Cookies</Link>
          </Button>
        </div>
      </main>
    </div>
  );
}
