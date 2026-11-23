# Chequetto — Modo aberto + conserto do erro

## O que causava o erro
No Render, o chat de visitante só responde se achar uma chave de IA com um destes nomes exatos:
GEMINI_API_KEY, MISTRAL_API_KEY, GROQ_API_KEY, GROK_API_KEY (ou XAI_API_KEY), OPENROUTER_API_KEY
(também vale com sufixo _1, _2... ou _KEYS com várias chaves separadas por vírgula).
Se nenhuma for encontrada, o código tentava a IA interna do Lovable, que NÃO existe no Render, e dava erro 503.
A tela escondia isso com respostas prontas, então parecia que "funcionava" sem IA de verdade.

## Versão 5: terceiro pente fino (16 arquivos)
1. Visitantes duplicados: a pré-carga de rotas chamava a entrada anônima várias vezes ao mesmo tempo e criava vários visitantes. Agora uma única entrada é compartilhada.
2. O modo aberto dava o nome "Visitante" ao usuário, e a IA passava a chamá-lo assim. Agora o nome fica vazio e a Chequetto pergunta como chamar a pessoa.
3. Chat: voltar para a aba no meio de uma resposta apagava a bolha que estava chegando (a lista recarregava sozinha). Corrigido.
4. package.json ganhou o script "start" (node .output/server/index.mjs). No Render: Build Command = npm install && npm run build; Start Command = npm start.
Teste de ponta a ponta: subi o servidor no formato do Render com um provedor simulado. /api/public/health reconheceu a chave e o modelo, e o chat respondeu HTTP 200 com a conversa na ordem certa (system, user, assistant, user) e idade 0.

## Versão 4: segundo pente fino (15 arquivos)
Dois erros novos, ambos no caminho do Render (pool grátis):
A. A memória de longo prazo quase não aprendia: o pool cortava cada pedido em 1200 caracteres, e o resumo de memória é um pedido único e longo, então a IA só via o começo da conversa. Agora pedidos únicos aceitam até 12000 caracteres.
B. A tradução da interface para outros idiomas (francês etc.) saía truncada: limite de 900 tokens e corte de 1200 caracteres. Agora usa 4000 tokens e não corta. Português e espanhol já vêm prontos no código e não eram afetados.
C. Protocolo de crise na personalidade: o texto só dizia "procure ajuda". Agora, ao falar em morrer ou se machucar, a Chequetto desliga o humor e a divulgação, acolhe, pergunta se a pessoa está segura e indica CVV 188 / SAMU 192 / 190 (no Brasil).
Verificado e sem problema: segurança do banco (RLS ligado; chaves e configurações só acessíveis pelo servidor), login de admin, middleware de autenticação e ausência de código perigoso no front.
Testes: 6 passando, tipos sem erro, build do Render ok.

## Versão 3: pente fino (14 arquivos)
Erros reais encontrados e corrigidos:
1. Conversa começando por "assistant": a janela de mensagens podia começar pela resposta da IA, e vários provedores recusam isso (erro 400). Agora sempre começa por "user" (pool e api/chat).
2. Duas mensagens de sistema: o resumo da conversa entrava como segunda mensagem de sistema, que alguns provedores recusam. Agora vira uma só.
3. Resposta vazia no modo multi-modelo: se o modelo de refino falhasse, a resposta chegava em branco. Agora cai para outra chave, depois para o melhor rascunho, e só então para o pool grátis.
4. Tradução da interface (translateUi): dava erro 500 sem a IA interna do Lovable e aceitava qualquer tamanho de texto sem login. Agora nunca estoura e tem limites.
5. Wikipédia e Open Library eram consultadas em quase toda conversa ("meu livro..." disparava busca de livros). Agora só em perguntas de fato.
6. Firecrawl disparava com a palavra "hoje" e gastava a cota grátis. Agora não dispara com "hoje" e tem teto de 30 buscas por dia (FIRECRAWL_DAILY_MAX).
7. Modelo inexistente (400/404) era tentado de novo a cada 15 s; agora espera 5 minutos.
8. Painel admin quebrava se a lista de chaves estivesse vazia (null).
9. Chat mostrava balão em branco quando a IA não respondia; agora mostra um aviso.
Testes: 5 passando (um novo simula o envio ao provedor), tipos sem erro, build do Render e do Cloudflare ok.

## Correção do erro 400 (versão 2)
O erro 400 vinha da tela: ela sempre mandava idade 0 e o servidor só aceitava idade a partir de 5. Esse bug já existia; antes a tela escondia o erro com respostas prontas, e o conserto anterior passou a mostrá-lo. Agora a idade só é enviada quando informada, e o servidor aceita idade 0. Também aumentei o limite do texto de cada mensagem para 6000 caracteres.

## Arquivos do modo aberto (mesmos caminhos do repositório)
1. _authenticated/route.tsx: entra sem cadastro e sem e-mail (sessão anônima) e pula o onboarding.
2. FirstContact.tsx: botão "Entrar sem cadastro" e mostra o erro real do servidor em vez de resposta falsa.
3. api/chat.ts: se o perfil não existir, cria na hora (antes dava "Profile missing").
4. guest-chat.ts: erro com dica clara.
5. provider-pool.server.ts: modelo trocável por variável (GEMINI_MODEL, GROQ_MODEL, MISTRAL_MODEL, GROK_MODEL, OPENROUTER_MODEL) e relatório sem segredos.
6. api/public/health.ts (novo): abra /api/public/health para ver quais IAs foram encontradas (mostra só contagem, nunca a chave).
7. routeTree.gen.ts: gerado automaticamente com a rota nova.
O limite de mensagens do visitante e do teste já estava desligado no seu código.

## Como aplicar
1. Copie os arquivos para o repositório do GitHub, nos mesmos caminhos (substituindo).
2. No Supabase (ou peça ao Lovable): Authentication > Sign In / Providers > ligar "Allow anonymous sign-ins". Sem isso o botão "Entrar sem cadastro" volta para a tela de login.
3. No Render > Environment: confira os NOMES das chaves de IA (lista acima) e SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, SUPABASE_SERVICE_ROLE_KEY. Depois faça o deploy.
4. Abra https://SEU-APP.onrender.com/api/public/health. Em "ia_gratis" deve aparecer algo como ["gemini:1","groq:1"].

## Cuidados
- É modo de TESTE: qualquer pessoa entra e gasta a sua cota gratuita. Antes de divulgar, coloque limite por usuário.
- Para voltar ao login obrigatório: VITE_OPEN_MODE=false.
- O Grok (xAI) não tem cota grátis recorrente; retire essa chave se quiser custo zero.
- Os nomes de modelo (gemini-2.0-flash etc.) podem estar desatualizados; se der erro de modelo, defina GEMINI_MODEL, GROQ_MODEL etc. com o nome atual.
