import { Extension } from '@tiptap/core';

export const ELEMENT_CYCLE_ORDER = [
  'sceneHeading',
  'action',
  'character',
  'parenthetical',
  'dialogue',
  'transition',
] as const;

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

        // 5. Dialogue + Enter -> Create Action (or convert empty dialogue to Action)
        if (blockType === 'dialogue') {
          if (text === '') {
            return editor.chain().setNode('action').run();
          }
          return editor.chain().insertContentAt(selection.$from.end(), { type: 'action' }).focus().run();
        }

        // 6. Transition + Enter -> Create Scene Heading
        if (blockType === 'transition') {
          return editor.chain().insertContentAt(selection.$from.end(), { type: 'sceneHeading' }).focus().run();
        }

        return false;
      },

      // Full cyclic Tab forward through all screenplay elements in sequence:
      // sceneHeading -> action -> character -> parenthetical -> dialogue -> transition -> sceneHeading
      'Tab': ({ editor }) => {
        const { state } = editor;
        const { selection } = state;
        const currentBlock = selection.$from.parent;
        const blockType = currentBlock.type.name;

        const currentIndex = ELEMENT_CYCLE_ORDER.indexOf(blockType as any);
        if (currentIndex !== -1) {
          const nextIndex = (currentIndex + 1) % ELEMENT_CYCLE_ORDER.length;
          return editor.chain().setNode(ELEMENT_CYCLE_ORDER[nextIndex]).run();
        }

        return editor.chain().setNode('action').run();
      },

      // Shift+Tab backward cycle in reverse sequence:
      // sceneHeading <- action <- character <- parenthetical <- dialogue <- transition
      'Shift-Tab': ({ editor }) => {
        const { state } = editor;
        const { selection } = state;
        const currentBlock = selection.$from.parent;
        const blockType = currentBlock.type.name;

        const currentIndex = ELEMENT_CYCLE_ORDER.indexOf(blockType as any);
        if (currentIndex !== -1) {
          const prevIndex = (currentIndex - 1 + ELEMENT_CYCLE_ORDER.length) % ELEMENT_CYCLE_ORDER.length;
          return editor.chain().setNode(ELEMENT_CYCLE_ORDER[prevIndex]).run();
        }

        return editor.chain().setNode('sceneHeading').run();
      },

      // Direct element shortcuts: Mod+1 through Mod+6 (Ctrl+1 or Cmd+1)
      'Mod-1': ({ editor }) => editor.chain().setNode('sceneHeading').run(),
      'Mod-2': ({ editor }) => editor.chain().setNode('action').run(),
      'Mod-3': ({ editor }) => editor.chain().setNode('character').run(),
      'Mod-4': ({ editor }) => editor.chain().setNode('parenthetical').run(),
      'Mod-5': ({ editor }) => editor.chain().setNode('dialogue').run(),
      'Mod-6': ({ editor }) => editor.chain().setNode('transition').run(),

      // Alt+1 through Alt+6 shortcuts
      'Alt-1': ({ editor }) => editor.chain().setNode('sceneHeading').run(),
      'Alt-2': ({ editor }) => editor.chain().setNode('action').run(),
      'Alt-3': ({ editor }) => editor.chain().setNode('character').run(),
      'Alt-4': ({ editor }) => editor.chain().setNode('parenthetical').run(),
      'Alt-5': ({ editor }) => editor.chain().setNode('dialogue').run(),
      'Alt-6': ({ editor }) => editor.chain().setNode('transition').run(),
    };
  },
});
