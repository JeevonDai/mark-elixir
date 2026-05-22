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
  theme: MindElixir.DARK_THEME,
  // Render KaTeX math formulas in node topics
  markdown: (str: string) => renderMath(str),
};

mind = new MindElixir(options);
mind.init(data);

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
      }
      break;
  }
});
