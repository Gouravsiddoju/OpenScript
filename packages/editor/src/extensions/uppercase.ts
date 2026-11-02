import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';

export const ScreenplayUppercase = Extension.create({
  name: 'screenplayUppercase',

  addProseMirrorPlugins() {
    const uppercaseBlockTypes = ['sceneHeading', 'character', 'transition', 'shot'];

    return [
      new Plugin({
        key: new PluginKey('screenplayUppercase'),
        props: {
          handleTextInput(view, from, to, text) {
            const { state } = view;
            const $from = state.doc.resolve(from);
            if (uppercaseBlockTypes.includes($from.parent.type.name)) {
              const upper = text.toUpperCase();
              const tr = state.tr.insertText(upper, from, to);
              view.dispatch(tr);
              return true;
            }
            return false;
          },
        },
        appendTransaction(transactions, _oldState, newState) {
          const docChanged = transactions.some((tr) => tr.docChanged);
          if (!docChanged) return null;

          let tr: any = null;
          const origSelection = newState.selection;

          newState.doc.descendants((node, pos) => {
            if (uppercaseBlockTypes.includes(node.type.name)) {
              const text = node.textContent;
              const upper = text.toUpperCase();
              if (text && text !== upper) {
                if (!tr) {
                  tr = newState.tr;
                  tr.setMeta('addToHistory', false);
                }
                const from = pos + 1;
                const to = pos + node.nodeSize - 1;
                tr.insertText(upper, from, to);
              }
            }
          });

          if (tr) {
            // Preserve the user's cursor position through the transaction mapping
            tr.setSelection(origSelection.map(tr.doc, tr.mapping));
          }

          return tr;
        },
      }),
    ];
  },
});
