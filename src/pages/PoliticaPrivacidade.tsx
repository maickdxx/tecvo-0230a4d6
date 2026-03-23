import { Link } from "react-router-dom";
import { ArrowLeft, Snowflake } from "lucide-react";
import { Button } from "@/components/ui/button";

const LAST_UPDATED = "15 de março de 2026";

export default function PoliticaPrivacidade() {
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
          <span className="text-muted-foreground text-sm">/ Política de Privacidade</span>
        </div>
      </header>

      <main className="container mx-auto px-4 py-12 max-w-3xl">
        <Button variant="ghost" size="sm" asChild className="mb-6">
          <Link to="/"><ArrowLeft className="h-4 w-4 mr-1" />Voltar</Link>
        </Button>

        <h1 className="text-3xl font-bold text-foreground mb-2">Política de Privacidade</h1>
        <p className="text-sm text-muted-foreground mb-8">Última atualização: {LAST_UPDATED}</p>

        <div className="prose prose-sm max-w-none text-foreground/90 space-y-6">
          <section>
            <h2 className="text-xl font-semibold text-foreground">1. Introdução</h2>
            <p>Esta Política de Privacidade descreve como a Tecvo coleta, utiliza, armazena e protege os dados pessoais dos usuários, em conformidade com a Lei Geral de Proteção de Dados (LGPD — Lei nº 13.709/2018).</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">2. Dados coletados</h2>
            <p>Coletamos os seguintes dados para o funcionamento da plataforma:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Dados de cadastro:</strong> nome, e-mail, telefone/WhatsApp.</li>
              <li><strong>Dados da empresa:</strong> nome da empresa, CNPJ/CPF, endereço, logo.</li>
              <li><strong>Dados operacionais:</strong> clientes cadastrados, serviços realizados, agendamentos, orçamentos.</li>
              <li><strong>Dados financeiros:</strong> transações, contas a pagar e receber, formas de pagamento registradas na plataforma.</li>
              <li><strong>Dados de comunicação:</strong> mensagens enviadas e recebidas via WhatsApp integrado e outros canais.</li>
              <li><strong>Dados de equipe:</strong> informações de funcionários cadastrados, cargos e permissões.</li>
              <li><strong>Dados de ponto:</strong> registros de ponto, jornadas, escalas e banco de horas, quando o módulo estiver ativo.</li>
              <li><strong>Dados de uso:</strong> sessões, páginas acessadas, funcionalidades utilizadas (para melhoria do serviço).</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">3. Finalidade da coleta</h2>
            <p>Os dados coletados são utilizados exclusivamente para:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Fornecer e manter as funcionalidades da plataforma.</li>
              <li>Personalizar a experiência do usuário.</li>
              <li>Enviar notificações relevantes sobre o serviço.</li>
              <li>Gerar relatórios e insights para o próprio usuário.</li>
              <li>Melhorar a plataforma com base em dados de uso agregados e anonimizados.</li>
              <li>Cumprir obrigações legais e regulatórias.</li>
              <li>Prevenção de fraudes e segurança da plataforma.</li>
            </ul>
            <p className="font-semibold mt-3">A Tecvo não vende, aluga ou compartilha dados pessoais com terceiros para fins comerciais ou publicitários.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">4. Armazenamento dos dados</h2>
            <p>Os dados são armazenados em servidores seguros com infraestrutura de nível empresarial. Os dados são mantidos enquanto a conta do usuário estiver ativa. Após a exclusão da conta, os dados serão removidos em até 30 dias, exceto quando houver obrigação legal de retenção.</p>
            <p>Dados excluídos pelo usuário (lixeira) são removidos permanentemente após 30 dias.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">5. Segurança da informação</h2>
            <p>A plataforma adota medidas técnicas e organizacionais de segurança, incluindo:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Criptografia:</strong> dados em trânsito protegidos por TLS/SSL e dados sensíveis criptografados em repouso.</li>
              <li><strong>Autenticação:</strong> sistema de autenticação segura com verificação de e-mail e suporte a autenticação social (Google).</li>
              <li><strong>Controle de acesso:</strong> isolamento de dados por organização com Row Level Security (RLS), garantindo que cada empresa acesse apenas seus próprios dados.</li>
              <li><strong>Proteção contra acessos não autorizados:</strong> monitoramento contínuo, logs de auditoria e políticas de acesso baseadas em funções.</li>
              <li><strong>Backups:</strong> cópias de segurança regulares para proteção contra perda de dados.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">6. Acesso aos dados</h2>
            <p>Os dados de cada organização são acessíveis apenas por:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Membros autorizados da organização (conforme permissões configuradas pelo gestor).</li>
              <li>A equipe técnica da Tecvo, exclusivamente para suporte, manutenção e resolução de problemas técnicos.</li>
            </ul>
            <p>Nenhum dado é compartilhado entre organizações diferentes. Cada empresa possui seu ambiente completamente isolado.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">7. Responsabilidade sobre dados operacionais</h2>
            <p>Os dados cadastrados pelos usuários na plataforma (clientes, serviços, transações, conversas, registros de ponto, etc.) são de inteira responsabilidade do próprio usuário. A Tecvo atua como operadora desses dados, fornecendo apenas a ferramenta para organização e gestão.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">8. Cookies e tecnologias similares</h2>
            <p>A plataforma utiliza cookies e armazenamento local para autenticação, segurança e melhoria da experiência. Para mais detalhes, consulte nossa <Link to="/politica-de-cookies" className="text-primary hover:underline">Política de Cookies</Link>.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">9. Direitos do titular</h2>
            <p>Conforme a LGPD, você possui direitos sobre seus dados pessoais. Para mais informações e para exercer seus direitos, acesse nossa página de <Link to="/lgpd" className="text-primary hover:underline">Direitos de Dados (LGPD)</Link>.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">10. Alterações na política</h2>
            <p>Esta política pode ser atualizada periodicamente. Alterações significativas serão comunicadas aos usuários por e-mail ou notificação na plataforma. Recomendamos revisar esta página periodicamente.</p>
          </section>
        </div>

        <div className="mt-12 pt-6 border-t border-border flex flex-col sm:flex-row gap-3 items-start">
          <Button variant="outline" size="sm" asChild>
            <Link to="/termos-de-uso">Termos de Uso</Link>
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
