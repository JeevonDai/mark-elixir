import 'mind-elixir/style.css';
import 'katex/dist/katex.min.css';

import MindElixir from 'mind-elixir';
import type {
  MindElixirData,
  MindElixirInstance,
  NodeObj,
  Options,
} from 'mind-elixir';
import * as mindElixirI18n from 'mind-elixir/i18n';
import { downloadImage } from '@mind-elixir/export-mindmap';
import katex from 'katex';
import 'katex/contrib/mhchem';


interface InjectedData {
  nodeData: NodeObj;
  isPlaintext?: boolean;
  locale?: string;
}

interface SourceMappedNode extends NodeObj {
  sourceRange?: {
    start: number;
    end: number;
  };
  editableRange?: {
    start: number;
    end: number;
  };
}

interface Window {
  injectedData: InjectedData;
  acquireVsCodeApi(): {
    postMessage: (message: any) => void;
  };
}
declare const window: Window & typeof globalThis;

const vsc = window.acquireVsCodeApi && window.acquireVsCodeApi();

// ─── KaTeX Math Rendering ────────────────────────────────────────────────────
function renderMath(text: string): string {
  let parsedText = text;
  // Handle display math ($$...$$)
  parsedText = parsedText.replace(/\$\$([^$]+)\$\$/g, (_, math: string) => {
    return katex.renderToString(math.trim(), {
      displayMode: true,
      output: 'html',
      throwOnError: false,
    });
  });
  // Handle inline math ($...$)
  parsedText = parsedText.replace(/\$([^$]+)\$/g, (_, math: string) => {
    return katex.renderToString(math.trim(), {
      displayMode: false,
      output: 'html',
      throwOnError: false,
    });
  });
  return parsedText;
}

// ─── Locale Resolution ───────────────────────────────────────────────────────
function resolveLocale(locale?: string): mindElixirI18n.LangPack {
  if (!locale) return mindElixirI18n.en;
  if (locale === 'zh_CN') return mindElixirI18n.zh_CN;
  if (locale === 'zh_TW') return mindElixirI18n.zh_TW;
  const key = locale as keyof typeof mindElixirI18n;
  if (key in mindElixirI18n) {
    return (mindElixirI18n as any)[key] as mindElixirI18n.LangPack;
  }
  return mindElixirI18n.en;
}

// ─── Expand / Collapse Helpers ────────────────────────────────────────────────
const setExpandedAll = (data: NodeObj, expanded: boolean) => {
  data.expanded = expanded;
  if (data.children) {
    for (let i = 0; i < data.children.length; i++) {
      setExpandedAll(data.children[i], expanded);
    }
  }
};

// ─── Init ─────────────────────────────────────────────────────────────────────
const injected: InjectedData = window.injectedData;
const isPlaintext = injected.isPlaintext ?? false;
const langPack = resolveLocale(injected.locale);

function isDarkTheme(): boolean {
  return document.body.classList.contains('vscode-dark')
    || document.body.classList.contains('vscode-high-contrast');
}

function getMindTheme() {
  return isDarkTheme() ? MindElixir.DARK_THEME : MindElixir.THEME;
}

const MAX_CODE_WRAP_COLUMNS = 96;

function getCodeWrapColumns(code: HTMLElement): number {
  const style = window.getComputedStyle(code);
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  if (!context) return MAX_CODE_WRAP_COLUMNS;

  context.font = [
    style.fontStyle,
    style.fontWeight,
    style.fontSize,
    style.fontFamily,
  ].join(' ');
  const characterWidth = context.measureText('0').width || 8;
  const horizontalPadding = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight);
  const contentWidth = Math.max(0, code.clientWidth - horizontalPadding);
  return Math.max(16, Math.min(
    MAX_CODE_WRAP_COLUMNS,
    Math.floor(contentWidth / characterWidth)
  ));
}

function wrapCodeBlocks(root: ParentNode = document): void {
  root.querySelectorAll<HTMLElement>('pre code').forEach((code) => {
    if (code.dataset.wrapped === 'true') return;
    code.dataset.wrapped = 'true';

    const walker = document.createTreeWalker(code, NodeFilter.SHOW_TEXT);
    const textNodes: Text[] = [];
    const wrapColumns = getCodeWrapColumns(code);
    let current: Node | null;
    while ((current = walker.nextNode())) textNodes.push(current as Text);

    let column = 0;
    for (const textNode of textNodes) {
      const fragment = document.createDocumentFragment();
      let chunk = '';

      for (const character of textNode.data) {
        if (character === '\n') {
          chunk += character;
          column = 0;
          continue;
        }

        if (column >= wrapColumns) {
          if (chunk) fragment.append(document.createTextNode(chunk));
          chunk = '';
          fragment.append(document.createTextNode('\n'));
          const marker = document.createElement('span');
          marker.className = 'code-wrap-marker';
          marker.setAttribute('aria-hidden', 'true');
          marker.textContent = '↪ ';
          fragment.append(marker);
          // Reserve the visual width occupied by the continuation marker.
          column = 2;
        }

        chunk += character;
        column += character === '\t' ? 4 : 1;
      }

      if (chunk) fragment.append(document.createTextNode(chunk));
      textNode.replaceWith(fragment);
    }
  });
}

