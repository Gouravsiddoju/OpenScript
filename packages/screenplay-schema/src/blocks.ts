import { z } from 'zod';

export const ScreenplayBlockTypeSchema = z.enum([
  'sceneHeading',
  'action',
  'character',
  'parenthetical',
  'dialogue',
  'dualDialogue',
  'transition',
  'shot',
  'general',
  'note'
]);
export type ScreenplayBlockType = z.infer<typeof ScreenplayBlockTypeSchema>;

export const InlineMarkSchema = z.object({
  type: z.enum(['bold', 'italic', 'underline', 'strikethrough']),
  from: z.number(),
  to: z.number(),
});
export type InlineMark = z.infer<typeof InlineMarkSchema>;

export const RevisionColorSchema = z.enum([
  'white',
  'blue',
  'pink',
  'yellow',
  'green',
  'goldenrod',
  'buff',
  'salmon',
  'cherry'
]);
export type RevisionColor = z.infer<typeof RevisionColorSchema>;

export const SceneMetaSchema = z.object({
  setting: z.enum(['INT', 'EXT', 'INT/EXT']).optional(),
  location: z.string().optional(),
  timeOfDay: z.enum(['DAY', 'NIGHT', 'DAWN', 'DUSK', 'LATER', 'CONTINUOUS', 'SAME']).optional(),
  synopsis: z.string().max(500).optional(),
  colorTag: z.string().regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/).optional(),
  act: z.string().optional(),
  charactersPresent: z.array(z.string()).default([]),
  pageLengthEighths: z.number().int().min(1).optional(),
});
export type SceneMeta = z.infer<typeof SceneMetaSchema>;

export const ScreenplayBlockSchema = z.object({
  id: z.string().uuid(),
  type: ScreenplayBlockTypeSchema,
  text: z.string(),
  marks: z.array(InlineMarkSchema).optional().default([]),
  sceneNumber: z.string().optional(),
  isOmitted: z.boolean().optional().default(false),
  revisionColor: RevisionColorSchema.optional(),
  revisionMark: z.boolean().optional().default(false),
  sceneMeta: SceneMetaSchema.optional(),
  dualDialogue: z.object({
    leftCharacter: z.string(),
    leftDialogue: z.string(),
    rightCharacter: z.string(),
    rightDialogue: z.string(),
  }).optional(),
});
export type ScreenplayBlock = z.infer<typeof ScreenplayBlockSchema>;
export type ScreenplayBlockInput = z.input<typeof ScreenplayBlockSchema>;

export function createScreenplayBlock(input: ScreenplayBlockInput): ScreenplayBlock {
  return ScreenplayBlockSchema.parse(input);
}
