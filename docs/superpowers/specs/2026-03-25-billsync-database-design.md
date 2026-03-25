# BillSync — Database Design Spec

| Campo | Valor |
|---|---|
| **Data** | 2026-03-25 |
| **Status** | Aprovado |
| **Banco** | MySQL 8.0.13+ |
| **PKs** | UUID `CHAR(36)` com `DEFAULT (UUID())` |

---

## Visão Geral

Schema relacional para o BillSync — sistema pessoal de contas a pagar com notificações WhatsApp. 5 tabelas em hierarquia estrita com deleção em cascata.

```
users
 └── bills (N)
      ├── payment_methods (N)
      └── bill_occurrences (N)
           └── notifications (N)
```

**Decisões de design:**
- Preferências de notificação inline em `users` (schema flat)
- UUID `CHAR(36)` mantém compatibilidade com tipos TypeScript de `src/types/index.ts`
- `utf8mb4` para suporte a emojis (`✅`) nos templates WhatsApp
- `user_id` presente apenas em `bills` — tabelas filhas isoladas via FK, pronto para multi-tenant (Fase 7)

---

## Tabela: `users`

```sql
CREATE TABLE users (
  id                        CHAR(36)         NOT NULL DEFAULT (UUID()),
  name                      VARCHAR(255),
  whatsapp_number           VARCHAR(20)      NOT NULL,
  timezone                  VARCHAR(50)      NOT NULL DEFAULT 'America/Sao_Paulo',
  is_active                 BOOLEAN          NOT NULL DEFAULT TRUE,

  -- Preferências de notificação (RF-32, RF-33)
  whatsapp_alerts_enabled   BOOLEAN          NOT NULL DEFAULT TRUE,
  weekly_summary_enabled    BOOLEAN          NOT NULL DEFAULT FALSE,
  default_days_before_alert TINYINT UNSIGNED NOT NULL DEFAULT 3,

  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  UNIQUE KEY uq_users_whatsapp (whatsapp_number)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

**`uq_users_whatsapp`** — lookup crítico do webhook de confirmação WhatsApp (RN-06). Timezone armazenado como string IANA; cálculos de data/hora no backend (RN-08).

---

## Tabela: `bills`

```sql
CREATE TABLE bills (
  id                      CHAR(36)      NOT NULL DEFAULT (UUID()),
  user_id                 CHAR(36)      NOT NULL,
  name                    VARCHAR(255)  NOT NULL,
  description             TEXT,
  amount                  DECIMAL(10,2) NOT NULL,
  recurrence_type         ENUM('monthly','weekly','once') NOT NULL,
  recurrence_day_of_month TINYINT UNSIGNED,     -- 1–31, se recurrence_type = 'monthly'
  recurrence_day_of_week  TINYINT UNSIGNED,     -- 0–6 (0=Dom), se recurrence_type = 'weekly'
  due_date                DATE,                 -- data exata, se recurrence_type = 'once'
  days_before_alert       TINYINT UNSIGNED NOT NULL DEFAULT 3,
  is_active               BOOLEAN       NOT NULL DEFAULT TRUE,

  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  KEY idx_bills_user_id     (user_id),
  KEY idx_bills_user_active (user_id, is_active),

  CONSTRAINT fk_bills_user FOREIGN KEY (user_id)
    REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

- Os três campos de data são mutuamente exclusivos por `recurrence_type` — validação no backend
- **`idx_bills_user_active`** — query do job de geração de ocorrências
- RN-01: dia 31 em meses menores → backend usa último dia válido
- RN-02: conta `once` → desativada automaticamente após ocorrência paga/cancelada

---

## Tabela: `payment_methods`

```sql
CREATE TABLE payment_methods (
  id              CHAR(36)    NOT NULL DEFAULT (UUID()),
  bill_id         CHAR(36)    NOT NULL,
  type            ENUM('pix','boleto') NOT NULL,

  -- PIX (RF-07)
  pix_key_type    ENUM('cpf','email','phone','random'),
  pix_key         VARCHAR(255),
  pix_beneficiary VARCHAR(255),

  -- Boleto (RF-08)
  boleto_code     TEXT,

  is_primary      BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at      DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  KEY idx_pm_bill_id      (bill_id),
  KEY idx_pm_bill_primary (bill_id, is_primary),

  CONSTRAINT fk_pm_bill FOREIGN KEY (bill_id)
    REFERENCES bills(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

- **`idx_pm_bill_primary`** — busca do método principal na montagem da mensagem WhatsApp (RF-18)
- Unicidade de `is_primary` por `bill_id` garantida no backend (RN-03) — constraint parcial não existe no MySQL
- RN-03: se método principal removido, backend promove o próximo disponível

---

## Tabela: `bill_occurrences`

```sql
CREATE TABLE bill_occurrences (
  id                   CHAR(36)      NOT NULL DEFAULT (UUID()),
  bill_id              CHAR(36)      NOT NULL,
  due_date             DATE          NOT NULL,
  amount               DECIMAL(10,2) NOT NULL,
  status               ENUM('pending','paid','overdue','cancelled')
                         NOT NULL DEFAULT 'pending',

  -- Confirmação de pagamento (RF-15, RF-24)
  paid_at              DATETIME,
  confirmation_source  ENUM('whatsapp','web','manual'),
  whatsapp_msg         TEXT,

  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  KEY idx_occ_bill_id    (bill_id),
  KEY idx_occ_due_date   (due_date),
  KEY idx_occ_status_due (status, due_date),
  KEY idx_occ_bill_due   (bill_id, due_date),

  CONSTRAINT fk_occ_bill FOREIGN KEY (bill_id)
    REFERENCES bills(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

- `amount` copiado de `bills.amount` na geração — não muda com edições posteriores (RN-07)
- **`idx_occ_status_due`** — job diário de overdue (RF-14):
  `UPDATE bill_occurrences SET status='overdue' WHERE status='pending' AND due_date < CURDATE()`
- **`idx_occ_bill_due`** — evita duplicação na geração de ocorrências
- Caso 14.4: ocorrência avulsa no passado → criada com `status = 'overdue'`, sem notificações

---

## Tabela: `notifications`

```sql
CREATE TABLE notifications (
  id                  CHAR(36)    NOT NULL DEFAULT (UUID()),
  bill_occurrence_id  CHAR(36)    NOT NULL,
  type                ENUM('before_due','on_due_date') NOT NULL,
  scheduled_for       DATE        NOT NULL,
  status              ENUM('scheduled','sent','failed','skipped')
                        NOT NULL DEFAULT 'scheduled',

  -- Pós-envio (RF-19)
  sent_at             DATETIME,
  waha_message_id     VARCHAR(255),
  message_body        TEXT,
  error_detail        TEXT,

  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  KEY idx_notif_occurrence_id     (bill_occurrence_id),
  KEY idx_notif_scheduled_status  (scheduled_for, status),
  KEY idx_notif_occurrence_status (bill_occurrence_id, status),

  CONSTRAINT fk_notif_occurrence FOREIGN KEY (bill_occurrence_id)
    REFERENCES bill_occurrences(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

- **`idx_notif_scheduled_status`** — o índice mais crítico da aplicação, usado pelo endpoint `GET /notifications/due-today`:
  `WHERE scheduled_for = CURDATE() AND status = 'scheduled'`
- **`idx_notif_occurrence_status`** — cancelamento ao pagar (RN-04):
  `UPDATE notifications SET status='skipped' WHERE bill_occurrence_id = ? AND status = 'scheduled'`
- RN-05: job de envio filtra apenas `status = 'scheduled'` — nunca reenvia
- `message_body` armazena texto exato enviado para auditoria

---

## Resumo de Índices por Query Crítica

| Query | Tabela | Índice |
|---|---|---|
| Job overdue diário (RF-14) | `bill_occurrences` | `idx_occ_status_due` |
| Notificações do dia — due-today (RF-17) | `notifications` | `idx_notif_scheduled_status` |
| Cancelar notificações ao pagar (RN-04) | `notifications` | `idx_notif_occurrence_status` |
| Evitar duplicata na geração | `bill_occurrences` | `idx_occ_bill_due` |
| Webhook — lookup por WhatsApp (RN-06) | `users` | `uq_users_whatsapp` |
| Método principal para mensagem (RF-18) | `payment_methods` | `idx_pm_bill_primary` |
| Contas ativas — job geração | `bills` | `idx_bills_user_active` |

---

## Notas de Escalabilidade e Multi-usuário

1. **Multi-tenant pronto**: isolamento por `user_id` em `bills` — adicionar `WHERE user_id = ?` nas queries é suficiente para Fase 7
2. **UUID como PK**: sem exposição de volume/sequência entre tenants
3. **Busca por nome**: `LIKE '%termo%'` suficiente para < 10.000 registros; se escalar, adicionar `FULLTEXT INDEX` em `bills.name`
4. **Particionamento futuro**: `bill_occurrences` pode usar `PARTITION BY RANGE YEAR(due_date)` em cenário SaaS de alto volume
5. **utf8mb4 obrigatório**: suporte a emojis (`✅`) nas palavras-chave e templates WhatsApp

---

## Requisito de Versão

`DEFAULT (UUID())` como expressão default requer **MySQL 8.0.13+**. Em versões anteriores, gerar UUID na aplicação e inserir explicitamente.

---

## Verificação

```sql
-- 1. Verificar criação sem erros
SHOW TABLES;
SHOW CREATE TABLE notifications;

-- 2. Verificar índices
SHOW INDEX FROM bill_occurrences;
SHOW INDEX FROM notifications;

-- 3. Verificar cascata de deleção
-- Inserir user → bill → occurrence → notification
-- Deletar o bill → confirmar que occurrence e notification são removidos

-- 4. EXPLAIN das queries críticas
EXPLAIN SELECT * FROM notifications
  WHERE scheduled_for = CURDATE() AND status = 'scheduled';
-- Deve usar idx_notif_scheduled_status

EXPLAIN UPDATE bill_occurrences
  SET status = 'overdue'
  WHERE status = 'pending' AND due_date < CURDATE();
-- Deve usar idx_occ_status_due
```
