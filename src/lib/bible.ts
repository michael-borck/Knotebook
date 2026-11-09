export interface BibleVariable {
  name: string
  description: string
}

export interface BibleKnot {
  name: string
  purpose: string
}

export interface StoryBible {
  title: string
  premise: string
  tone: string
  variables: BibleVariable[]
  knots: BibleKnot[]
  tags: string[]
  rules: string[]
}

export const DEFAULT_BIBLE: StoryBible = {
  title: 'The Lantern Keepers',
  premise: 'A short branching story used to test Pathwright.',
  tone: 'Warm, conversational, second person.',
  variables: [
    { name: 'courage', description: '0-10, how bold the protagonist has been.' },
    { name: 'lantern', description: 'True once the player has picked up the lantern.' },
  ],
  knots: [
    { name: 'start', purpose: 'Opening scene and first choice.' },
    { name: 'climb', purpose: 'The route taken when the player climbs down.' },
    { name: 'shore', purpose: 'The route taken when the player follows the shore.' },
  ],
  tags: ['title', 'author', 'image', 'bg', 'sfx', 'music', 'anim', 'panel', 'bubble'],
  rules: [
    'Plain knots, stitches, choices and variables only. No tunnels, threads or LISTs.',
    'One knot per scene.',
    'Every divert must point at an existing knot.',
    'Use only tags listed in this bible.',
  ],
}

export function buildLLMPrompt(bible: StoryBible, source: string): string {
  return [
    "You are writing an interactive branching story in ink (inkle's narrative scripting language).",
    '',
    'Story bible (JSON):',
    JSON.stringify(bible, null, 2),
    '',
    'Conventions:',
    '- Output only ink source. No prose outside the ink script.',
    '- Use === knot === headers, choices with * or +, and -> diverts.',
    '- Keep knot names stable and listed in the bible.',
    ...bible.rules.map((rule) => `- ${rule}`),
    '',
    'Current script:',
    '```ink',
    source.trim(),
    '```',
    '',
    'Task: extend or revise the script while preserving the bible and conventions.',
  ].join('\n')
}
