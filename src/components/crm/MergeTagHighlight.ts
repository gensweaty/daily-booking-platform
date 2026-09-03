import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import { MERGE_TAGS } from "./emailMergeTags";

const KNOWN = new Set(MERGE_TAGS.map((t) => t.token));
const TAG_REGEX = /@[a-zA-Z_]+/g;

/**
 * Visually highlights personalization tags inside the editor:
 * valid tags render like a chip/link, unknown ones are flagged.
 * Purely decorative — the document text is untouched.
 */
export const MergeTagHighlight = Extension.create({
  name: "mergeTagHighlight",

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey("mergeTagHighlight"),
        props: {
          decorations(state) {
            const decorations: Decoration[] = [];
            state.doc.descendants((node, pos) => {
              if (!node.isText || !node.text) return;
              const text = node.text;
              TAG_REGEX.lastIndex = 0;
              let match: RegExpExecArray | null;
              while ((match = TAG_REGEX.exec(text)) !== null) {
                const token = match[0].slice(1);
                const from = pos + match.index;
                const to = from + match[0].length;
                decorations.push(
                  Decoration.inline(from, to, {
                    class: KNOWN.has(token) ? "merge-tag merge-tag--valid" : "merge-tag merge-tag--unknown",
                    title: KNOWN.has(token)
                      ? "Personalization tag — replaced per recipient"
                      : "Unknown tag — will be sent as plain text",
                  })
                );
              }
            });
            return DecorationSet.create(state.doc, decorations);
          },
        },
      }),
    ];
  },
});
