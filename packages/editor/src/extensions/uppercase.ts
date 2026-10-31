import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';

export const ScreenplayUppercase = Extension.create({
  name: 'screenplayUppercase',

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('screenplayUppercase'),
        appendTransaction(transactions, _oldState, newState) {
          const docChanged = transactions.some((tr) => tr.docChanged);
          if (!docChanged) return null;

          let tr: any = null;
          newState.doc.descendants((node, pos) => {
            if (['sceneHeading', 'character', 'transition'].includes(node.type.name)) {
              const text = node.textContent;
              const upper = text.toUpperCase();
              if (text && text !== upper) {
                if (!tr) tr = newState.tr;
                const from = pos + 1;
                const to = pos + node.nodeSize - 1;
                tr.insertText(upper, from, to);
              }
            }
          });

          return tr;
        },
      }),
    ];
  },
});
