import { 
  Rocket, 
  Users, 
  FileText, 
  Calendar, 
  Wallet, 
  UsersRound,
  Settings,
  CreditCard,
  
  Briefcase,
  Trash2,
  HelpCircle,
  BarChart3,
  RefreshCw,
  ArrowRightLeft,
  Receipt,
  Shield,
  CloudSun,
} from "lucide-react";
import { TutorialModuleData } from "@/components/tutorial";

export const tutorialModules: TutorialModuleData[] = [
  {
    id: "primeiros-passos",
    title: "Primeiros Passos",
    icon: Rocket,
    description: "Como começar a usar o Tecvo",
    steps: [
      {
        title: "Criar sua conta",
        description: "Acesse a página inicial do Tecvo e clique em \"Começar Grátis\". Preencha seu e-mail e crie uma senha segura. Você receberá um código de verificação por e-mail para ativar sua conta.",
        tips: [
          "Use um e-mail que você acessa frequentemente para receber notificações importantes.",
          "Sua senha deve ter pelo menos 6 caracteres.",
          "O código de verificação expira em 10 minutos. Use o botão de reenvio se necessário."
        ]
      },
      {
        title: "Configurar sua empresa no Onboarding",
        description: "Após criar a conta, você será guiado pelo processo de onboarding. Preencha os dados da sua empresa como nome, CNPJ/CPF, telefone e endereço completo. Essas informações aparecerão nos orçamentos e ordens de serviço.",
        tips: [
          "Você pode adicionar o logo da empresa nas configurações depois.",
          "O CEP preenche automaticamente cidade, estado e bairro.",
          "O CEP preenche automaticamente cidade, estado e bairro."
        ]
      },
      {
        title: "Conhecer o Dashboard",
        description: "O Dashboard é sua tela inicial após o login. Aqui você vê a Situação Atual com previsão de caixa de 15 dias, Motor de Receita com ticket médio, Eficiência Operacional e gráficos de fluxo de caixa. Use os cards de ação rápida para acessar as funções mais usadas.",
        tips: [
          "Personalize o Dashboard clicando no botão de engrenagem para reorganizar ou ocultar seções.",
          "A previsão do tempo aparece no topo — útil para serviços externos."
        ]
      },
      {
        title: "Navegar pelo menu",
        description: "No desktop, o menu fica na lateral esquerda com grupos colapsáveis. No celular, use a barra inferior para acessar as funções principais e o menu hambúrguer para todas as opções.",
        tips: [
          "Os itens são organizados em: Operação, Comercial, Financeiro, Cadastros e Ajuda.",
          "Use \"Ver como Funcionário\" para simular a visão limitada da sua equipe."
        ]
      },
      {
        title: "Instalar como aplicativo (PWA)",
        description: "O Tecvo pode ser instalado como um app no celular e desktop. Acesse o menu Ajuda > Instalar e siga as instruções. Você receberá notificações push mesmo com o navegador fechado.",
        tips: [
          "No Android/Chrome, o botão \"Instalar\" aparece automaticamente na barra de endereço.",
          "No iOS/Safari, use \"Adicionar à Tela Inicial\" no menu de compartilhamento."
        ]
      }
    ]
  },
  {
    id: "cadastros",
    title: "Cadastros",
    icon: Users,
    description: "Gerenciando clientes, fornecedores e catálogo",
    steps: [
      {
        title: "Adicionar seu primeiro cliente",
        description: "Acesse Cadastros > Clientes e clique em \"Novo Cliente\". Escolha entre Pessoa Física ou Jurídica, preencha nome, telefone (obrigatório), e-mail e endereço. O endereço é preenchido automaticamente ao digitar o CEP.",
        tips: [
          "Para PJ, informe o CNPJ e o sistema buscará os dados automaticamente.",
          "Use o campo de observações internas para anotar detalhes importantes.",
          "Você também pode cadastrar clientes rapidamente ao criar um orçamento ou OS."
        ]
      },
      {
        title: "Cadastrar fornecedores",
        description: "Em Cadastros > Fornecedores, adicione seus fornecedores de peças e materiais. Inclua dados de contato, CNPJ/CPF e categoria para facilitar a organização.",
        tips: [
          "Vincule fornecedores às despesas para ter um controle melhor dos gastos."
        ]
      },
      {
        title: "Criar catálogo de serviços com preços",
        description: "O Catálogo de Serviços (Cadastros > Serviços) permite pré-cadastrar itens de mão de obra ou produtos com nome, descrição, tipo de serviço e valor unitário. Ao criar um orçamento ou OS, basta selecionar do catálogo para preencher automaticamente.",
        tips: [
          "Defina um desconto padrão para itens que costumam ter promoção.",
          "Itens do catálogo agilizam muito a criação de documentos.",
          "Você pode importar itens de catálogo em lote."
        ]
      }
    ]
  },
  {
    id: "comercial",
    title: "Comercial",
    icon: FileText,
    description: "Orçamentos e Ordens de Serviço",
    steps: [
      {
        title: "Criar um orçamento",
        description: "Acesse Comercial > Orçamentos e clique em \"Novo Orçamento\". Selecione o cliente, adicione os itens do serviço (do catálogo ou manualmente), defina condições de pagamento e validade do orçamento.",
        tips: [
          "Use o botão + ao lado do campo cliente para cadastrar um cliente novo sem sair da página.",
          "Você pode adicionar desconto por item (% ou R$) ou no valor total."
        ]
      },
      {
        title: "Gerar PDF e enviar ao cliente",
        description: "Após salvar o orçamento, gere um PDF profissional clicando em \"Gerar PDF\". O documento inclui dados da empresa, logo, itens detalhados, condições de pagamento e assinatura digital da empresa.",
        tips: [
          "Use o botão do WhatsApp para enviar um resumo formatado diretamente para o cliente."
        ]
      },
      {
        title: "Converter orçamento em OS",
        description: "Quando o cliente aprovar, abra o orçamento e clique em \"Converter em OS\". Isso cria uma Ordem de Serviço com todos os dados já preenchidos, pronta para agendar.",
        tips: [
          "O orçamento original fica vinculado à OS para consulta futura."
        ]
      },
      {
        title: "Acompanhar status da OS",
        description: "As Ordens de Serviço passam pelos status: Agendado → Em Deslocamento → Em Atendimento → Concluído. Altere o status conforme o progresso. Ao concluir, defina a forma de pagamento e o sistema registra automaticamente a receita.",
        warning: "Ordens de Serviço concluídas ficam bloqueadas para edição para preservar o histórico."
      },
      {
        title: "Assinatura digital do cliente",
        description: "Ao concluir uma OS, você pode enviar um link de assinatura para o cliente via WhatsApp. O cliente assina digitalmente pelo celular, sem precisar de login. A assinatura fica vinculada ao PDF da OS.",
        tips: [
          "Ative a exigência de assinatura do cliente nas Configurações > Assinatura.",
          "O link de assinatura é único e seguro — não pode ser reutilizado."
        ]
      }
    ]
  },
  {
    id: "agenda",
    title: "Agenda",
    icon: Calendar,
    description: "Gerenciando agendamentos",
    steps: [
      {
        title: "Agendar um serviço",
        description: "Ao criar ou editar uma Ordem de Serviço, defina a \"Data Agendada\". O serviço aparecerá automaticamente na Agenda. Você também pode clicar em um dia no calendário para ver todos os serviços agendados.",
        tips: [
          "Atribua um técnico responsável para organizar a equipe.",
          "O sistema mostra a capacidade operacional disponível por dia."
        ]
      },
      {
        title: "Visualizar calendário mensal/semanal",
        description: "Na tela Agenda, alterne entre visualização mensal, semanal ou diária usando os botões no topo. Clique em qualquer serviço para ver os detalhes completos.",
        tips: [
          "A visualização semanal é ideal para planejar a semana de trabalho.",
          "Use os filtros para ver apenas serviços de um técnico específico."
        ]
      },
      {
        title: "Reagendar serviço",
        description: "Para reagendar, abra a OS e altere a data agendada. A agenda será atualizada automaticamente. Serviços já concluídos não podem ser reagendados.",
        tips: [
          "Notifique o cliente sobre alterações de data pelo WhatsApp."
        ]
      }
    ]
  },
  {
    id: "financeiro",
    title: "Financeiro",
    icon: Wallet,
    description: "Controle completo de receitas, despesas e contas",
    steps: [
      {
        title: "Registrar receita/despesa",
        description: "Acesse Financeiro > Transações e clique em \"Nova Transação\". Selecione o tipo (receita ou despesa), categoria, valor, data e forma de pagamento. Vincule a um cliente ou fornecedor para melhor organização.",
        tips: [
          "Receitas de serviços concluídos são criadas automaticamente.",
          "Use categorias e subcategorias para filtrar e analisar seus gastos."
        ]
      },
      {
        title: "Contas a Pagar e Receber",
        description: "Em Financeiro > Contas a Pagar, gerencie despesas com fornecedores, aluguel, etc. Em Contas a Receber, acompanhe valores pendentes de clientes. O sistema destaca contas vencidas e próximas do vencimento.",
        tips: [
          "Use o formulário completo para adicionar parcelas e observações detalhadas.",
          "Marque como pago clicando no botão de ação ao lado da conta."
        ]
      },
      {
        title: "Contas financeiras",
        description: "Configure suas contas financeiras (caixa, banco, carteira digital) em Configurações > Contas Financeiras. Cada transação é vinculada a uma conta, permitindo acompanhar o saldo real de cada uma.",
        tips: [
          "Vincule uma conta padrão a cada forma de pagamento para agilizar o registro.",
          "O saldo de cada conta é atualizado automaticamente ao confirmar pagamentos."
        ]
      },
      {
        title: "Transferências entre contas",
        description: "Em Financeiro > Transferências, mova valores entre suas contas financeiras. Selecione a conta de origem, destino e o valor. O saldo de ambas as contas é atualizado instantaneamente.",
        tips: [
          "Use transferências para registrar saques, depósitos e movimentações internas."
        ]
      },
      {
        title: "Exportar relatório PDF",
        description: "Na tela de Relatórios Financeiros, selecione o período e exporte um PDF completo com receitas, despesas, saldo e gráficos por categoria.",
        tips: [
          "Filtre por período antes de exportar para um relatório mais específico."
        ]
      }
    ]
  },
  {
    id: "recorrencia",
    title: "Recorrência",
    icon: RefreshCw,
    description: "Serviços periódicos e contratos",
    steps: [
      {
        title: "Criar um serviço recorrente",
        description: "Acesse Comercial > Recorrência para configurar serviços que se repetem automaticamente. Defina o cliente, tipo de serviço, periodicidade (mensal, trimestral, semestral, anual) e a data de início.",
        tips: [
          "Ideal para contratos de manutenção preventiva, limpeza periódica, etc.",
          "O sistema cria as OS automaticamente conforme a periodicidade configurada."
        ]
      },
      {
        title: "Gerenciar pipeline de recorrência",
        description: "O pipeline mostra todos os serviços recorrentes ativos e suas próximas execuções. Acompanhe o status de cada recorrência e veja quando será o próximo serviço agendado.",
        tips: [
          "Pause ou desative recorrências temporariamente sem perder o histórico."
        ]
      },
      {
        title: "Acompanhar execuções passadas",
        description: "Cada recorrência mantém um histórico completo das execuções anteriores. Veja datas, valores e status de todos os serviços já realizados dentro daquele contrato.",
        tips: [
          "Use o histórico para demonstrar ao cliente a regularidade do serviço."
        ]
      }
    ]
  },
  {
    id: "equipe",
    title: "Equipe",
    icon: UsersRound,
    description: "Gerenciando sua equipe",
    steps: [
      {
        title: "Convidar membro da equipe",
        description: "Acesse Configurações > Equipe e clique em \"Convidar Membro\". Digite o e-mail da pessoa e selecione o papel. Ela receberá um convite por e-mail para criar a conta e acessar o sistema.",
        tips: [
          "Você pode reenviar o convite se a pessoa não receber o e-mail."
        ]
      },
      {
        title: "Definir papel (Admin/Membro/Funcionário)",
        description: "Cada papel tem permissões diferentes:\n• Admin: Acesso total, pode gerenciar equipe e configurações\n• Membro: Acesso às funções operacionais, sem gerenciar equipe\n• Funcionário: Acesso limitado, vê apenas serviços atribuídos a ele",
        warning: "Funcionários não podem criar ou editar serviços, apenas visualizar e marcar como concluído."
      },
      {
        title: "Configurar permissões por módulo",
        description: "Para membros da equipe, você pode definir permissões granulares por módulo: financeiro, clientes, orçamentos, etc. Acesse o perfil do membro e marque quais módulos ele pode acessar.",
        tips: [
          "Administradores sempre têm acesso total — as permissões se aplicam apenas a membros."
        ]
      },
      {
        title: "Recebimentos por Técnico",
        description: "Em Financeiro > Recebimentos por Técnico, veja um relatório de todos os valores recebidos por cada técnico da equipe. Exporte em PDF para controle interno.",
        tips: [
          "Útil para calcular comissões e bonificações da equipe."
        ]
      },
      {
        title: "Remover membro",
        description: "Na lista de membros da equipe, clique no botão de remover ao lado do membro. Ele perderá acesso imediatamente. Os serviços atribuídos a ele permanecerão no sistema.",
        warning: "Esta ação não pode ser desfeita. O membro precisará ser convidado novamente."
      },
      {
        title: "Ver como funcionário",
        description: "Use o botão \"Ver como Funcionário\" no menu lateral para simular a visão de um funcionário. Isso ajuda a entender exatamente o que sua equipe pode ver e fazer no sistema.",
        tips: [
          "Clique em \"Voltar para Administrador\" para retornar à visão normal."
        ]
      }
    ]
  },
  {
    id: "meu-dia",
    title: "Meu Dia",
    icon: Briefcase,
    description: "Rotina diária de atendimentos",
    steps: [
      {
        title: "Visualizar serviços do dia",
        description: "A tela \"Meu Dia\" mostra todos os serviços agendados para hoje em formato de timeline. Cada card exibe o cliente, endereço, horário, prioridade e status atual do serviço. Serviços atrasados são destacados automaticamente.",
        tips: [
          "Use o botão de mapa para abrir a rota no Google Maps diretamente.",
          "Administradores podem filtrar por técnico para acompanhar toda a equipe."
        ]
      },
      {
        title: "Fluxo de execução do serviço",
        description: "Os cards mostram botões de ação dinâmicos conforme o status:\n• \"Iniciar Deslocamento\" → registra a hora de saída\n• \"Iniciar Atendimento\" → registra chegada ao local\n• \"Concluir\" → finaliza o serviço e registra a receita",
        tips: [
          "A tela é otimizada para uso em campo, no celular.",
          "Cada etapa registra automaticamente o horário para métricas de desempenho."
        ]
      },
      {
        title: "Ranking semanal",
        description: "Ao final da semana, o ranking mostra os técnicos mais produtivos com base em serviços concluídos, tempo médio de atendimento e avaliações. Use para motivar e reconhecer sua equipe.",
        tips: [
          "O ranking é atualizado em tempo real conforme serviços são concluídos."
        ]
      },
      {
        title: "Métricas do dia",
        description: "No topo da tela, veja indicadores como: serviços pendentes, em andamento, concluídos e tempo médio de atendimento do dia. Administradores veem métricas consolidadas de toda a equipe.",
        tips: [
          "Compare as métricas diárias para identificar padrões de produtividade."
        ]
      }
    ]
  },
  {
    id: "configuracoes",
    title: "Configurações",
    icon: Settings,
    description: "Personalizando o sistema",
    steps: [
      {
        title: "Editar perfil e dados da empresa",
        description: "Em Configurações > Perfil, atualize os dados da sua empresa: nome, CNPJ/CPF, telefone, e-mail e endereço completo. Essas informações são usadas automaticamente nos orçamentos e ordens de serviço gerados pelo sistema.",
        tips: [
          "Adicione o logo da empresa para que ele apareça nos PDFs gerados.",
          "O CEP preenche automaticamente o endereço."
        ]
      },
      {
        title: "Alterar senha e segurança",
        description: "Na seção Segurança, você pode alterar sua senha ou usar o fluxo de redefinição por código OTP enviado por e-mail. Encerre sessões ativas em outros dispositivos se necessário.",
        tips: [
          "Encerre sessões remotas se suspeitar de acesso não autorizado."
        ]
      },
      {
        title: "Aparência (tema claro/escuro)",
        description: "Alterne entre tema claro e escuro na seção Aparência. O sistema salva sua preferência automaticamente para todas as próximas sessões.",
        tips: [
          "O tema escuro é ideal para uso noturno e reduz o cansaço visual."
        ]
      },
      {
        title: "Tipos de serviço e formas de pagamento",
        description: "Personalize os tipos de serviço disponíveis (instalação, manutenção, etc.) e as formas de pagamento aceitas (PIX, cartão, boleto). Configure taxas e parcelas por forma de pagamento.",
        tips: [
          "Vincule uma conta financeira padrão a cada forma de pagamento para registro automático."
        ]
      },
      {
        title: "Capacidade operacional",
        description: "Configure a capacidade da sua equipe: horário de trabalho, tempo de intervalo, tempo médio de deslocamento e se trabalha aos sábados. O sistema usa esses dados para calcular a ocupação na Agenda.",
        tips: [
          "Ajuste o número de equipes ativas conforme sua operação cresce."
        ]
      },
      {
        title: "Plano financeiro (Categorias)",
        description: "Organize suas finanças criando categorias e subcategorias de receitas e despesas. Use a hierarquia de categorias mãe e subcategorias para uma visão detalhada dos seus gastos e ganhos.",
        tips: [
          "Categorias bem organizadas facilitam a análise de relatórios financeiros."
        ]
      },
      {
        title: "Assinatura digital",
        description: "Desenhe a assinatura da sua empresa diretamente na tela (por toque ou mouse). Essa assinatura será aplicada automaticamente nas Ordens de Serviço e Orçamentos gerados em PDF.",
        tips: [
          "Você pode desativar a assinatura automática em OS nas configurações.",
          "Ative também a exigência de assinatura do cliente para documentação completa."
        ]
      }
    ]
  },
  {
    id: "assinatura-planos",
    title: "Assinatura",
    icon: CreditCard,
    description: "Planos e cobrança",
    steps: [
      {
        title: "Conhecer os planos disponíveis",
        description: "O Tecvo oferece três planos:\n• Starter (R$ 29,90/mês): até 15 serviços/mês\n• Essencial (R$ 59,90/mês): até 50 serviços/mês + IA no atendimento\n• Profissional (R$ 99,90/mês): serviços ilimitados + todos os recursos",
        tips: [
          "Você começa com um período de teste gratuito para experimentar o sistema."
        ]
      },
      {
        title: "Assinar um plano",
        description: "Acesse Configurações > Planos e escolha o plano desejado. Clique em \"Assinar\" para ser redirecionado ao checkout do Mercado Pago, onde você pode pagar com cartão, boleto ou PIX.",
        tips: [
          "Após o pagamento, seu plano é ativado automaticamente em poucos segundos."
        ]
      },
      {
        title: "Gerenciar sua assinatura",
        description: "Na mesma tela de Planos, veja seu plano atual, o valor cobrado e a data da próxima cobrança. Use o botão \"Gerenciar assinatura\" para ver detalhes e opções de alteração.",
        tips: [
          "A data de expiração mostra até quando seu plano está ativo."
        ]
      },
      {
        title: "Fazer upgrade de plano",
        description: "Para mudar para um plano superior, acesse Configurações > Planos e clique em \"Upgrade\" no plano desejado. Você será redirecionado para o checkout e a mudança entra em vigor imediatamente.",
        tips: [
          "O upgrade desbloqueia mais serviços por mês e funcionalidades avançadas."
        ]
      },
      {
        title: "Cancelar assinatura",
        description: "Na tela de gerenciamento de assinatura, clique em \"Cancelar assinatura\". Após confirmar, seu plano continuará ativo até a data de expiração atual, depois será revertido para o plano gratuito.",
        warning: "Ao cancelar, você perderá acesso às funcionalidades exclusivas do plano após a data de expiração."
      }
    ]
  },
  {
    id: "lixeira",
    title: "Lixeira",
    icon: Trash2,
    description: "Recuperação de registros excluídos",
    steps: [
      {
        title: "Como funciona a exclusão",
        description: "Ao excluir um serviço, cliente ou outro registro no Tecvo, ele não é apagado permanentemente. O item vai para a Lixeira e fica oculto de todas as telas operacionais (Agenda, Dashboard, Serviços, etc.).",
        tips: [
          "Itens na lixeira não afetam relatórios nem contadores do sistema."
        ]
      },
      {
        title: "Restaurar itens excluídos",
        description: "Acesse a Lixeira pelo menu lateral. Encontre o item que deseja recuperar e clique em \"Restaurar\". O registro voltará a aparecer em todas as telas como se nunca tivesse sido excluído.",
        tips: [
          "Você pode filtrar por tipo de registro (serviços, clientes, etc.) para encontrar mais rápido."
        ]
      },
      {
        title: "Exclusão permanente",
        description: "Na Lixeira, você pode excluir permanentemente um item clicando em \"Excluir definitivamente\". Após a confirmação, o registro será removido do banco de dados e não poderá ser recuperado.",
        warning: "A exclusão permanente é irreversível. Itens na lixeira são removidos automaticamente após 30 dias."
      }
    ]
  },
  {
    id: "suporte",
    title: "Suporte",
    icon: HelpCircle,
    description: "Ajuda e atendimento",
    steps: [
      {
        title: "Acessar o suporte",
        description: "Acesse a Central de Suporte pelo menu lateral. Você encontrará três canais de atendimento: E-mail, WhatsApp e Chat ao Vivo. Escolha o canal mais conveniente para sua necessidade.",
        tips: [
          "O Chat ao Vivo oferece respostas em tempo real durante o horário comercial.",
          "Consulte o Tutorial antes de abrir um chamado — sua dúvida pode já ter resposta."
        ]
      },
      {
        title: "Enviar feedback e sugestões",
        description: "Na página de Atualizações, use o formulário de feedback para enviar sugestões de melhorias, reportar bugs ou solicitar novas funcionalidades. Toda sugestão é analisada pela equipe de desenvolvimento.",
        tips: [
          "Seja específico ao descrever bugs: inclua o que você fez, o que esperava e o que aconteceu."
        ]
      },
      {
        title: "Canal WhatsApp de atendimento",
        description: "Clique no botão do WhatsApp na Central de Suporte para iniciar uma conversa direta com a equipe de atendimento. Esse canal é ideal para dúvidas rápidas e suporte personalizado.",
        tips: [
          "O WhatsApp é o canal mais rápido para resolver problemas urgentes."
        ]
      }
    ]
  },
  {
    id: "relatorios",
    title: "Relatórios",
    icon: BarChart3,
    description: "Relatórios financeiros e gerenciais",
    steps: [
      {
        title: "Gerar relatórios por período",
        description: "Acesse Financeiro > Relatórios e selecione o mês e ano desejado. O sistema exibe um resumo completo com total de receitas, despesas e saldo do período, além de detalhamento por categoria.",
        tips: [
          "Compare diferentes meses para identificar tendências no seu faturamento."
        ]
      },
      {
        title: "Exportar PDF com resumo financeiro",
        description: "Clique em \"Exportar PDF\" para gerar um documento profissional com o resumo financeiro do período selecionado. O PDF inclui gráficos, tabelas de categorias e totais consolidados.",
        tips: [
          "Use os relatórios em PDF para apresentar resultados a sócios ou para fins contábeis."
        ]
      },
      {
        title: "Gráficos de fluxo de caixa e categorias",
        description: "Os relatórios incluem gráficos visuais de fluxo de caixa (evolução de receitas vs despesas ao longo do tempo) e distribuição por categoria (pizza/barras), facilitando a análise visual das finanças.",
        tips: [
          "O gráfico de categorias ajuda a identificar onde você mais gasta ou mais fatura.",
          "Use o plano financeiro organizado para ter relatórios mais detalhados."
        ]
      },
      {
        title: "Recebimentos por Técnico",
        description: "O relatório de Recebimentos por Técnico mostra todos os pagamentos recebidos por cada membro da equipe, com detalhamento por serviço e forma de pagamento. Exporte em PDF para controle e comissionamento.",
        tips: [
          "Filtre por período e técnico para análises mais específicas."
        ]
      }
    ]
  }
];
