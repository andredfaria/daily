import React, { useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { COMANDOS_WHATSAPP } from '../utils/comandosWhatsapp'

interface Secao {
  id: string
  titulo: string
  icone: string
}

const SECOES: Secao[] = [
  { id: 'whatsapp', titulo: 'Comandos no WhatsApp', icone: 'chat' },
  { id: 'contas', titulo: 'Contas e gastos', icone: 'receipt_long' },
  { id: 'checklists', titulo: 'Checklists', icone: 'checklist' },
  { id: 'ativos', titulo: 'Ativos', icone: 'trending_up' },
  { id: 'resumos', titulo: 'Resumos', icone: 'summarize' },
  { id: 'duvidas', titulo: 'Dúvidas', icone: 'help' },
]

const Titulo: React.FC<{ secao: Secao }> = ({ secao }) => (
  <div className="flex items-center gap-2 mb-3">
    <span className="material-symbols-outlined text-primary">{secao.icone}</span>
    <h2 className="text-base font-semibold text-on-surface">{secao.titulo}</h2>
  </div>
)

const secao = (id: string): Secao => SECOES.find((s) => s.id === id)!

/** Passos numerados de uma seção. */
const Passos: React.FC<{ itens: React.ReactNode[] }> = ({ itens }) => (
  <ol className="space-y-2.5">
    {itens.map((item, i) => (
      <li key={i} className="flex gap-3 text-sm text-on-surface-variant leading-relaxed">
        <span className="shrink-0 w-6 h-6 rounded-full bg-primary/15 text-primary text-xs font-semibold flex items-center justify-center">
          {i + 1}
        </span>
        <span className="pt-0.5">{item}</span>
      </li>
    ))}
  </ol>
)

const Cmd: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <code className="px-1.5 py-0.5 rounded bg-surface-container text-primary font-mono text-xs">{children}</code>
)

const Duvida: React.FC<{ pergunta: string; children: React.ReactNode }> = ({ pergunta, children }) => (
  <details className="group border-b border-outline-variant/30 last:border-0">
    <summary className="flex items-center justify-between gap-3 min-h-[48px] cursor-pointer list-none text-sm font-medium text-on-surface">
      {pergunta}
      <span className="material-symbols-outlined text-on-surface-variant transition-transform group-open:rotate-180">expand_more</span>
    </summary>
    <div className="pb-4 text-sm text-on-surface-variant leading-relaxed space-y-2">{children}</div>
  </details>
)

