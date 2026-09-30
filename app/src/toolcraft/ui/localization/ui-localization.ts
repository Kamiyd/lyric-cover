/** Pure translation callback: unknown copy must be returned unchanged. */
export type ToolcraftUiTranslator = (source: string) => string;
const identity: ToolcraftUiTranslator = (text) => text;

const attributes = ["aria-label", "aria-description", "title", "placeholder", "aria-valuetext"];
const excluded = 'script, style, [contenteditable="true"], [translate="no"], [data-toolcraft-product-output]';
type Translation = { source: string; rendered: string };

/**
 * Framework-owned presentation adapter for immutable schema labels. This adapter only
 * edits known UI copy in existing Text nodes / accessibility attributes. It never
 * replaces elements, changes form values, or mutates canonical schema values.
 * Product-owned or user-content subtrees opt out with translate="no".
 * Keep the original per node (not a reverse dictionary) so switching is lossless.
 */
export function createToolcraftUiLocalization(root: HTMLElement) {
  let translate = identity;
  const texts = new WeakMap<Text, Translation>();
  const labels = new WeakMap<Element, Map<string, Translation>>();

  function renderText(node: Text) {
    if (node.parentElement?.closest(`${excluded}, textarea`)) return;
    const prior = texts.get(node);
    const current = node.data;
    const source = prior && current === prior.rendered ? prior.source : current;
    const rendered = translate(source);
    if (source !== rendered || prior) texts.set(node, { source, rendered });
    if (current !== rendered) node.data = rendered;
  }

  function renderAttribute(element: Element, name: string) {
    if (element.closest(excluded)) return;
    const current = element.getAttribute(name);
    if (current === null) { labels.get(element)?.delete(name); return; }
    const records = labels.get(element) ?? new Map<string, Translation>();
    const prior = records.get(name);
    const source = prior && current === prior.rendered ? prior.source : current;
    const rendered = translate(source);
    if (source !== rendered || prior) {
      records.set(name, { source, rendered });
      labels.set(element, records);
    }
    if (current !== rendered) element.setAttribute(name, rendered);
  }

  function visit(node: Node) {
    if (node.nodeType === Node.TEXT_NODE) { renderText(node as Text); return; }
    if (!(node instanceof Element) || node.closest(excluded)) return;
    for (const name of attributes) if (node.hasAttribute(name)) renderAttribute(node, name);
    if (node.tagName !== "TEXTAREA") for (const child of node.childNodes) visit(child);
  }

  const observer = new MutationObserver((records) => {
    for (const record of records) {
      if (record.type === "characterData") renderText(record.target as Text);
      else if (record.type === "attributes" && record.attributeName) {
        renderAttribute(record.target as Element, record.attributeName);
      } else for (const node of record.addedNodes) visit(node);
    }
  });
  observer.observe(root, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: attributes });

  return {
    update(next: ToolcraftUiTranslator) {
      translate = next;
      visit(root);
    },
    dispose() {
      observer.disconnect();
      translate = identity;
      visit(root);
    },
  };
}
