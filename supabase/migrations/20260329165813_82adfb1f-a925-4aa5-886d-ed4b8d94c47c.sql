
INSERT INTO analytics_automations (name, description, trigger_type, enabled, delay_minutes, cooldown_hours, message_template, email_template) VALUES
(
  'Inativo 3 dias - Lembrete leve',
  'Usuário não acessa há 3 dias — lembrete amigável',
  'inactive_3d',
  true,
  0,
  72,
  E'Oi {{name}}, faz 3 dias que você não entra na Tecvo. Enquanto isso, seus clientes podem estar precisando de manutenção e você nem sabe. 📊\n\nDá uma olhada rápida:\nhttps://tecvo.com.br/dashboard',
  E'Oi {{name}},\n\nFaz 3 dias que você não acessa a Tecvo. Nesse tempo, pode ter perdido um cliente que precisava de manutenção.\n\nA Tecvo avisa automaticamente quando um cliente está no ponto de ser atendido — mas só se você estiver usando.\n\nDá uma olhada rápida agora.'
),
(
  'Inativo 7 dias - Reforço de dor',
  'Usuário não acessa há 7 dias — confronto com perda',
  'inactive_7d',
  true,
  0,
  168,
  E'{{name}}, faz 1 semana que você sumiu da Tecvo.\n\nEnquanto isso:\n❌ Clientes podem ter vencido manutenção\n❌ Orçamentos ficaram sem resposta\n❌ Oportunidades de receita passaram\n\nVolta agora e vê o que está pendente:\nhttps://tecvo.com.br/dashboard',
  E'{{name}},\n\nFaz 1 semana que você não acessa a Tecvo. Isso significa que há 7 dias você não sabe:\n\n• Quais clientes precisam de manutenção agora\n• Quantos orçamentos ficaram parados\n• Quanto dinheiro deixou na mesa\n\nA Tecvo faz esse controle pra você — mas precisa que você entre.\n\nAcesse agora e veja o que está pendente.'
),
(
  'Inativo 15 dias - Última tentativa',
  'Usuário não acessa há 15 dias — última tentativa de recuperação',
  'inactive_15d',
  true,
  0,
  360,
  E'{{name}}, faz 15 dias que você não entra na Tecvo.\n\nSério: quantos clientes você perdeu nesse tempo por falta de controle?\n\nA gente criou a Tecvo exatamente pra resolver isso. E o sistema está lá, pronto, esperando você.\n\nSe quiser, me conta o que aconteceu. Se não, tudo bem — mas não deixa dinheiro na mesa.\n\nhttps://tecvo.com.br/dashboard',
  E'{{name}},\n\nFaz 15 dias que você não acessa a Tecvo.\n\nEu sei que a correria do dia a dia consome — mas é exatamente por isso que a Tecvo existe. Pra você não perder cliente, não esquecer manutenção, não deixar dinheiro na mesa.\n\nSeu sistema está lá, com tudo configurado. Só falta você entrar.\n\nSe algo não funcionou como esperava, me conta. Quero ajudar de verdade.'
)
ON CONFLICT DO NOTHING;

UPDATE analytics_automations 
SET 
  message_template = E'Oi {{name}}, vi que você começou a se cadastrar na Tecvo mas não finalizou.\n\nSe travou em alguma coisa, me fala — te ajudo agora mesmo. Leva menos de 2 minutos pra terminar.\n\n👉 https://tecvo.com.br/register',
  email_template = E'{{name}}, vi que você começou o cadastro na Tecvo mas não terminou.\n\nSe teve alguma dúvida ou travou em algo, fala comigo. Leva menos de 2 minutos pra finalizar e você já começa a organizar seus clientes e serviços.\n\nFinalizar agora leva menos de 2 minutos.'
WHERE trigger_type = 'signup_recovery';

UPDATE analytics_automations 
SET 
  message_template = E'{{name}}, você criou sua conta na Tecvo mas ainda não cadastrou seu primeiro cliente.\n\nO primeiro passo é simples: cadastra um cliente e cria uma OS pra ele. Quando fizer isso, vai entender o poder da coisa.\n\nComeça agora:\nhttps://tecvo.com.br/dashboard',
  email_template = E'{{name}}, você já tem acesso à Tecvo mas ainda não começou a usar de verdade.\n\nO segredo é simples: cadastre seu primeiro cliente e crie uma Ordem de Serviço. Quando fizer isso, vai ver como a Tecvo organiza tudo automaticamente.\n\n• Agenda de serviços\n• Controle financeiro\n• Lembrete de manutenção pro cliente\n\nTudo começa com o primeiro cadastro.'
WHERE trigger_type = 'new_user_activation';

UPDATE analytics_automations 
SET 
  message_template = E'{{name}}, faz um tempo que você não entra na Tecvo e eu queria entender o motivo.\n\nSe algo não funcionou como esperava, me conta. Se é falta de tempo, entendo — mas seus clientes continuam precisando de manutenção e você pode estar perdendo receita sem perceber.\n\nDá uma olhada rápida:\nhttps://tecvo.com.br/dashboard',
  email_template = E'{{name}}, percebi que faz um tempo que você não acessa a Tecvo.\n\nSei que a rotina é pesada, mas enquanto você está fora, seus clientes podem estar precisando de manutenção — e a receita que vem com isso está passando.\n\nSe algo não funcionou como esperava, me fala. Quero ajudar de verdade.\n\nAcesse e veja o que está pendente.'
WHERE trigger_type = 'churn_recovery';
