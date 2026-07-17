# Pomodoro

Timer Pomodoro minimalista com lista de tarefas, tempo registrado por tarefa,
descanso curto/longo automático e sequência de dias. Feito em HTML, CSS e
JavaScript puros — sem build, sem dependências.

## Rodar localmente

Basta abrir o `index.html` no navegador. Não precisa de servidor nem de
instalação.

## Subir no GitHub

```bash
cd pomodoro-web
git init
git add .
git commit -m "Primeira versão do Pomodoro"
git branch -M main
git remote add origin https://github.com/SEU-USUARIO/pomodoro.git
git push -u origin main
```

Troque `SEU-USUARIO` pelo seu usuário do GitHub. Se o repositório ainda não
existe, crie-o antes em github.com (botão "New repository"), sem marcar a
opção de README, já que este projeto já vem com um.

## Colocar no ar com GitHub Pages

1. No repositório, vá em **Settings → Pages**
2. Em "Build and deployment", escolha **Deploy from a branch**
3. Selecione a branch `main` e a pasta `/ (root)`
4. Salve. Em alguns minutos o site fica disponível em
   `https://SEU-USUARIO.github.io/pomodoro/`

## Como funciona

- 25 min de foco por tarefa selecionada
- a cada foco concluído, o tempo trabalhado é somado ao total daquela tarefa
- pausa de 10 min, e a cada 4 pomodoros uma pausa de 20 min
- os dados (tarefas, tempo e sequência de dias) ficam salvos no navegador via
  `localStorage` — não saem da sua máquina, não tem conta nem servidor
