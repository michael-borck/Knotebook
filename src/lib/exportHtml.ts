export interface ExportTheme {
  bg: string
  panel: string
  text: string
  muted: string
  accent: string
  border: string
}

export interface ExportOptions {
  title: string
  json: string
  runtimeSource: string
  theme?: ExportTheme
  cover?: string
  assets?: Record<string, string>
}

const READER_CSS = `
:root {
  color-scheme: light dark;
  --bg: #12131a;
  --panel: #191b24;
  --text: #e8e6ef;
  --muted: #9a97a8;
  --accent: #c084fc;
  --border: #2c2f3d;
}
* { box-sizing: border-box; }
html, body { margin: 0; height: 100%; background: var(--bg); color: var(--text); }
body { font: 17px/1.6 ui-serif, Georgia, 'Times New Roman', serif; display: flex; justify-content: center; }
main { width: min(720px, 100%); padding: 40px 24px 120px; }
h1 { font: 600 20px/1.2 ui-sans-serif, system-ui, sans-serif; letter-spacing: .02em; color: var(--muted); margin: 0 0 24px; }
#cover { width: 100%; max-height: 220px; object-fit: cover; border-radius: 10px; border: 1px solid var(--border); margin: 0 0 20px; }
#scene { width: 100%; max-height: 320px; object-fit: cover; border-radius: 10px; border: 1px solid var(--border); margin: 0 0 18px; }
#cover:not([hidden]), #scene:not([hidden]) { display: block; }
#out p { margin: 0 0 1em; }
#choices { display: flex; flex-direction: column; gap: 8px; margin-top: 20px; }
.choice { text-align: left; padding: 11px 14px; border-radius: 9px; border: 1px solid var(--border); background: var(--panel); color: var(--text); font: inherit; cursor: pointer; }
.choice:hover { border-color: var(--accent); }
.choice .num { color: var(--muted); font: 600 13px ui-sans-serif, system-ui, sans-serif; margin-right: 8px; }
.end { text-align: center; color: var(--muted); font: 600 14px ui-sans-serif, system-ui, sans-serif; letter-spacing: .12em; text-transform: uppercase; padding: 24px 0; }
#bar { position: fixed; right: 16px; bottom: 14px; display: flex; gap: 8px; }
#bar button { padding: 7px 11px; border-radius: 8px; border: 1px solid var(--border); background: var(--panel); color: var(--muted); font: 600 12px ui-sans-serif, system-ui, sans-serif; cursor: pointer; }
#bar button:hover { color: var(--text); border-color: var(--accent); }
@media (prefers-color-scheme: light) {
  :root { --bg: #fbfaf7; --panel: #f2f0ea; --text: #22212a; --muted: #6b6879; --border: #dcd9d2; }
}
`

