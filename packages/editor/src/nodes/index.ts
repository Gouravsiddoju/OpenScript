import { Node, mergeAttributes } from '@tiptap/core';

export const SceneHeadingNode = Node.create({
  name: 'sceneHeading',
  group: 'block',
  content: 'inline*',
  defining: true,

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
  defining: true,

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

  parseHTML() {
    return [{ tag: 'div.script-character' }, { tag: 'p.script-character' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { class: 'script-character' }), 0];
  },
});

export const ParentheticalNode = Node.create({
  name: 'parenthetical',
  group: 'block',
  content: 'inline*',
  defining: true,

  parseHTML() {
    return [{ tag: 'div.script-parenthetical' }, { tag: 'p.script-parenthetical' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { class: 'script-parenthetical' }), 0];
  },
});

export const DialogueNode = Node.create({
  name: 'dialogue',
  group: 'block',
  content: 'inline*',
  defining: true,

  parseHTML() {
    return [{ tag: 'div.script-dialogue' }, { tag: 'p.script-dialogue' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { class: 'script-dialogue' }), 0];
  },
});

export const TransitionNode = Node.create({
  name: 'transition',
  group: 'block',
  content: 'inline*',
  defining: true,

  parseHTML() {
    return [{ tag: 'div.script-transition' }, { tag: 'p.script-transition' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { class: 'script-transition' }), 0];
  },
});

export const screenplayNodes = [
  SceneHeadingNode,
  ActionNode,
  CharacterNode,
  ParentheticalNode,
  DialogueNode,
  TransitionNode,
];
