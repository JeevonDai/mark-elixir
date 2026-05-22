import MindElixir from 'mind-elixir';
import type { Options } from 'mind-elixir';
import { plaintextToMindElixir } from 'mind-elixir/plaintextConverter';
import { downloadImage } from '@mind-elixir/export-mindmap';
import katex from 'katex';

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

// ─── Initialize Mindmaps ──────────────────────────────────────────────────────
function initMindmaps() {
  const blocks = document.querySelectorAll('.mindelixir-codeblock');
  
  blocks.forEach((block) => {
    // Skip if already initialized and its container is intact
    if ((block as any).initialized && block.querySelector('.map-canvas')) {
      return;
    }
    
    const contentAttr = block.getAttribute('data-content');
    if (!contentAttr) return;

    try {
      // Mark as initialized
      (block as any).initialized = true;
      
      // Clear any existing children (e.g. loader/error messages)
      block.innerHTML = '';

      // Create a map sub-container specifically for mind-elixir to render inside
      const mapDiv = document.createElement('div');
      mapDiv.className = 'mindmap-inner-container';
      mapDiv.style.width = '100%';
      mapDiv.style.height = '100%';
      block.appendChild(mapDiv);

      const decodedContent = decodeURIComponent(contentAttr);
      const title = 'Mind Map';
      const mindData = plaintextToMindElixir(decodedContent, title);

      // Detect VSCode theme
      const isDark = document.body.classList.contains('vscode-dark') || 
                     document.body.classList.contains('vscode-high-contrast');

      const options: Options = {
        el: mapDiv,
        direction: MindElixir.RIGHT,
        editable: false,
        contextMenu: false,
        toolBar: false,
        keypress: false,
        theme: isDark ? MindElixir.DARK_THEME : MindElixir.THEME,
        markdown: (str: string) => renderMath(str),
      };

      const mind = new MindElixir(options);
      mind.init(mindData);
      (block as any).mindElixirInstance = mind;

      // Add Export to PNG Button (similar to Obsidian plugin)
      const exportBtn = document.createElement('div');
      exportBtn.className = 'mindelixir-export-btn';
      exportBtn.setAttribute('aria-label', 'Export as image');
      exportBtn.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
          <polyline points="7 10 12 15 17 10"/>
          <line x1="12" x2="12" y1="15" y2="3"/>
        </svg>
      `;
      exportBtn.onclick = (e) => {
        e.stopPropagation();
        void downloadImage(mind, 'png');
      };
      block.appendChild(exportBtn);

    } catch (e) {
      console.error('Failed to initialize mind-elixir block:', e);
      block.innerHTML = `<div class="mindelixir-error">Failed to render mind map: ${e instanceof Error ? e.message : e}</div>`;
    }
  });
}

// ─── Theme Watcher ───────────────────────────────────────────────────────────
const observer = new MutationObserver((mutations) => {
  mutations.forEach((mutation) => {
    if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
      const isDark = document.body.classList.contains('vscode-dark') || 
                     document.body.classList.contains('vscode-high-contrast');
      const theme = isDark ? MindElixir.DARK_THEME : MindElixir.THEME;

      document.querySelectorAll('.mindelixir-codeblock').forEach((el) => {
        const mind = (el as any).mindElixirInstance;
        if (mind) {
          mind.changeTheme(theme);
        }
      });
    }
  });
});
observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });

// ─── Run on Load & on Content Updates ─────────────────────────────────────────
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initMindmaps);
} else {
  initMindmaps();
}

window.addEventListener('vscode.markdown.updateContent', () => {
  initMindmaps();
});
