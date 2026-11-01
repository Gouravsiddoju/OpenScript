import { Node, mergeAttributes } from '@tiptap/core';

const commonAttributes = {
  revisionMark: {
    default: false,
    keepOnSplit: false,
    parseHTML: (element: HTMLElement) => element.getAttribute('data-revision-mark') === 'true' || element.classList.contains('revision-marker'),
    renderHTML: (attributes: Record<string, any>) => {
      if (!attributes.revisionMark) return {};
      return {
        'data-revision-mark': 'true',
        class: 'revision-marker',
      };
    },
  },
  pageBreak: {
    default: null,
    keepOnSplit: false,
    parseHTML: (element: HTMLElement) => element.getAttribute('data-page-break'),
    renderHTML: (attributes: Record<string, any>) => {
      if (!attributes.pageBreak) return {};
      return {
        'data-page-break': attributes.pageBreak,
      };
    },
  },
  actBreak: {
    default: null,
    keepOnSplit: false,
    parseHTML: (element: HTMLElement) => element.getAttribute('data-act-break'),
    renderHTML: (attributes: Record<string, any>) => {
      if (!attributes.actBreak) return {};
      return {
        'data-act-break': attributes.actBreak,
      };
    },
  },
  revisionColor: {
    default: null,
    keepOnSplit: false,
    parseHTML: (element: HTMLElement) => element.getAttribute('data-revision-color'),
    renderHTML: (attributes: Record<string, any>) => {
      if (!attributes.revisionColor) return {};
      return {
        'data-revision-color': attributes.revisionColor,
      };
    },
  },
};

export const SceneHeadingNode = Node.create({
  name: 'sceneHeading',
  group: 'block',
  content: 'inline*',
  defining: true,

  addAttributes() {
    return {
      ...commonAttributes,
      sceneNumber: {
        default: null,
        parseHTML: (element: HTMLElement) => element.getAttribute('data-scene-number'),
        renderHTML: (attributes: Record<string, any>) => {
          if (!attributes.sceneNumber) return {};
          return {
            'data-scene-number': attributes.sceneNumber,
          };
        },
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div.script-scene-heading' }, { tag: 'p.script-scene-heading' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { class: 'script-scene-heading' }), 0];
  },
});

export const ActionNode = Node.create({
  name: 'action',
  group: 'block',
  content: 'inline*',

  addAttributes() {
    return commonAttributes;
  },

  parseHTML() {
    return [{ tag: 'div.script-action' }, { tag: 'p.script-action' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { class: 'script-action' }), 0];
  },
});

export const CharacterNode = Node.create({
  name: 'character',
  group: 'block',
  content: 'inline*',
  defining: true,

  addAttributes() {
    return commonAttributes;
  },

  parseHTML() {
    return [{ tag: 'div.script-character' }, { tag: 'p.script-character' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { class: 'script-character' }), 0];
  },
});

export const DialogueNode = Node.create({
  name: 'dialogue',
  group: 'block',
  content: 'inline*',

  addAttributes() {
    return commonAttributes;
  },

  parseHTML() {
    return [{ tag: 'div.script-dialogue' }, { tag: 'p.script-dialogue' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { class: 'script-dialogue' }), 0];
  },
});

export const ParentheticalNode = Node.create({
  name: 'parenthetical',
  group: 'block',
  content: 'inline*',

  addAttributes() {
    return commonAttributes;
  },

  parseHTML() {
    return [{ tag: 'div.script-parenthetical' }, { tag: 'p.script-parenthetical' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { class: 'script-parenthetical' }), 0];
  },
});

export const TransitionNode = Node.create({
  name: 'transition',
  group: 'block',
  content: 'inline*',

  addAttributes() {
    return commonAttributes;
  },

  parseHTML() {
    return [{ tag: 'div.script-transition' }, { tag: 'p.script-transition' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { class: 'script-transition' }), 0];
  },
});

export const ShotNode = Node.create({
  name: 'shot',
  group: 'block',
  content: 'inline*',
  defining: true,

  addAttributes() {
    return commonAttributes;
  },

  parseHTML() {
    return [{ tag: 'div.script-shot' }, { tag: 'p.script-shot' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { class: 'script-shot' }), 0];
  },
});

export const DualDialogueNode = Node.create({
  name: 'dualDialogue',
  group: 'block',
  content: 'block+',
  defining: true,

  addAttributes() {
    return commonAttributes;
  },

  parseHTML() {
    return [{ tag: 'div.script-dual-dialogue' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { class: 'script-dual-dialogue' }), 0];
  },
});

export const screenplayNodes = [
  SceneHeadingNode,
  ActionNode,
  CharacterNode,
  DialogueNode,
  ParentheticalNode,
  TransitionNode,
  ShotNode,
  DualDialogueNode,
];
