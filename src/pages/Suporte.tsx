import { HelpCircle } from "lucide-react";
import { AppLayout } from "@/components/layout";
import { ContactForm, WhatsAppButton, LiveChat } from "@/components/support";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const faqItems = [
  {
    question: "Como criar um orçamento?",
    answer:
      "Acesse o menu 'Orçamentos' e clique em 'Novo Orçamento'. Selecione o cliente, adicione os serviços e itens desejados, defina as condições de pagamento e clique em 'Salvar'. Você pode gerar um PDF para enviar ao cliente.",
  },
  {
    question: "Como adicionar funcionários à minha equipe?",
    answer:
      "Vá em 'Configurações' > 'Equipe' e clique em 'Convidar Membro'. Digite o email do funcionário e selecione o tipo de acesso (Administrador, Membro ou Funcionário). O convidado receberá um email para criar sua conta.",
  },
  {
    question: "Como exportar relatórios financeiros?",
    answer:
      "Acesse o menu 'Financeiro' e clique no botão 'Exportar PDF'. O relatório incluirá todas as transações do período selecionado, com gráficos de receitas e despesas.",
  },
  {
    question: "Como converter um orçamento em ordem de serviço?",
    answer:
      "Abra o orçamento aprovado pelo cliente, clique no menu de ações (três pontos) e selecione 'Converter para OS'. Todos os dados serão copiados automaticamente para a nova ordem de serviço.",
  },
  {
    question: "Como agendar um serviço na agenda?",
    answer:
      "Acesse o menu 'Agenda' e clique no dia desejado ou no botão '+'. Preencha os dados do serviço, selecione o cliente e o funcionário responsável. O serviço aparecerá na agenda de todos os envolvidos.",
  },
  {
    question: "Como funciona o plano gratuito?",
    answer:
      "O plano gratuito permite criar até 10 serviços por mês, com acesso a todas as funcionalidades básicas. Para uso ilimitado, considere fazer upgrade para o plano Essential ou Pro.",
  },
];

export default function Suporte() {
  return (
    <AppLayout>
      <div className="container mx-auto px-4 py-8 max-w-5xl">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center h-16 w-16 rounded-full bg-primary/10 mb-4">
            <HelpCircle className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-3xl font-bold text-foreground mb-2">
            Precisa de ajuda?
          </h1>
          <p className="text-muted-foreground text-lg">
            Estamos aqui para você! Escolha o canal de atendimento que preferir.
          </p>
        </div>

        {/* Support Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          <ContactForm />
          <WhatsAppButton />
          <LiveChat />
        </div>

        {/* FAQ Section */}
        <div className="bg-card rounded-lg border border-border p-6">
          <h2 className="text-xl font-semibold text-foreground mb-6">
            Perguntas Frequentes
          </h2>
          <Accordion type="single" collapsible className="w-full">
            {faqItems.map((item, index) => (
              <AccordionItem key={index} value={`item-${index}`}>
                <AccordionTrigger className="text-left">
                  {item.question}
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground">
                  {item.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </div>
    </AppLayout>
  );
}
