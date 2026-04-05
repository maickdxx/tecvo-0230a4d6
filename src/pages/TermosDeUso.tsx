import { Link } from "react-router-dom";
import { ArrowLeft, Snowflake } from "lucide-react";
import { Button } from "@/components/ui/button";

const LAST_UPDATED = "15 de março de 2026";

export default function TermosDeUso() {
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
          <span className="text-muted-foreground text-sm">/ Termos de Uso</span>
        </div>
      </header>

      <main className="container mx-auto px-4 py-12 max-w-3xl">
        <Button variant="ghost" size="sm" asChild className="mb-6">
          <Link to="/"><ArrowLeft className="h-4 w-4 mr-1" />Voltar</Link>
        </Button>

        <h1 className="text-3xl font-bold text-foreground mb-2">Termos de Uso</h1>
        <p className="text-sm text-muted-foreground mb-8">Última atualização: {LAST_UPDATED}</p>

        <div className="prose prose-sm max-w-none text-foreground/90 space-y-6">
          <section>
            <h2 className="text-xl font-semibold text-foreground">1. Sobre a plataforma</h2>
            <p>
              A Tecvo é um software de gestão empresarial que auxilia empresas na organização de clientes, serviços, agenda, financeiro, conversas com clientes, automações e controle de equipe. A plataforma é destinada a técnicos e empresas do setor de climatização e serviços técnicos.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">2. Aceitação dos termos</h2>
            <p>Ao criar uma conta e utilizar a plataforma, você concorda integralmente com estes Termos de Uso e com a nossa Política de Privacidade. Caso não concorde, não utilize a plataforma.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">3. Responsabilidades do usuário</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>Manter suas credenciais de acesso em sigilo.</li>
              <li>Fornecer informações verdadeiras e atualizadas.</li>
              <li>Utilizar a plataforma de forma ética e em conformidade com a legislação vigente.</li>
              <li>Não utilizar a plataforma para atividades ilegais, fraudulentas ou que violem direitos de terceiros.</li>
              <li>Responsabilizar-se integralmente pelos dados inseridos na plataforma, incluindo dados de clientes, financeiros e operacionais.</li>
              <li>Responsabilizar-se pelo conteúdo das mensagens enviadas via WhatsApp ou outros canais de comunicação integrados.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">4. Limites de responsabilidade</h2>
            <p>A Tecvo é apenas uma ferramenta de gestão empresarial. A plataforma <strong>não participa</strong> da relação comercial entre o usuário e seus clientes finais. A Tecvo não se responsabiliza por:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Contratos firmados entre empresas usuárias e seus clientes.</li>
              <li>Cobranças realizadas pelos usuários a seus clientes.</li>
              <li>Qualidade dos serviços prestados pelos usuários.</li>
              <li>Mensagens enviadas via WhatsApp ou outros canais de comunicação integrados à plataforma.</li>
              <li>Informações cadastradas pelos usuários na plataforma.</li>
              <li>Prejuízos decorrentes de informações incorretas inseridas pelo usuário.</li>
              <li>Indisponibilidades temporárias causadas por manutenção ou fatores externos.</li>
              <li>Perdas de dados causadas por ação do próprio usuário.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">5. Dados operacionais</h2>
            <p>Os dados cadastrados pelos usuários (clientes, serviços, transações financeiras, conversas, registros de ponto, etc.) são de inteira responsabilidade do próprio usuário. A plataforma apenas fornece a ferramenta para organização e gestão dessas informações.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">6. Uso indevido</h2>
            <p>É proibido utilizar a plataforma para:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Envio de spam ou mensagens não solicitadas em massa.</li>
              <li>Tentativas de acessar dados de outros usuários ou organizações.</li>
              <li>Engenharia reversa, cópia ou redistribuição do software.</li>
              <li>Qualquer atividade que comprometa a segurança ou estabilidade do sistema.</li>
              <li>Armazenar ou transmitir conteúdo ilegal, difamatório ou que viole direitos de terceiros.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">7. Assinatura e pagamento</h2>
            <p>A plataforma oferece planos de assinatura com diferentes funcionalidades e limites. Ao assinar um plano:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>A cobrança é realizada mensalmente de forma recorrente.</li>
              <li>O primeiro mês possui valor promocional de R$1, com renovação automática ao valor integral no segundo mês.</li>
              <li>O usuário pode fazer upgrade ou downgrade de plano a qualquer momento.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">8. Cancelamento</h2>
            <p>O usuário pode cancelar sua assinatura a qualquer momento. Após o cancelamento:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>O acesso às funcionalidades do plano permanece ativo até o fim do período já pago.</li>
              <li>Após o término do período pago, a conta retorna ao plano gratuito com funcionalidades limitadas.</li>
              <li>Os dados do usuário são mantidos conforme nossa Política de Privacidade.</li>
              <li>O usuário pode solicitar a exclusão completa da conta e dos dados a qualquer momento.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">9. Suspensão de conta</h2>
            <p>A Tecvo reserva-se o direito de suspender ou cancelar contas que violem estes termos, sem aviso prévio. Situações que podem levar à suspensão incluem:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Violação de qualquer item destes Termos de Uso.</li>
              <li>Uso da plataforma para atividades ilegais.</li>
              <li>Tentativas de comprometer a segurança do sistema.</li>
              <li>Inadimplência prolongada em planos pagos.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">10. Propriedade intelectual</h2>
            <p>Todo o conteúdo da plataforma, incluindo marca, design, código, funcionalidades e documentação, é de propriedade exclusiva da Tecvo e protegido pela legislação de direitos autorais e propriedade intelectual. Os dados inseridos pelos usuários permanecem de propriedade dos respectivos usuários.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">11. Alterações nos termos</h2>
            <p>A Tecvo pode atualizar estes termos periodicamente. Alterações significativas serão comunicadas aos usuários por e-mail ou notificação na plataforma. O uso continuado da plataforma após alterações constitui aceitação dos novos termos.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">12. Foro</h2>
            <p>Fica eleito o foro da comarca da sede da Tecvo para dirimir quaisquer questões oriundas destes Termos de Uso, com renúncia a qualquer outro, por mais privilegiado que seja.</p>
          </section>
        </div>

        <div className="mt-12 pt-6 border-t border-border flex flex-col sm:flex-row gap-3 items-start">
          <Button variant="outline" size="sm" asChild>
            <Link to="/politica-de-privacidade">Política de Privacidade</Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link to="/lgpd">Direitos de Dados (LGPD)</Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link to="/politica-de-cookies">Política de Cookies</Link>
          </Button>
        </div>

        <div className="mt-6">
          <p className="text-xs text-muted-foreground">
            Dúvidas? Entre em contato pelo nosso <Link to="/suporte" className="text-primary hover:underline">canal de suporte</Link>.
          </p>
        </div>
      </main>
    </div>
  );
}
