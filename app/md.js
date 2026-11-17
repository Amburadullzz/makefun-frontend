// A small markdown reader for the two prose fields the API sends (description and
// rules): headings, lists, paragraphs, bold, code and links. The text is escaped
// before anything is turned into markup, so a bounty's text can never inject HTML.
//
// mdCapped() is how a 95,000-character rules document costs nothing on first paint:
// it renders the opening and hands back the rest for a click.

import { esc } from './format.js';

function inline(text) {
  return text
    .replace(/`([^`\n]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" rel="noopener noreferrer">$1</a>');
}

/** Markdown in, safe HTML out. */
export function md(source) {
  const lines = esc(source).split('\n');
  const out = [];
  let paragraph = [];
  let list = '';

  const flushParagraph = () => {
    if (!paragraph.length) return;
    out.push(`<p>${inline(paragraph.join(' '))}</p>`);
    paragraph = [];
  };
  const closeList = () => {
    if (!list) return;
    out.push(`</${list}>`);
    list = '';
  };

  for (const raw of lines) {
    const line = raw.replace(/\s+$/, '');
    if (!line.trim()) {
      flushParagraph();
      closeList();
      continue;
    }
    const heading = line.match(/^(#{1,4})\s+(.+)$/);
    if (heading) {
      flushParagraph();
      closeList();
      const level = Math.min(Math.max(heading[1].length, 2), 3);
      out.push(`<h${level}>${inline(heading[2].trim())}</h${level}>`);
      continue;
    }
    const bullet = line.match(/^[-*]\s+(.+)$/);
    const numbered = line.match(/^\d+[.)]\s+(.+)$/);
    if (bullet || numbered) {
      flushParagraph();
      const want = bullet ? 'ul' : 'ol';
      if (list !== want) {
        closeList();
        out.push(`<${want}>`);
        list = want;
      }
      out.push(`<li>${inline((bullet || numbered)[1])}</li>`);
      continue;
    }
    paragraph.push(line.trim());
  }
  flushParagraph();
  closeList();
  return out.join('\n');
}

/**
 * Render the opening of a long document: { html, rest, cut, more }.
 * The cut lands on a paragraph break where it can, so nothing is shown half a sentence in.
 */
export function mdCapped(source, cap = 2400) {
  const text = String(source ?? '');
  if (text.length <= cap) return { html: md(text), rest: '', cut: text.length, more: 0 };
  let cut = text.lastIndexOf('\n\n', cap);
  if (cut < cap * 0.4) cut = text.lastIndexOf('\n', cap);
  if (cut < cap * 0.4) cut = cap;
  return { html: md(text.slice(0, cut)), rest: text.slice(cut), cut, more: text.length - cut };
}
