import { Link } from "react-router-dom";
import { ArrowLeft, Snowflake } from "lucide-react";
import { Button } from "@/components/ui/button";

const LAST_UPDATED = "15 de março de 2026";

export default function PoliticaDeCookies() {
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
          <span className="text-muted-foreground text-sm">/ Política de Cookies</span>
        </div>
      </header>

      <main className="container mx-auto px-4 py-12 max-w-3xl">
        <Button variant="ghost" size="sm" asChild className="mb-6">
          <Link to="/"><ArrowLeft className="h-4 w-4 mr-1" />Voltar</Link>
        </Button>

        <h1 className="text-3xl font-bold text-foreground mb-2">Política de Cookies</h1>
        <p className="text-sm text-muted-foreground mb-8">Última atualização: {LAST_UPDATED}</p>

        <div className="prose prose-sm max-w-none text-foreground/90 space-y-6">
          <section>
            <h2 className="text-xl font-semibold text-foreground">1. O que são cookies?</h2>
            <p>Cookies são pequenos arquivos de texto armazenados no seu navegador quando você visita um site. Eles permitem que o site reconheça seu dispositivo e lembre informações sobre sua visita, como preferências e sessão de login.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">2. Cookies que utilizamos</h2>
            <p>A Tecvo utiliza cookies e tecnologias similares (como localStorage e sessionStorage) para as seguintes finalidades:</p>
            
            <h3 className="text-base font-semibold text-foreground mt-4">Cookies essenciais</h3>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Autenticação do usuário:</strong> manter sua sessão de login ativa enquanto você utiliza a plataforma.</li>
              <li><strong>Segurança da conta:</strong> prevenir acessos não autorizados e proteger sua sessão.</li>
              <li><strong>Funcionamento da plataforma:</strong> armazenar preferências necessárias para o correto funcionamento do sistema.</li>
            </ul>

            <h3 className="text-base font-semibold text-foreground mt-4">Cookies funcionais</h3>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Preferências do usuário:</strong> lembrar configurações como tema (claro/escuro), idioma e layout.</li>
              <li><strong>Melhoria da experiência:</strong> personalizar a interface de acordo com seu uso.</li>
            </ul>

            <h3 className="text-base font-semibold text-foreground mt-4">Cookies analíticos</h3>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Análise de uso:</strong> entender como a plataforma é utilizada para identificar melhorias.</li>
              <li><strong>Métricas de desempenho:</strong> monitorar o desempenho da plataforma e corrigir problemas.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">3. Cookies de terceiros</h2>
            <p>A Tecvo <strong>não utiliza</strong> cookies de rastreamento de terceiros para fins publicitários. Cookies de terceiros podem ser utilizados exclusivamente por serviços integrados necessários ao funcionamento da plataforma (como processadores de pagamento e serviços de autenticação).</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">4. Duração dos cookies</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Cookies de sessão:</strong> são temporários e removidos quando você fecha o navegador.</li>
              <li><strong>Cookies persistentes:</strong> permanecem armazenados por um período definido (geralmente até 30 dias) ou até serem removidos manualmente.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">5. Gerenciamento de cookies</h2>
            <p>Você pode gerenciar ou bloquear cookies através das configurações do seu navegador. No entanto, desabilitar cookies essenciais pode impedir o funcionamento correto da plataforma, incluindo:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Impossibilidade de fazer login.</li>
              <li>Perda de preferências salvas.</li>
              <li>Funcionamento limitado de funcionalidades.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">6. Consentimento</h2>
            <p>Ao utilizar a plataforma Tecvo, você consente com o uso dos cookies descritos nesta política. Você pode retirar seu consentimento a qualquer momento ajustando as configurações do seu navegador.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">7. Alterações na política</h2>
            <p>Esta Política de Cookies pode ser atualizada periodicamente. Alterações significativas serão comunicadas aos usuários.</p>
          </section>
        </div>

        <div className="mt-12 pt-6 border-t border-border flex flex-col sm:flex-row gap-3 items-start">
          <Button variant="outline" size="sm" asChild>
            <Link to="/termos-de-uso">Termos de Uso</Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link to="/politica-de-privacidade">Política de Privacidade</Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link to="/lgpd">Direitos de Dados (LGPD)</Link>
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