function prepareImages(root: ParentNode = document): void {
  root.querySelectorAll<HTMLImageElement>('.map-canvas me-tpc img').forEach((img) => {
    if (img.dataset.mindElixirImage === 'true') return;
    img.dataset.mindElixirImage = 'true';
    img.title = img.alt || 'Click to open image';
    if (!img.complete) {
      img.addEventListener('load', () => mind?.linkDiv(), { once: true });
    }
  });
}

let data: MindElixirData = { nodeData: injected.nodeData };
let mind: MindElixirInstance | null = null;

// Throttle timer for plaintext save
let saveTimer: ReturnType<typeof setTimeout> | null = null;

const options: Options = {
  el: '#map',
  direction: MindElixir.RIGHT,
  draggable: true,
  editable: isPlaintext,
  contextMenu: { locale: langPack },
  toolBar: true,
  keypress: isPlaintext,
  allowUndo: isPlaintext,
  theme: getMindTheme(),
  // Render KaTeX math formulas in node topics
  markdown: (str: string) => renderMath(str),
};

mind = new MindElixir(options);
mind.init(data);
wrapCodeBlocks();
prepareImages();
mind.linkDiv();

let imageOpenTimer: ReturnType<typeof setTimeout> | null = null;
mind.container.addEventListener('click', (event) => {
  const image = (event.target as Element | null)?.closest<HTMLImageElement>('me-tpc img');
  if (!image) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  const topic = image.closest('me-tpc') as any;
  const node = topic?.nodeObj as SourceMappedNode | undefined;
  if (!vsc || !node?.sourceRange) return;
  if (imageOpenTimer) clearTimeout(imageOpenTimer);
  imageOpenTimer = setTimeout(() => {
    vsc.postMessage({
      command: 'openImage',
      start: node.sourceRange!.start,
      end: node.sourceRange!.end,
    });
    imageOpenTimer = null;
  }, 250);
});

// Clicking the file-name root toggles all descendants while keeping the
// first-level Markdown nodes visible.
mind.container.addEventListener('click', (event) => {
  if (!mind) return;
  const target = event.target as Element | null;
  const rootTopic = target?.closest('me-root > me-tpc');
  if (!rootTopic || !mind.container.contains(rootTopic)) return;

  const children = mind.nodeData.children ?? [];
  if (children.length === 0) return;
  const expand = !children.some((child) => child.expanded !== false);
  children.forEach((child) => setExpandedAll(child, expand));
  mind.nodeData.expanded = true;
  mind.refresh();
  wrapCodeBlocks();
  mind.linkDiv();
  mind.toCenter();
});

let resizeTimer: ReturnType<typeof setTimeout> | null = null;
window.addEventListener('resize', () => {
  if (resizeTimer) clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    if (!mind) return;
    // refresh() reconstructs code markup from nodeData, removing the previous
    // width-specific wrap markers before recalculating them for the new width.
    mind.refresh();
    wrapCodeBlocks();
    prepareImages();
    mind.linkDiv();
    resizeTimer = null;
  }, 120);
});

const themeObserver = new MutationObserver(() => {
  mind?.changeTheme(getMindTheme());
});
themeObserver.observe(document.body, {
  attributes: true,
  attributeFilter: ['class'],
});