const ComoUsar: React.FC = () => {
  const { hash } = useLocation()

  // Link de outra página com âncora (/como-usar#whatsapp): o React Router não
  // rola até a seção sozinho.
  useEffect(() => {
    if (hash) document.getElementById(hash.slice(1))?.scrollIntoView()
  }, [hash])

  return (
    <div className="space-y-6 animate-fadeIn max-w-3xl">
      {/* Índice */}
      <nav aria-label="Seções" className="flex gap-2 overflow-x-auto no-scrollbar -mx-4 px-4 md:mx-0 md:px-0 md:flex-wrap">
        {SECOES.map((s) => (
          <a
            key={s.id}
            href={`#${s.id}`}
            className="shrink-0 flex items-center gap-1.5 min-h-[40px] px-3 rounded-full bg-surface-container text-xs font-semibold text-on-surface-variant hover:text-primary transition-colors"
          >
            <span className="material-symbols-outlined text-base">{s.icone}</span>
            {s.titulo}
          </a>
        ))}
      </nav>

      {/* WhatsApp */}
      <section id="whatsapp" className="section-card scroll-mt-20">
        <Titulo secao={secao('whatsapp')} />
        <p className="text-sm text-on-surface-variant leading-relaxed mb-4">
          Dá para consultar e anotar coisas sem abrir o app, mandando uma mensagem para o número do Rotina.
        </p>
        <Passos
          itens={[
            <>Abra a conversa com o <strong className="text-on-surface">número do Rotina</strong> — o mesmo que manda o código de login e os lembretes.</>,
            <>Escreva o comando começando com barra, por exemplo <Cmd>/gasto 45 mercado</Cmd>, e envie.</>,
            <>A resposta chega na mesma conversa em poucos segundos.</>,
          ]}
        />
        <p className="text-xs text-on-surface-variant/80 mt-4 leading-relaxed">
          A mensagem precisa sair do número cadastrado na sua conta e ser numa conversa direta (em grupo não funciona).
          Sem a barra no começo, o Rotina entende como conversa e não responde.
        </p>

        <ul className="mt-5 space-y-3">
          {COMANDOS_WHATSAPP.map((c) => (
            <li key={c.comando} className="rounded-xl border border-outline-variant/40 p-4">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <code className="font-mono text-sm font-semibold text-primary">{c.exemplo}</code>
                <span className="text-xs text-on-surface-variant">{c.descricao}</span>
              </div>
              <pre className="mt-3 whitespace-pre-wrap font-sans text-xs leading-relaxed text-on-surface bg-surface-container rounded-lg rounded-tl-none px-3 py-2.5">
                {c.resposta}
              </pre>
            </li>
          ))}
        </ul>

        <div className="mt-4 text-xs text-on-surface-variant leading-relaxed space-y-1.5">
          <p>
            <strong className="text-on-surface">/gasto:</strong> o valor pode vir antes ou depois — <Cmd>/gasto pão 12,50</Cmd> também vale.
            Aceita <Cmd>45,90</Cmd>, <Cmd>1.234,56</Cmd> e <Cmd>R$45</Cmd>. A categoria sai do nome (mercado → Alimentação, uber → Transporte);
          para escolher, use <Cmd>#</Cmd> com o nome de qualquer categoria, inclusive as que você criou: <Cmd>/gasto 50 ração #pet</Cmd>.
          </p>
          <p>
            <strong className="text-on-surface">/marcar:</strong> não precisa de acento nem do nome inteiro — <Cmd>/marcar medit</Cmd> acha “Meditação”.
            Se o trecho servir para mais de um item, o Rotina pergunta qual.
          </p>
        </div>
      </section>

      {/* Contas */}
      <section id="contas" className="section-card scroll-mt-20">
        <Titulo secao={secao('contas')} />
        <Passos
          itens={[
            <>Em <Link to="/contas/lista" className="text-primary font-medium">Contas</Link>, toque em <strong className="text-on-surface">Nova Conta</strong> e informe valor, recorrência (mensal, semanal, avulsa…) e, se quiser, a chave PIX ou o boleto.</>,
            <>Marque a conta como <strong className="text-on-surface">Fixa</strong> quando o valor é sempre o mesmo (aluguel, internet) ou <strong className="text-on-surface">Variável</strong> quando muda todo mês (luz, água). Na variável, o valor cadastrado é uma estimativa: quando a fatura chegar, informe o valor real do mês no card da conta, e a análise passa a usar o valor real.</>,
            <>Alguns dias antes do vencimento, chega um lembrete no WhatsApp com os dados de pagamento. Quantos dias antes e a hora do aviso ficam em <Link to="/configuracoes" className="text-primary font-medium">Configurações</Link>.</>,
            <>Gastos do dia a dia (mercado, café) ficam à parte das contas, em <Link to="/gastos" className="text-primary font-medium">Gastos</Link>, e podem ser anotados também pelo <Cmd>/gasto</Cmd>. Cada gasto tem uma categoria (Alimentação, Transporte, Lazer…), e o total do mês por categoria aparece acima da lista — toque numa para filtrar. Em <strong className="text-on-surface">Categorias</strong> dá para criar as suas (Pet, Filhos…), renomear, trocar o ícone e ocultar as que não usa. Gastos não geram lembrete e têm limite mensal próprio, separado do das contas.</>,
            <>Na aba <Link to="/contas/analise" className="text-primary font-medium">Análise</Link> você vê o total por categoria, a projeção dos próximos meses e quanto do limite mensal de contas já foi usado.</>,
          ]}
        />
      </section>

      {/* Checklists */}
      <section id="checklists" className="section-card scroll-mt-20">
        <Titulo secao={secao('checklists')} />
        <Passos
          itens={[
            <>Em <Link to="/checklists/lista" className="text-primary font-medium">Checklists</Link>, crie uma lista com os hábitos do dia, o horário de envio e os dias da semana.</>,
            <>No horário, chega uma enquete no WhatsApp. Marque o que já fez — dá para voltar e marcar mais ao longo do dia.</>,
            <>Prefere digitar? Use <Cmd>/marcar academia</Cmd>, e <Cmd>/hoje</Cmd> mostra o que falta.</>,
            <>Se o checklist ficar 3 dias seguidos sem nenhuma resposta, o envio dele é pausado. Reative na tela de Checklists. Os lembretes de contas continuam normalmente.</>,
          ]}
        />
      </section>

      {/* Ativos */}
      <section id="ativos" className="section-card scroll-mt-20">
        <Titulo secao={secao('ativos')} />
        <Passos
          itens={[
            <>Em <Link to="/ativos/carteira" className="text-primary font-medium">Ativos</Link>, cadastre ações, FIIs ou criptomoedas com quantidade e preço médio.</>,
            <>Defina um preço-alvo e um stop, se quiser. Quando a cotação chegar lá, você recebe um aviso no WhatsApp (uma vez; depois reative no app).</>,
            <>A cotação é atualizada uma vez por dia, no horário dos alertas de ativos. A aba Análise compara a carteira com o CDI e o Ibovespa.</>,
          ]}
        />
      </section>

      {/* Resumos */}
      <section id="resumos" className="section-card scroll-mt-20">
        <Titulo secao={secao('resumos')} />
        <ul className="space-y-2 text-sm text-on-surface-variant leading-relaxed">
          <li><strong className="text-on-surface">Semanal:</strong> às 8h do dia escolhido, com as contas da semana, a variação da carteira e como foram os checklists.</li>
          <li><strong className="text-on-surface">Mensal:</strong> no dia 1º às 8h, o fechamento do mês anterior: contas, gastos e orçamento.</li>
        </ul>
        <p className="text-xs text-on-surface-variant/80 mt-3">
          Os dois são ligados e desligados em <Link to="/configuracoes" className="text-primary font-medium">Configurações</Link>.
        </p>
      </section>

      {/* Dúvidas */}
      <section id="duvidas" className="section-card scroll-mt-20">
        <Titulo secao={secao('duvidas')} />
        <Duvida pergunta="Mandei um comando e não veio resposta">
          <p>Confira se a mensagem começa com <Cmd>/</Cmd>, se saiu do número cadastrado na sua conta e se não foi num grupo.</p>
          <p>Se tudo estiver certo e mesmo assim não vier resposta, mande <Cmd>/ajuda</Cmd>: se nem ele responder, o WhatsApp do Rotina está fora do ar no momento.</p>
        </Duvida>
        <Duvida pergunta="Anotei um gasto errado">
          <p>Em <Link to="/gastos" className="text-primary font-medium">Gastos</Link>, toque no lápis ao lado do gasto para corrigir o nome, o valor, a categoria ou o dia — ou na lixeira para apagar.</p>
        </Duvida>
        <Duvida pergunta="Marquei um item pelo /marcar e votei na enquete depois">
          <p>Os dois se somam: o que foi marcado por mensagem continua marcado mesmo que não esteja selecionado na enquete.</p>
        </Duvida>
        <Duvida pergunta="O /marcar diz que não há checklist hoje">
          <p>O item só pode ser marcado depois que a enquete do dia foi enviada. Antes do horário do checklist, ainda não existe o que marcar.</p>
        </Duvida>
        <Duvida pergunta="Parei de receber o checklist">
          <p>Depois de 3 dias seguidos sem resposta, o envio é pausado. Reative o checklist na tela de Checklists.</p>
        </Duvida>
      </section>
    </div>
  )
}

export default ComoUsar
