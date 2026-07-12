# Markdown Mindmap

## Features

Check markdown file as a Mind Map. Powered by [Mind Elixir](https://github.com/SSShooter/mind-elixir-core).

## How To Use

Download the extension on [Visual Studio Marketplace](https://marketplace.visualstudio.com/items?itemName=MindElixir.mark-elixir&ssr=false).

Open any Markdown file in VS Code.

Click The Button (Or Use Command: `mind-elixir.markdown`)

![Click The Button](https://github.com/SSShooter/mark-elixir/blob/master/images/how-to-use-1.png?raw=true)

View Markdown As A Mindmap.

![View Markdown As A Mindmap](https://github.com/SSShooter/mark-elixir/blob/master/images/how-to-use-2.png?raw=true)

Foam-style image embeds are supported. When an embed only contains a file name,
such as `![[diagram.png]]`, Mark Elixir searches the workspace for the image.
If more than one image has the same name, the one closest to the Markdown file
is used.

Foam embeds that target Markdown files or extensionless note names, such as
`![[another-note.md]]` and `![[another-note]]`, are rendered as links that open
the matching note instead of broken images.

Selecting a mind-map node also selects and reveals its corresponding source
range in the Markdown editor.

Fenced code blocks are syntax-highlighted according to their language. Their
colors and background follow the active VS Code theme, and long lines wrap with
a `↪` continuation marker instead of showing a horizontal scrollbar. Wrapping
is recalculated when the preview width changes.
Code blocks share the same maximum width as regular node text.

Common fenced-code languages include C/C++ (`c`, `cpp`, `c++`, `cc`), shell
scripts (`bash`, `sh`, `shell`, `zsh`), YAML (`yaml`, `yml`), and JSON
(`json`, `jsonc`).

**Enjoy!**

## Known Issues

[Report issues on GitHub](https://github.com/SSShooter/mark-elixir/issues)

## License

MIT License