// In Markdown mode, one click edits supported text nodes in place. A double
// click cancels the pending edit and reveals the node in the source document.
if (!isPlaintext && vsc) {
  let editTimer: ReturnType<typeof setTimeout> | null = null;
  let activeMarkdownEdit: { topic: HTMLElement; originalHtml: string } | null = null;

  const beginMarkdownEdit = (topic: HTMLElement & { text?: HTMLElement }) => {
    if (!mind) return;
    const renderedContent = topic.querySelector<HTMLElement>(
      'h1, h2, h3, h4, h5, h6, blockquote p, blockquote, p'
    ) ?? topic;
    const renderedStyle = window.getComputedStyle(renderedContent);
    const horizontalPadding = parseFloat(renderedStyle.paddingLeft)
      + parseFloat(renderedStyle.paddingRight);
    const verticalPadding = parseFloat(renderedStyle.paddingTop)
      + parseFloat(renderedStyle.paddingBottom);
    const contentWidth = Math.max(1, renderedContent.clientWidth - horizontalPadding);
    const contentHeight = Math.max(1, renderedContent.clientHeight - verticalPadding);
    activeMarkdownEdit = { topic, originalHtml: topic.innerHTML };

    // Markdown nodes are rendered from HTML and do not expose Mind Elixir's
    // normal text element. Use the topic itself, then normalize the generated
    // editor to the exact rendered box to avoid layout/size jumps.
    topic.text = topic;
    mind.editTopic(topic as any);
    const input = mind.nodes.querySelector<HTMLElement>('#input-box');
    if (!input) return;
    // Match the rendered content box rather than its outer box. This avoids a
    // few pixels of padding/border drift that can wrap one extra character.
    input.style.boxSizing = 'content-box';
    input.style.width = `${contentWidth}px`;
    input.style.minWidth = `${contentWidth}px`;
    input.style.minHeight = `${contentHeight}px`;
    input.style.fontFamily = renderedStyle.fontFamily;
    input.style.fontSize = renderedStyle.fontSize;
    input.style.fontWeight = renderedStyle.fontWeight;
    input.style.fontStyle = renderedStyle.fontStyle;
    input.style.lineHeight = renderedStyle.lineHeight;
    input.style.letterSpacing = renderedStyle.letterSpacing;
    input.style.wordSpacing = renderedStyle.wordSpacing;
    input.style.textIndent = renderedStyle.textIndent;
    input.style.tabSize = renderedStyle.tabSize;
    input.style.padding = renderedStyle.padding;
    input.style.border = renderedStyle.border;
    input.style.borderRadius = renderedStyle.borderRadius;
    input.style.backgroundColor = renderedStyle.backgroundColor;
    input.style.whiteSpace = 'pre-wrap';
    input.style.overflowWrap = 'anywhere';
  };

  const restoreRenderedShape = (text: string) => {
    if (!activeMarkdownEdit) return;
    const { topic, originalHtml } = activeMarkdownEdit;
    const template = document.createElement('template');
    template.innerHTML = originalHtml;
    const content = template.content.querySelector<HTMLElement>(
      'h1, h2, h3, h4, h5, h6, blockquote p, blockquote, p'
    );
    if (content) {
      content.textContent = text;
      topic.replaceChildren(template.content.cloneNode(true));
    }
    activeMarkdownEdit = null;
  };

  mind.container.addEventListener('click', (event) => {
    if ((event.target as Element | null)?.closest('img')) return;
    const topic = (event.target as Element | null)?.closest('me-tpc') as any;
    const node = topic?.nodeObj as SourceMappedNode | undefined;
    if (!mind || !topic || !node?.editableRange || topic.closest('me-root')) return;

    if (editTimer) clearTimeout(editTimer);
    editTimer = setTimeout(() => {
      beginMarkdownEdit(topic);
      editTimer = null;
    }, 250);
  });

  mind.container.addEventListener('dblclick', (event) => {
    if (imageOpenTimer) {
      clearTimeout(imageOpenTimer);
      imageOpenTimer = null;
    }
    if (editTimer) {
      clearTimeout(editTimer);
      editTimer = null;
    }
    const topic = (event.target as Element | null)?.closest('me-tpc') as any;
    const node = topic?.nodeObj as SourceMappedNode | undefined;
    if (!node?.sourceRange || topic.closest('me-root')) return;
    vsc.postMessage({
      command: 'revealSource',
      start: node.sourceRange.start,
      end: node.sourceRange.end,
    });
  });

  mind.bus.addListener('operation', (operation: any) => {
    if (operation?.name !== 'finishEdit') return;
    const node = operation.obj as SourceMappedNode | undefined;
    if (!node?.editableRange) return;
    restoreRenderedShape(node.topic);
    vsc.postMessage({
      command: 'editSource',
      start: node.editableRange.start,
      end: node.editableRange.end,
      text: node.topic,
    });
  });
}

// ─── Plaintext Bidirectional Editing ─────────────────────────────────────────
if (isPlaintext && vsc) {
  // Listen to mind map operations and throttle save messages back to extension
  mind.bus.addListener('operation', () => {
    if (saveTimer) return;
    saveTimer = setTimeout(() => {
      if (mind) {
        vsc.postMessage({
          command: 'save',
          data: mind.getData(),
        });
      }
      saveTimer = null;
    }, 1000);
  });

  // Also throttle arrow movement saves
  mind.bus.addListener('updateArrowDelta', () => {
    if (saveTimer) return;
    saveTimer = setTimeout(() => {
      if (mind) {
        vsc.postMessage({
          command: 'save',
          data: mind.getData(),
        });
      }
      saveTimer = null;
    }, 2000);
  });
}

// ─── Toolbar Buttons ──────────────────────────────────────────────────────────
const toolBar = document.querySelector('.mind-elixir-toolbar.rb');

