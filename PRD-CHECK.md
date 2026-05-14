**PRD: Evolução BillSync – Sistema de Checklists Diários via WhatsApp**

**1. Objetivo do Produto**
Expandir o ecossistema do BillSync criando um módulo de checklists diários. O objetivo é permitir que o cliente cadastre tarefas ou hábitos, defina um horário específico, e receba essa lista automaticamente no WhatsApp em formato de enquete (poll). Ao interagir com a enquete, as respostas serão salvas no banco de dados, alimentando um dashboard de acompanhamento de progresso e métricas de conclusão.

**2. Problema que Resolve**
O acompanhamento de tarefas e hábitos diários costuma falhar devido ao atrito de abrir um aplicativo específico todos os dias. Ao transferir o checklist para o WhatsApp, canal já utilizado ativamente pelo público-alvo, reduzimos a fricção. O formato interativo de enquetes permite que o usuário marque e desmarque tarefas concluídas sem precisar digitar comandos, tornando a atualização do status imediata e sem esforço.

**3. Funcionalidades Principais**
*   **Módulo de Gestão de Checklists:** Interface web (React) para criar, editar e excluir itens de um checklist e configurar o fuso horário e o horário exato de envio ``.
*   **Disparo Automatizado Diário:** Sistema de orquestração e agendamento que envia a enquete via WAHA exatamente no horário estipulado pelo usuário ``.
*   **Enquetes Interativas de Múltipla Escolha:** Utilização do endpoint `POST /api/sendPoll` do WAHA, permitindo ao usuário selecionar múltiplas opções simultaneamente ``.
*   **Recepção de Respostas em Tempo Real:** Webhook dedicado para capturar o evento `poll.vote`, que atualiza o status de cada item no banco de dados ``.
*   **Dashboard de Acompanhamento:** Tela com painéis visuais indicando quantidade de itens respondidos, porcentagem de conclusão diária e histórico de dias anteriores.

**4. Fluxo do Usuário**
1. O cliente faz login na interface web do BillSync e acessa a nova aba "Checklists".
2. Ele adiciona as tarefas do dia (ex: "Beber água", "Ler 10 páginas", "Treinar") e configura o horário de recebimento (ex: 08:00).
3. No horário agendado, o cliente recebe uma mensagem no WhatsApp com a pergunta do checklist e os itens como opções da enquete ``.
4. Durante o dia, o cliente toca nas opções que já completou. O WhatsApp permite desmarcar e remarcar opções à vontade.
5. O cliente acessa o Dashboard web do BillSync e visualiza em tempo real um gráfico com a porcentagem de tarefas já concluídas naquele dia, além do seu histórico semanal.

**5. Regras de Negócio**
*   **RN01 (Limites da Enquete):** A enquete do WhatsApp suporta no máximo 12 opções e no mínimo 2. Cada item da lista deve ser estritamente único, caso contrário, a API retornará um erro de validação (400 Validation Error) ``.
*   **RN02 (Respostas Múltiplas):** A enquete deve ser enviada com a propriedade `poll.multipleAnswers: true`, permitindo que o usuário marque mais de uma tarefa concluída ao mesmo tempo ``.
*   **RN03 (Estado da Resposta):** O WhatsApp não envia votos incrementais. Cada vez que o usuário interage, o webhook `poll.vote` envia o array `selectedOptions` completo com o estado exato daquele momento ``. O backend deve atualizar o banco substituindo as seleções anteriores pela nova lista.
*   **RN04 (Concorrência de Votos):** O usuário pode mudar de ideia e clicar várias vezes. O backend deve comparar a propriedade `timestamp` da carga útil do webhook (tratada numericamente) e priorizar sempre a resposta com o timestamp mais recente para refletir o estado real ``.
*   **RN05 (Correlação de ID):** O ID retornado na criação da enquete (ex: `false_{chatId}_{messageId}`) deve ser salvo no banco de dados (PostgreSQL) associado àquele dia/usuário, para que, ao receber um voto, o sistema saiba qual checklist está sendo respondido ``.
*   **RN06 (Arquitetura de Lógica):** Como premissa do BillSync, nenhuma regra de negócio deve viver na ferramenta de automação (n8n). O n8n (ou scheduler) apenas orquestra a chamada de API e os dados vivem no PostgreSQL via backend Node.js ``.

