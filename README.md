# POMODO — Timer Pomodoro para Chrome

Extensão MV3 com timer Pomodoro completo (Foco / Descanso Curto / Descanso Longo),
tema escuro pixel-art, logo própria e visual herdado do mesmo design system
enviado como referência (fundo preto, cartões com sombra "sticker" offset).

## Fonte e ícone

- **Fonte:** [Monocraft](https://github.com/IdreesInc/Monocraft), uma fonte
  pixelada no estilo do Minecraft, licenciada em **SIL OFL 1.1** — pode ser
  redistribuída livremente, por isso vem embutida em `fonts/Monocraft.woff2`
  (licença completa em `fonts/Monocraft-OFL-LICENSE.txt`). Usada em todo o
  popup: títulos, corpo de texto e números, como pedido.
- **VCR OSD Mono** fica como segunda opção na pilha de fontes (`--font-pixel`)
  *se* estiver instalada no seu sistema — mas ela não foi incluída no pacote,
  porque sua licença é freeware apenas para uso pessoal e não deixa claro que
  pode ser redistribuída dentro de um produto. Se você tiver os direitos de
  redistribuir o arquivo `.ttf`/`.woff2` dela, é só soltar em `fonts/` e trocar
  a ordem em `--font-pixel` no `popup.css`.
- **Ícone:** gerado a partir da logo que você enviou (tomatinho + cronômetro),
  com o fundo branco removido para ficar transparente, nos tamanhos 16/32/48/128px.

## Como instalar (modo desenvolvedor)

1. Abra `chrome://extensions` no Chrome.
2. Ative o **Modo do desenvolvedor** (canto superior direito).
3. Clique em **Carregar sem compactação** e selecione a pasta `pomofoco/`.
4. Fixe o ícone na barra de ferramentas para acesso rápido.

## Funcionalidades

- Três fases do método Pomodoro, com transição automática seguindo a lógica
  tradicional (foco → curto → foco → ... → longo a cada N sessões).
- Timer com anel de progresso e badge no ícone da extensão mostrando os
  minutos restantes, mesmo com o popup fechado (o `background.js` mantém o
  tempo real via `chrome.alarms`).
- Controles: Iniciar/Pausar, Reiniciar, Pular ciclo.
- Clique em qualquer cartão de ciclo para trocar de fase manualmente.
- Configurações: duração de cada fase (o Descanso Longo é configurável, como
  pedido), quantas sessões até o descanso longo, encadeamento automático do
  próximo ciclo e notificações do sistema.
- Atalhos de teclado: `Ctrl+Shift+P` (iniciar/pausar) e `Ctrl+Shift+K` (pular
  ciclo) — configuráveis em `chrome://extensions/shortcuts`.
- Tema escuro por padrão, com alternância para claro/automático.
- O "O" de POM**O**DO no cabeçalho é o selo vivo do app: fica vermelho e vira
  um círculo pulsante enquanto o timer está rodando.
- **Janela flutuante destacável**: o botão ⬈ no cabeçalho abre uma mini
  janela independente (relógio + fase + play/pausa), sempre por cima, que
  fica sincronizada em tempo real com o popup principal e o `background.js`.
  Clicar de novo foca a mesma janela em vez de abrir outra.

## Estrutura

```
pomofoco/
├── manifest.json
├── common.js       # modelo de estado compartilhado (fases, durações, cálculo de tempo)
├── background.js   # service worker: alarms, badge, notificações, controle da mini janela
├── popup.html
├── popup.css
├── popup.js
├── mini.html        # janela flutuante destacável
├── mini.css
├── mini.js
├── fonts/
│   ├── Monocraft.woff2
│   └── Monocraft-OFL-LICENSE.txt
└── icons/
```

## Próximos passos sugeridos

- Adicionar som de notificação (arquivo de áudio) tocado dentro do popup
  quando `soundEnabled` estiver ativo — hoje o campo existe no modelo mas o
  som ainda não está implementado.
- Histórico de sessões concluídas (ex.: gráfico de pomodoros por dia).

