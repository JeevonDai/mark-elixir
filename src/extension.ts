import * as vscode from 'vscode';
import { markdownToMindElixir } from './core';

export function activate(context: vscode.ExtensionContext) {
  const md = vscode.commands.registerCommand(
    'mind-elixir.markdown',
    markdownToMindElixir(context)
  ); 
  context.subscriptions.push(md);

  return {
    extendMarkdownIt(md: any) {
      const temp = md.renderer.rules.fence!;
      md.renderer.rules.fence = (tokens: any[], idx: number, options: any, env: any, slf: any) => {
        const token = tokens[idx];
        const info = token.info ? token.info.trim() : '';
        if (info === 'mindelixir') {
          const content = encodeURIComponent(token.content);
          return `<div class="mindelixir-codeblock-container mindelixir-codeblock" data-content="${content}"></div>`;
        }
        return temp(tokens, idx, options, env, slf);
      };
      return md;
    }
  };
}

// This method is called when your extension is deactivated
export function deactivate() {}
