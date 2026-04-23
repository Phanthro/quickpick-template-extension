# Ação Rápida Templates

Extensão para Cursor / VS Code que aplica templates `.md` ao trecho de código selecionado e copia o resultado para a área de transferência.

## Fluxo

1. Selecione um trecho de código no editor.
2. Clique com o botão direito e abra o submenu **Ação Rápida**.
3. Escolha:
   - **O que faz esse trecho no contexto?** — template fixo `templates/trecho-no-contexto.md`.
   - **Sugestão de melhoria** — template fixo `templates/sugestao-melhoria.md`.
   - **Template da pasta configurada…** — lista os `.md` da pasta em `acaoRapida.templatesPath` (ou `templates/` da extensão). Os dois ficheiros fixos acima **não** aparecem na lista quando apontam para a mesma cópia na extensão (evita duplicar).
4. O texto final substitui `{{CODE}}` pelo código selecionado e fica na área de transferência.

## Configurar caminho dos templates

`Settings` → pesquise por **Ação Rápida Templates: Templates Path**  
Chave: `acaoRapida.templatesPath`

- **Absoluto** — usa essa pasta.
- **Relativo** — relativo à raiz do workspace aberto.
- **Vazio** — usa `templates/` dentro da extensão instalada.

A lista no seletor atualiza quando ficheiros `.md` mudam na pasta vigiada; o botão **Recarregar** força nova leitura.

## Placeholder nos `.md`

```md
Explique o código abaixo:

{{CODE}}
```

## Desenvolvimento

```bash
npm install
npm run compile
```

Pressione `F5` para testar a extensão.
