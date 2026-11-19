import React from 'react'
import FeedAtividade from '../../components/admin/FeedAtividade'

// A API aceita uma lista de tipos e um status por chamada, então são duas
// seções em vez de uma mescla: erros do sistema e envios que falharam.
const AdminErros: React.FC = () => (
  <div className="space-y-6">
    <section className="space-y-2">
      <h2 className="text-sm font-semibold text-on-surface">Erros do sistema</h2>
      <FeedAtividade filtros={{ kind: 'erro_api,erro_tick' }} vazio="Nenhum erro registrado." />
    </section>
    <section className="space-y-2">
      <h2 className="text-sm font-semibold text-on-surface">Envios com falha</h2>
      <FeedAtividade filtros={{ kind: 'msg_enviada', status: 'falha' }} vazio="Nenhum envio falhou." />
    </section>
  </div>
)

export default AdminErros
