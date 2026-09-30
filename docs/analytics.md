# Métricas de uso: HiveMQ + histórico privado

## Estado e fluxo

O navegador envia lotes consentidos a `POST /api/analytics`. A API valida os campos, grava em Azure Table Storage e publica com TLS/QoS 1 em `study-guide/engagement/v1`. O HiveMQ Serverless transporta os eventos; o histórico fica na tabela privada, sem depender de um PC ligado. Não se usa mensagem retida como histórico.

A coleta fica desativada até configurar `ANALYTICS_ENABLED=true` e todos os segredos abaixo. Uma resposta 202 confirma gravação e publicação; 503 indica indisponibilidade. Se o broker falhar após gravar, o histórico continua disponível, mas a publicação em tempo real falhou. Não há reenvio automático no navegador.

## Configuração do backend no Azure

Use **Application settings** da Static Web App, nunca variáveis inseridas no HTML/JS:

| Nome | Valor |
| --- | --- |
| `ANALYTICS_ENABLED` | `true`, somente após validação ponta a ponta |
| `ANALYTICS_ALLOWED_ORIGIN` | `https://happy-island-093600f10.1.azurestaticapps.net` |
| `HIVEMQ_HOST` | `20679a5c225144c6a085bb5e03830559.s1.eu.hivemq.cloud` |
| `HIVEMQ_USERNAME` | credencial exclusiva do backend |
| `HIVEMQ_PASSWORD` | senha dessa credencial |
| `ANALYTICS_STORAGE_CONNECTION` | conexão privada de uma conta Azure Storage existente |
| `ANALYTICS_TABLE` | `StudyEvents`, tabela criada previamente |
| `ANALYTICS_TRUSTED_IP_HEADER` | deixar vazio até comprovar que o proxy substitui o header; opções: `client-ip`, `x-client-ip`, `x-azure-clientip` |

Configure a credencial MQTT como **Publish Only**, somente no tópico indicado. Uma ferramenta privada para ler eventos em tempo real deve ter outra credencial **Subscribe Only** nesse tópico. Não reutilize credenciais dos dispositivos existentes. A API Cloud REST de gestão não é usada para publicar.

O IP permanece ausente até verificar o header em produção, inclusive com uma requisição que tente falsificá-lo. O navegador não escolhe o IP registrado. Não use o primeiro endereço de `X-Forwarded-For` sem uma cadeia de proxies comprovada.

## Dados e interpretação

- ID aleatório por sessão da aba, preservado ao navegar entre páginas; não identifica uma pessoa nem calcula visitantes únicos entre dispositivos.
- Data UTC recebida pelo servidor, matéria/página, família do navegador, OS, dispositivo aproximado, idioma e classe de viewport.
- IP se disponível por header confiável. VPN/proxy e User-Agent reduzido podem limitar a precisão.
- Visita à página/aba; tempo ativo apenas com janela visível e focada, até 60 s após interação; controles dos gráficos, abertura de resolução/formulário e marcação de metas.
- Abas pré-carregadas não geram visitas. Animações não enviam eventos por frame.
- Não coleta buscas, valores digitados, respostas, nomes, e-mail, localização precisa ou identificação por fingerprint.

O botão **Privacidade** revoga imediatamente o envio e limpa eventos pendentes; eventos já enviados permanecem no histórico. Recusa, DNT e GPC impedem a coleta. Consentimento e um ID temporário usam armazenamento local; preferências de estudo não são enviadas.

Antes de ativar, defina responsável e prazo do histórico (sugestão operacional: 30 dias), restrinja acesso à conta de armazenamento e configure limpeza automática. A API pública precisa de monitoramento de volume/limites no provedor: origem e consentimento não autenticam clientes nem impedem scripts de fabricar eventos. Não habilite coleta sem definir limites compatíveis com o plano.

## Validação

### Coletor MQTT local (SQLite)

O repositório estava **público** no GitHub ao verificar a configuração. `.env` e a pasta `.analytics` estão ignorados; nunca inclua senhas nos commits ou nos arquivos estáticos do site.

1. No HiveMQ, crie uma permissão `study-guide-read`, tipo **Subscribe Only**, filtro exato `study-guide/engagement/v1`; associe-a a uma credencial exclusiva do coletor. A credencial de publicação da API não serve para assinar.
2. Copie `.env.example` para `.env`, no diretório do repositório; preencha usuário e senha do **coletor** diretamente no arquivo local. Os segredos do **backend** são outros e ficam nas Application settings do Azure.
3. Instale: `python -m pip install -r scripts/requirements-analytics.txt`.
4. Execute: `python scripts/fetch-analytics.py collect`. Aguarde **Subscription confirmed**; mantém coleta até Ctrl+C.
5. Consulte: `python scripts/fetch-analytics.py report --days 30`. O relatório agrega visitas, sessões de abas, tempo ativo, ações nos gráficos e navegador/OS. IPs ficam no SQLite privado e não aparecem no relatório agregado.

O SQLite local é uma cópia dos eventos recebidos: o coletor não baixa automaticamente mensagens antigas já descartadas pelo broker. Usa sessão MQTT persistente e QoS 1; o broker pode manter mensagens durante ausências conforme seus limites e prazo. Para história completa, consulte também a tabela Azure privada pelo relatório do backend. Apenas um coletor deve usar o client ID `study-guide-fetcher` ao mesmo tempo.

Teste offline: `python scripts/fetch-analytics.py import --input lote.json --db .analytics/test.sqlite`. Um evento repetido é ignorado pelo ID, sem contar a visita duas vezes.

Para consultar o engajamento, execute em ambiente privado com a conexão da tabela no ambiente: `node api/tools/report.cjs 30`. O relatório JSON agrega visitas e tempo ativo por página, sessões de abas, ações nos gráficos, resoluções abertas e navegador/OS por visita. Não imprime IPs ou credenciais. Nenhum painel administrativo público é exposto.

1. `node --test tests/*.test.cjs`; `python scripts/build-topic-pages.py --check`.
2. Sem consentir/ao recusar/GPC: nenhum POST de analytics.
3. Consentir, trocar Buck CCM/DCM/Boost e pausar: somente as abas visíveis e ações reais geram eventos.
4. Conferir 202, registros na tabela privada e mensagens no tópico com um assinante autorizado. Verificar IP com e sem falsificação do header.
5. Revogar, trocar aba/recarregar: nenhum novo envio; gráficos mantêm estado.

Documentação: [HiveMQ Cloud](https://docs.hivemq.com/hivemq-cloud/quick-start-guide.html), [Azure API](https://learn.microsoft.com/en-us/azure/static-web-apps/apis-functions), [segredos do backend](https://learn.microsoft.com/en-us/azure/static-web-apps/application-settings).
