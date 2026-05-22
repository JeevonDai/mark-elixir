import * as vscode from 'vscode';
import * as path from 'path';
import remarkParse from 'remark-parse';
import remarkFrontmatter from 'remark-frontmatter';
import remarkGfm from 'remark-gfm';
import remarkRehype from 'remark-rehype';
import rehypeHighlight from 'rehype-highlight';
import rehypeStringify from 'rehype-stringify';
import { unified } from 'unified';
import { MindElixirPanel } from './panel';
import type { Heading, List, Paragraph, RootContent, Yaml } from 'mdast';
import type { Root } from 'hast';
import { NodeObj } from 'mind-elixir';
import { plaintextToMindElixir, mindElixirToPlaintext } from 'mind-elixir/plaintextConverter';
import type { Plugin } from 'unified';
import { visit } from 'unist-util-visit';

interface TreeItem {
  children: TreeItem[];
  object: any;
  parent: TreeItem | null;
  type: string;
}

function generateId(): string {
  return Math.random().toString(36).substring(2, 11);
}

function extractText(node: any): string {
  if (!node) return '';
  if (typeof node.value === 'string') return node.value;
  if (node.children) {
    return node.children.map(extractText).join('');
  }
  return '';
}

const parseFrontmatter = (frontmatter: string) => {
  const data = frontmatter
    .split('\n')
    .map((line) => line.split(':').map((item) => item.trim()));
  return Object.fromEntries(data);
};

const markdownAstToTree = (ast: any): TreeItem => {
  const children = ast.children || ast;
  const treeItem: TreeItem = {
    type: 'root',
    children: [],
    object: ast,
    parent: null,
  };

  let current = treeItem;
  for (let i = 0; i < children.length; i++) {
    const child = children[i];
    if (!child) continue;
    if (child.type === 'yaml' || child.type === 'thematicBreak') {
      continue;
    }
    if (child.type === 'heading') {
      const heading = child as Heading;
      const data: TreeItem = {
        type: heading.type,
        object: heading,
        parent: current,
        children: [],
      };

      if (heading.depth > (current.object.depth || 0)) {
        current.children.push(data);
        current = data;
      } else {
        while (
          heading.depth <= (current.object.depth || 0) &&
          current.parent
        ) {
          current = current.parent;
        }
        current.children.push(data);
        current = data;
      }
    } else {
      const data: TreeItem = {
        type: child.type,
        object: child,
        parent: current,
        children: [],
      };
      current.children.push(data);
    }
  }

  return treeItem;
};

const addWidthAndHeight: Plugin<[], Root> = () =>
  function transformer(tree) {
    visit(tree, 'element', function visitor(node) {
      if (node.tagName === 'img') {
        node.properties.width = 200;
        node.properties.height = 100;
      }
    });
  };

const htmlProcessor = unified()
  .use(remarkRehype)
  .use(rehypeHighlight)
  .use(addWidthAndHeight)
  .use(rehypeStringify);

const processList = (list: List): NodeObj[] => {
  return list.children.map((listItem) => {
    const result: NodeObj = {
      topic: '',
      id: generateId(),
      children: [],
    };

    const contentNode = listItem.children[0];
    const nestedList = listItem.children[1];

    if (contentNode) {
      try {
        const hastNode = htmlProcessor.runSync(contentNode as any);
        const htmlStr = htmlProcessor.stringify(hastNode);
        if (typeof htmlStr === 'string') {
          result.dangerouslySetInnerHTML = htmlStr;
        }
      } catch (e) {
        console.error('HTML conversion error', e);
      }
    }

    if (nestedList && nestedList.type === 'list') {
      result.children = processList(nestedList);
    }

    return result;
  });
};

const treeToMindElixir = (items: TreeItem[]): NodeObj[] => {
  const nodes: NodeObj[] = [];
  if (items.length === 1 && items[0].type === 'list') {
    return processList(items[0].object as List);
  }
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const node = {} as NodeObj;
    nodes.push(node);
    if (item.type === 'list') {
      node.children = processList(item.object as List);
      node.topic = 'List';
      continue;
    } else {
      if (item.type === 'html') {
        node.dangerouslySetInnerHTML = (item.object as any).value;
      } else {
        try {
          const hastNode = htmlProcessor.runSync(item.object as any);
          const htmlStr = htmlProcessor.stringify(hastNode);
          if (typeof htmlStr === 'string') {
            node.dangerouslySetInnerHTML = htmlStr;
          }
        } catch (e) {
          console.error('HTML conversion error', e);
        }
      }
    }

    // Generate ID
    node.id = item.object.position?.start?.offset?.toString() || generateId();

    // KEY FEATURE: Merge following lists into preceding content
    const next = items[i + 1];
    if (next && next.type === 'list') {
      node.children = processList(next.object as List);
      items.splice(i + 1, 1);
    } else {
      node.children = treeToMindElixir(item.children);
    }
  }
  return nodes;
};