// Expand All button
const expandAllBtn = document.createElement('span');
expandAllBtn.title = 'Expand All';
expandAllBtn.innerHTML = '<svg t="1739342378874" class="icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="1617" width="1em" height="1em" fill="currentColor" style="vertical-align: middle;"><path d="M768 342.016H341.984v426.016H255.968V342.016q0-36 24.992-60.992t60.992-24.992h426.016v86.016z m-169.984-256H170.016q-34.016 0-59.008 24.992t-24.992 59.008v428h84V170.016h428V86.016zM938.016 512v342.016q0 34.016-24.992 59.008t-59.008 24.992H512q-36 0-60.992-24.992t-24.992-59.008V512q0-36 24.992-60.992T512 426.016h342.016q34.016 0 59.008 24.992T938.016 512z m-84 128h-128v-128H640v128h-128v86.016h128v128h86.016v-128h128V640z" p-id="1618"></path></svg>';

// Collapse All button
const collapseAllBtn = document.createElement('span');
collapseAllBtn.title = 'Collapse All';
collapseAllBtn.innerHTML = '<svg t="1739342411256" class="icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="2596" width="1em" height="1em" fill="currentColor" style="vertical-align: middle;"><path d="M597.333333 170.666667H170.666667v426.666666H85.333333V170.666667a85.333333 85.333333 0 0 1 85.333334-85.333334h426.666666v85.333334m170.666667 85.333333H341.333333a85.333333 85.333333 0 0 0-85.333333 85.333333v426.666667h85.333333V341.333333h426.666667V256m170.666667 256v341.333333a85.333333 85.333333 0 0 1-85.333334 85.333334h-341.333333a85.333333 85.333333 0 0 1-85.333333-85.333334v-341.333333a85.333333 85.333333 0 0 1 85.333333-85.333333h341.333333a85.333333 85.333333 0 0 1 85.333334 85.333333m-85.333334 128h-341.333333v85.333333h341.333333v-85.333333z" p-id="2597"></path></svg>';

expandAllBtn.addEventListener('click', () => {
  if (mind) {
    setExpandedAll(mind.nodeData, true);
    mind.refresh();
    mind.bus.fire('operation', { name: 'expandAll' as any, obj: mind.nodeData });
  }
});
collapseAllBtn.addEventListener('click', () => {
  if (mind) {
    setExpandedAll(mind.nodeData, false);
    mind.refresh();
    mind.bus.fire('operation', { name: 'collapseAll' as any, obj: mind.nodeData });
  }
});

toolBar?.appendChild(expandAllBtn);
toolBar?.appendChild(collapseAllBtn);

// Export as PNG button (replaces old HTML-only download)
const exportPngBtn = document.createElement('span');
exportPngBtn.title = 'Export as PNG';
exportPngBtn.innerHTML = '<svg t="1739342547294" class="icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="3585" width="1em" height="1em" fill="currentColor" style="vertical-align: middle;"><path d="M731.428571 341.333333h73.142858a73.142857 73.142857 0 0 1 73.142857 73.142857v414.476191a73.142857 73.142857 0 0 1-73.142857 73.142857H219.428571a73.142857 73.142857 0 0 1-73.142857-73.142857V414.47619a73.142857 73.142857 0 0 1 73.142857-73.142857h73.142858v73.142857H219.428571v414.476191h585.142858V414.47619h-73.142858v-73.142857z m-176.90819-242.590476l0.048762 397.092572 84.577524-84.601905 51.687619 51.712-172.373334 172.397714-172.397714-172.373333 51.712-51.736381 83.626667 83.626666V98.742857h73.142857z" p-id="3586"></path></svg>';
exportPngBtn.addEventListener('click', () => {
  if (mind) {
    void downloadImage(mind, 'png');
  }
});
toolBar?.appendChild(exportPngBtn);

// HTML download button (legacy, only shown when vsc API is available)
if (vsc) {
  const downloadHtmlBtn = document.createElement('span');
  downloadHtmlBtn.title = 'Download HTML';
  // Use a code/html icon or a download icon instead of the confusing plus icon
  downloadHtmlBtn.innerHTML = '<svg class="icon" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" fill="currentColor" style="vertical-align: middle;"><path d="M512 0C229.232 0 0 229.232 0 512s229.232 512 512 512 512-229.232 512-512S794.768 0 512 0zm0 822.422L219.422 529.844h164.578V292.578h256v237.266h164.578L512 822.422z"/></svg>';
  downloadHtmlBtn.addEventListener('click', () => {
    vsc.postMessage({ command: 'download' });
  });
  toolBar?.appendChild(downloadHtmlBtn);
}

// Listen for updates from the extension
window.addEventListener('message', event => {
  const message = event.data;
  switch (message.command) {
    case 'updateData':
      if (mind) {
        mind.nodeData = message.data;
        mind.refresh();
        wrapCodeBlocks();
        prepareImages();
        mind.linkDiv();
      }
      break;
  }
});
