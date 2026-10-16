import { Extension } from '@tiptap/core';

export const ScreenplayKeymap = Extension.create({
  name: 'screenplayKeymap',

  addKeyboardShortcuts() {
    return {
      'Enter': ({ editor }) => {
        const { state } = editor;
        const { selection } = state;
        const currentBlock = selection.$from.parent;
        const blockType = currentBlock.type.name;
        const text = currentBlock.textContent.trim();

        // 1. Scene Heading + Enter -> Create Action
        if (blockType === 'sceneHeading') {
          return editor.chain().insertContentAt(selection.$from.end(), { type: 'action' }).focus().run();
        }

        // 2. Action + Enter on empty line -> Convert to Character Cue
        if (blockType === 'action') {
          if (text === '') {
            return editor.chain().setNode('character').run();
          }
          return editor.chain().insertContentAt(selection.$from.end(), { type: 'action' }).focus().run();
        }

        // 3. Character + Enter -> Create Dialogue
        if (blockType === 'character') {
          return editor.chain().insertContentAt(selection.$from.end(), { type: 'dialogue' }).focus().run();
        }

        // 4. Parenthetical + Enter -> Create Dialogue
        if (blockType === 'parenthetical') {
          return editor.chain().insertContentAt(selection.$from.end(), { type: 'dialogue' }).focus().run();
        }

        // 5. Dialogue + Enter -> Create Action
        if (blockType === 'dialogue') {
          return editor.chain().insertContentAt(selection.$from.end(), { type: 'action' }).focus().run();
        }

        return false;
      },

      'Tab': ({ editor }) => {
        const { state } = editor;
        const { selection } = state;
        const currentBlock = selection.$from.parent;
        const blockType = currentBlock.type.name;

        // Action + Tab -> Convert to Character Cue
        if (blockType === 'action') {
          return editor.chain().setNode('character').run();
        }

        // Dialogue + Tab -> Convert to Parenthetical
        if (blockType === 'dialogue') {
          return editor.chain().setNode('parenthetical').run();
        }

        // Character + Tab -> Convert to Transition
        if (blockType === 'character') {
          return editor.chain().setNode('transition').run();
        }

        return true; // Prevent default focus loss
      },
    };
  },
});
