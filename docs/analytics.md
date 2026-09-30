# Metricas: HiveMQ como fila e SQLite local como historico

## Fluxo

Site -> API do site -> HiveMQ -> coletor local -> SQLite.

Nao ha banco Azure. O backend Azure Functions continua necessario para receber o IP pelo servidor e manter a senha MQTT fora dos arquivos publicos do site. Ele publica com TLS, QoS 1 e retain=false; resposta 202 significa que o broker confirmou a publicacao, nao que os dados ja chegaram ao seu PC. Nao exige Azure Storage.

## Preparacao da fila

1. Crie a credencial do backend com a permissao existente `study-guide-publish`: Publish Only em `study-guide/engagement/v1`.
2. Crie uma permissao `study-guide-read`: Subscribe Only nesse mesmo topico; associe uma credencial exclusiva do coletor.
3. Preencha a credencial de leitura em `.env` local, usando `.env.example`. O repositorio e publico; `.env` e `.analytics` estao ignorados pelo Git.
4. Execute o coletor ao menos uma vez e aguarde **Subscription confirmed**. A partir dessa assinatura o broker pode enfileirar publicacoes para o coletor offline.
5. Ative a publicacao do site somente depois desse passo. Publicacoes anteriores a assinatura nao sao recuperadas.

O client ID deve permanecer `study-guide-fetcher`, com MQTT 5, clean_start=false e SessionExpiryInterval maior que zero. O script solicita 7 dias de validade da sessao offline por padrao (`HIVEMQ_SESSION_EXPIRY=604800`); o broker pode impor um prazo menor. Esse valor solicitado nao comprova o limite do plano Serverless. Apenas uma instancia do coletor deve usar esse client ID.

## Usar localmente

```powershell
python -m pip install -r scripts/requirements-analytics.txt
python scripts/fetch-analytics.py collect --drain
python scripts/fetch-analytics.py report --days 30
```

`--drain` recebe mensagens, grava no SQLite e encerra apos 5 segundos sem novas mensagens; use `--idle-seconds 15` para esperar mais. O silencio indica ausencia de entregas naquele intervalo, nao uma consulta administrativa que comprova fila vazia. Novos eventos podem chegar depois. A sessao e a assinatura permanecem no broker.

Para acompanhar continuamente: `python scripts/fetch-analytics.py collect`. Ctrl+C encerra preservando a sessao. Uma interrupcao de rede encerra com erro; execute novamente para retomar usando o mesmo client ID.

O banco fica em `.analytics/engagement.sqlite`. A confirmacao MQTT (PUBACK) so ocorre depois do commit SQLite. Mensagens repetidas sao ignoradas pelo ID e confirmadas novamente. Se a gravacao ou validacao falhar, o coletor encerra sem confirmar a mensagem; o broker pode entrega-la novamente. O script nao apaga a sessao, nao remove a assinatura e nao limpa mensagens de outros dispositivos.

O relatorio agrega visitas, sessoes de abas, tempo ativo, uso dos graficos e resolucoes abertas, navegador/OS/idioma. IPs ficam no banco privado e nao aparecem no resumo. Faca backup do SQLite regularmente, preferindo copiar o banco com o coletor parado.

## Limites

A fila MQTT e temporaria e limitada. Expiracao da sessao, limite de mensagens, regras do plano ou exclusao do cliente podem fazer perder eventos ainda nao baixados. Mensagens nao sao guardadas para um consumidor que nunca assinou o topico. Nao use mensagens retidas como arquivo de eventos: um topico retido guarda apenas o ultimo valor. Rode o coletor regularmente. Os limites reais do seu cluster e a entrega offline ainda precisam ser verificados com as credenciais configuradas.

## Configuracao do backend Azure

Nas Application settings da Static Web App:

| Variavel | Valor |
| --- | --- |
| ANALYTICS_ENABLED | true apenas depois de preparar a sessao do coletor |
| ANALYTICS_ALLOWED_ORIGIN | https://happy-island-093600f10.1.azurestaticapps.net |
| HIVEMQ_HOST | 20679a5c225144c6a085bb5e03830559.s1.eu.hivemq.cloud |
| HIVEMQ_USERNAME | credencial de publicacao exclusiva do backend |
| HIVEMQ_PASSWORD | senha dessa credencial |
| ANALYTICS_TRUSTED_IP_HEADER | vazio ate validar que o proxy substitui o header; opcoes client-ip, x-client-ip, x-azure-clientip |

O IP nao e registrado ate comprovar um header confiavel em producao, incluindo tentativa de falsifica-lo. Nao usamos IP escolhido no navegador ou o primeiro X-Forwarded-For sem validar a cadeia de proxies. Origem e consentimento nao autenticam clientes da API: monitore volume para detectar eventos artificiais.

## Coleta e consentimento

Registra data UTC do servidor, ID aleatorio por sessao da aba, pagina/materia, familia do navegador, OS aproximado, classe de dispositivo, idioma/viewport, eventos dos graficos e tempo ativo. Abas pre-carregadas nao contam como visitas; animacoes nao enviam por frame. Nao envia nomes, buscas, respostas ou valores digitados. DNT/GPC e recusa desativam a coleta. Privacidade revoga o envio futuro e limpa lotes pendentes; dados ja enviados continuam na fila ou no SQLite.

## Validar

- `node --test tests/*.test.cjs`
- `python -m unittest discover -s tests -p test_analytics_fetcher.py`
- `python scripts/build-topic-pages.py --check`
- Teste real: registrar a assinatura, parar o coletor, gerar eventos no site, executar `collect --drain` e conferir o SQLite. Executar novamente deve retomar a sessao e nao duplicar visitas. Ainda depende das credenciais.

Documentacao: [fila e expiracao HiveMQ](https://docs.hivemq.com/hivemq/latest/user-guide/configuration.html), [confirmacao manual Paho](https://eclipse.dev/paho/files/paho.mqtt.python/html/client.html), [segredos no backend Azure](https://learn.microsoft.com/en-us/azure/static-web-apps/application-settings).