**6. Requisitos Funcionais**
*   **RF01:** O frontend deve restringir a criação de checklists a um máximo de 12 itens ``.
*   **RF02:** O sistema de agendamento (ex: Posthook, BullMQ ou n8n cron) deve suportar envio baseado no fuso horário local com base nas preferências do usuário ``.
*   **RF03:** O envio deve ser feito chamando o endpoint `POST /api/sendPoll` com os parâmetros `chatId`, `poll.name` (ex: "Checklist de Hoje"), e `poll.options` ``.
*   **RF04:** A API Node.js deve expor um webhook configurado no WAHA para escutar exclusivamente os eventos `poll.vote` e `poll.vote.failed` ``.
*   **RF05:** Ao receber uma requisição de voto, o backend deve salvar o array de strings em `selectedOptions` no banco e calcular a porcentagem de conclusão ``.

**7. Requisitos Não Funcionais**
*   **RNF01 (Autenticidade):** O webhook exposto pelo BillSync deve usar a verificação HMAC (`WHATSAPP_HOOK_HMAC_KEY`) lendo o cabeçalho `X-Webhook-Hmac` para garantir que apenas o WAHA injete votos no sistema ``.
*   **RNF02 (Persistência WAHA):** Para o recurso de enquetes funcionar de forma contínua, as chaves criptográficas da sessão devem ser salvas persistindo os volumes do Docker (ex: `/app/.sessions`), prevenindo erros de decodificação de votos caso a API seja reiniciada ``.
*   **RNF03 (Escolha de Engine WAHA):** O WAHA deve estar obrigatoriamente configurado com o engine **NOWEB** ou **GOWS**, pois o WEBJS tradicional não tem suporte confiável para descriptografar opções selecionadas em enquetes ``.

**8. Métricas**
*   **Taxa de Entrega Diária:** Percentual de enquetes disparadas com sucesso (`status = sent`).
*   **Taxa de Engajamento/Resposta:** Percentual de clientes que interagem com a enquete pelo menos uma vez no dia.
*   **Porcentagem de Conclusão Média:** A proporção de itens assinalados contra os itens solicitados (ex: 8 de 10 itens = 80%).
*   **Erro de Descriptografia:** Quantidade do evento `poll.vote.failed` recebidos (que indica problema de chaves) ``.

**9. Integrações**
*   **WAHA:** API encarregada do envio via `POST /api/sendPoll` e recepção via webhook assíncrono para os eventos de voto ``.
*   **Orquestração/Scheduler:** n8n para jobs engatilhados ou Posthook/BullMQ (nativos do Node.js) para processamento assíncrono baseado nos horários do banco de dados ``.
*   **Banco de Dados (PostgreSQL / Supabase):** Armazenamento de IDs das mensagens (`pollMessageId`) e registros de votos e métricas diárias ``.

**10. Possíveis Riscos e Mitigações**
*   **Risco 1 - Perda de votos por criptografia (`poll.vote.failed`):** Devido à criptografia de ponta-a-ponta do WhatsApp, falhas temporárias na inicialização do storage do WAHA podem gerar eventos de erro onde os itens votados aparecem como um array vazio ``.
    *   *Mitigação:* Usar armazenamento durável para a sessão (`/app/.sessions` mapeado para um volume host). Caso um evento `poll.vote.failed` chegue, o backend pode disparar uma mensagem automática ("Desculpe, não conseguimos ler seu voto. Por favor, marque novamente na enquete acima") ``.
*   **Risco 2 - Risco de Banimento (Spam):** O envio contínuo e exato de mensagens pode simular comportamento de bot aos olhos da Meta ``.
    *   *Mitigação:* Usar o BillSync em volumes pequenos de uso pessoal ou adotar lógica de Queue/Fila limitando a frequência (ex. uso de Redis + BullMQ com throttles) e delays aleatórios para contas de clientes no futuro ``.
*   **Risco 3 - Limite das Enquetes:** Limitação técnica de apenas 12 tarefas ``.
    *   *Mitigação:* Deixar a restrição clara na UI com um contador (ex: "5/12 itens cadastrados").

**11. Sugestão de MVP (Minimum Viable Product)**
*   **Backend & Automação:** Cadastrar um único horário de disparo (ex: 09:00 local) para todos os usuários em um cron diário simplificado ``.
*   **WhatsApp:** Usar o `sendPoll` fixo no máximo 10 opções ``. Quando o Webhook devolver o objeto de votos, substituir as tarefas do dia como "completas" no banco, usando a versão mais recente dos timestamps ``.
*   **Frontend:**
    *   Uma tela onde o usuário define os itens da checklist em lista simples de texto.
    *   Uma página "Dashboard Hoje" que mostra uma barra de progresso (0 a 100%) lendo do banco de dados quais tarefas ele marcou lá no WhatsApp.