const READER_JS = `
(function () {
  var story = new inkjs.Story(JSON.parse(STORY_JSON));
  var out = document.getElementById('out');
  var choicesEl = document.getElementById('choices');
  var scene = document.getElementById('scene');
  var cover = document.getElementById('cover');
  var currentImage = null;
  var SAVE_KEY = 'pathwright:' + document.title;

  if (COVER) {
    cover.src = COVER;
    cover.hidden = false;
  }

  function esc(text) {
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function applyTags(tags) {
    if (!tags) return;
    for (var i = 0; i < tags.length; i += 1) {
      var match = /^(?:image|bg):\s*(.+)$/i.exec(String(tags[i]).trim());
      if (!match) continue;
      var key = match[1].trim();
      var src = ASSETS[key] || ASSETS['assets/' + key];
      if (src) {
        currentImage = src;
        scene.src = src;
        scene.hidden = false;
      }
      return;
    }
  }

  function paint(text) {
    var blocks = text.split(/\\n{2,}/);
    var html = '';
    for (var i = 0; i < blocks.length; i += 1) {
      var block = blocks[i].replace(/\\n/g, '<br>');
      if (block.trim()) html += '<p>' + block + '</p>';
    }
    out.insertAdjacentHTML('beforeend', html);
    window.scrollTo(0, document.body.scrollHeight);
  }

  function save() {
    try {
      localStorage.setItem(
        SAVE_KEY,
        JSON.stringify({
          state: story.state.ToJson(),
          html: out.innerHTML,
          image: currentImage,
        }),
      );
    } catch (error) {}
  }

  function renderChoices() {
    choicesEl.innerHTML = '';
    var choices = story.currentChoices;
    if (!choices.length) {
      var end = document.createElement('div');
      end.className = 'end';
      end.textContent = 'The End';
      choicesEl.appendChild(end);
      return;
    }
    choices.forEach(function (choice, index) {
      var button = document.createElement('button');
      button.type = 'button';
      button.className = 'choice';
      button.innerHTML =
        '<span class="num">' + (index + 1) + '</span>' + esc(choice.text);
      button.addEventListener('click', function () {
        story.ChooseChoiceIndex(index);
        turn();
      });
      choicesEl.appendChild(button);
    });
  }

  function turn() {
    var text = '';
    while (story.canContinue) {
      text += story.Continue();
      applyTags(story.currentTags);
    }
    if (text.trim()) paint(text.trim());
    renderChoices();
    save();
  }

  function restore() {
    try {
      var raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return false;
      var saved = JSON.parse(raw);
      story.state.LoadJson(saved.state);
      out.innerHTML = saved.html || '';
      if (saved.image) {
        currentImage = saved.image;
        scene.src = saved.image;
        scene.hidden = false;
      }
      renderChoices();
      return true;
    } catch (error) {
      return false;
    }
  }

  document.getElementById('restart').addEventListener('click', function () {
    localStorage.removeItem(SAVE_KEY);
    story = new inkjs.Story(JSON.parse(STORY_JSON));
    out.innerHTML = '';
    choicesEl.innerHTML = '';
    currentImage = null;
    scene.removeAttribute('src');
    scene.hidden = true;
    window.scrollTo(0, 0);
    turn();
  });

  document.addEventListener('keydown', function (event) {
    if (event.key >= '1' && event.key <= '9') {
      var index = Number(event.key) - 1;
      if (story.currentChoices[index]) {
        story.ChooseChoiceIndex(index);
        turn();
      }
    }
  });

  if (!restore()) turn();
})();
`

export function buildStandaloneHtml({
  title,
  json,
  runtimeSource,
  theme,
  cover,
  assets,
}: ExportOptions): string {
  const safeTitle = escapeHtml(title)
  const storyJson = JSON.stringify(json).replace(/</g, '\\u003c')
  const assetsJson = JSON.stringify(assets ?? {}).replace(/</g, '\\u003c')
  const coverJson = JSON.stringify(cover ?? '')
  const themeCss = theme
    ? `:root{--bg:${theme.bg};--panel:${theme.panel};--text:${theme.text};--muted:${theme.muted};--accent:${theme.accent};--border:${theme.border};}`
    : ''
  const body = [
    '<main>',
    `<h1>${safeTitle}</h1>`,
    '<img id="cover" alt="" hidden />',
    '<img id="scene" alt="" hidden />',
    '<div id="out"></div>',
    '<div id="choices"></div>',
    '</main>',
    '<div id="bar"><button id="restart" type="button">Restart</button></div>',
  ].join('\n')

  return [
    '<!doctype html>',
    '<html lang="en">',
    '<head>',
    '<meta charset="utf-8" />',
    '<meta name="viewport" content="width=device-width, initial-scale=1" />',
    `<title>${safeTitle}</title>`,
    `<style>${READER_CSS}${themeCss}</style>`,
    '</head>',
    '<body>',
    body,
    `<script>${runtimeSource}</script>`,
    `<script>var STORY_JSON=${storyJson};var ASSETS=${assetsJson};var COVER=${coverJson};${READER_JS}</script>`,
    '</body>',
    '</html>',
  ].join('\n')
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