/**
 * Get mind-elixir locale from VS Code language setting.
 * Maps VS Code language IDs to mind-elixir locale strings.
 */
function getMindElixirLocale(): string {
  const lang = vscode.env.language; // e.g. 'zh-cn', 'en', 'ja'
  if (lang.startsWith('zh-tw') || lang.startsWith('zh-hant')) return 'zh_TW';
  if (lang.startsWith('zh')) return 'zh_CN';
  if (lang.startsWith('ja')) return 'ja';
  if (lang.startsWith('pt')) return 'pt';
  if (lang.startsWith('ru')) return 'ru';
  if (lang.startsWith('de')) return 'de';
  if (lang.startsWith('fr')) return 'fr';
  if (lang.startsWith('es')) return 'es';
  if (lang.startsWith('it')) return 'it';
  if (lang.startsWith('ko')) return 'ko';
  return 'en';
}

export const markdownToMindElixir = (context: vscode.ExtensionContext) => {
  return async () => {
    const editor = vscode.window.activeTextEditor;

    if (!editor) {
      vscode.window.showInformationMessage('No active editor');
      return;
    }
    const document = editor.document;
    const documentContent = document.getText();
    const locale = getMindElixirLocale();

    // Detect Mind Elixir Plaintext format (starts with "- ")
    const isPlaintext = documentContent.trimStart().startsWith('- ');

    let data: NodeObj;
    let title = path.basename(document.fileName, path.extname(document.fileName));

    if (isPlaintext) {
      // Use plaintextToMindElixir converter for Plaintext format
      const mindElixirData = plaintextToMindElixir(documentContent, title);
      data = mindElixirData.nodeData;
    } else {
      // Parse as Markdown
      const ast = unified()
        .use(remarkParse)
        .use(remarkFrontmatter)
        .use(remarkGfm)
        .parse(documentContent);

      const frontmatter = ast.children.find((child) => child.type === 'yaml');

      // Get configuration value
      const config = vscode.workspace.getConfiguration('mindElixirMarkdown');
      const useH1AsRoot = config.get('h1AsRoot');

      if (frontmatter) {
        const obj = parseFrontmatter((frontmatter as Yaml).value);
        if (obj.title) {
          title = obj.title;
        }
      }

      // Convert ast to hierarchical tree
      const tree = markdownAstToTree(ast);

      let nodes: NodeObj[];
      let rootTopic = title;

      if (useH1AsRoot) {
        const h1Index = tree.children.findIndex(
          (child) => child.type === 'heading' && (child.object as Heading).depth === 1
        );
        if (h1Index !== -1) {
          const h1 = tree.children[h1Index];
          rootTopic = extractText(h1.object);
          nodes = treeToMindElixir(h1.children);
        } else {
          nodes = treeToMindElixir(tree.children);
        }
      } else {
        nodes = treeToMindElixir(tree.children);
      }

      data = {
        topic: rootTopic,
        id: 'root',
        children: nodes,
      };
    }

    const mindElixirPanel = new MindElixirPanel(
      context.extensionUri,
      title + ' - Mark Elixir',
      isPlaintext,
      locale
    );

    await mindElixirPanel.init(data);

    // Handle messages from webview
    mindElixirPanel.panel.webview.onDidReceiveMessage(async (message: any) => {
      switch (message.command) {
        case 'save': {
          // Plaintext bidirectional editing: write mind map data back to file
          if (!isPlaintext) return;
          try {
            const plaintext = mindElixirToPlaintext(message.data);
            const encoder = new TextEncoder();
            await vscode.workspace.fs.writeFile(
              document.uri,
              encoder.encode(plaintext)
            );
          } catch (e) {
            vscode.window.showErrorMessage(`Mark Elixir: failed to save file: ${e}`);
          }
          return;
        }
        default:
          break;
      }
    });

    context.subscriptions.push(mindElixirPanel.panel);
  };
};
