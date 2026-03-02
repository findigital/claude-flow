/**
 * Anti-Slop Writing Filter
 *
 * Based on hardikpandya/stop-slop and blader/humanizer principles.
 * Provides system prompts and post-processing to remove AI writing patterns.
 */

export const BANNED_PHRASES = [
  'delve into', 'delve deeper', 'deep dive',
  'it\'s important to note', 'it\'s worth noting', 'it should be noted',
  'in today\'s rapidly evolving', 'in an era of', 'in the ever-changing',
  'at its core', 'at the heart of',
  'game-changer', 'game changing', 'paradigm shift',
  'leverage', 'leveraging', 'leveraged',
  'tapestry', 'rich tapestry',
  'landscape', 'ever-evolving landscape', 'shifting landscape',
  'robust', 'robust solution', 'robust framework',
  'seamless', 'seamlessly', 'seamless integration',
  'cutting-edge', 'state-of-the-art', 'best-in-class',
  'holistic', 'holistic approach',
  'synergy', 'synergies', 'synergistic',
  'empower', 'empowering', 'empowerment',
  'foster', 'fostering',
  'spearheading', 'spearhead',
  'cornerstone', 'linchpin', 'bedrock',
  'multifaceted', 'myriad',
  'navigate the complexities', 'navigate the landscape',
  'testament to', 'a testament',
  'pivotal moment', 'pivotal role', 'marking a pivotal',
  'crucial role', 'plays a crucial',
  'it\'s not just', 'it\'s not merely',
  'realm', 'in the realm of',
  'arguably', 'undeniably', 'remarkably',
  'serves as a', 'serves as the',
  'I hope this helps',
  'let me know if',
  'here\'s the thing',
  'in conclusion',
  'without further ado',
  'nestled within',
  'the bottom line is',
  'when it comes to',
  'at the end of the day',
  'moving forward',
  'going forward',
  'on the other hand',
  'having said that',
  'with that being said',
  'it goes without saying',
  'needless to say',
  'in a nutshell',
  'by and large',
  'first and foremost',
  'last but not least',
  'the fact of the matter',
  'all things considered',
  'broadly speaking',
  'showcasing', 'symbolizing', 'reflecting a',
  'underscores', 'underscoring',
  'paving the way', 'charting the course',
  'poised to', 'well-positioned',
  'transformative', 'transformative potential',
  'comprehensive approach',
  'dynamic environment',
];

export const ANTI_SLOP_SYSTEM_PROMPT = `You write like a senior analyst who values clarity over decoration.

STRICT RULES — violating any of these degrades the output:

1. BANNED PHRASES: Never use these — they are AI writing tells:
   delve, tapestry, landscape, robust, seamless, cutting-edge, holistic,
   synergy, empower, foster, spearhead, cornerstone, linchpin, bedrock,
   multifaceted, myriad, testament, pivotal, game-changer, paradigm shift,
   leverage (as verb), navigate the complexities, poised to, paving the way,
   it's important to note, it's worth noting, in today's rapidly evolving,
   at its core, serves as a, showcasing, symbolizing, underscores.

2. STRUCTURE RULES:
   - No throat-clearing openers. Start with the point.
   - No "Rule of Three" lists unless genuinely needed.
   - No rhetorical questions followed by immediate answers.
   - No binary contrasts ("It's not just X, it's Y"). State directly.
   - Vary sentence length. Mix 5-word punches with 25-word explanations.

3. VOICE RULES:
   - Use "is" and "has" instead of "serves as," "boasts," "features."
   - Use specific numbers, dates, and names — not "experts believe."
   - State uncertainty directly: "Data is limited" not "further research is needed."
   - Be direct. Cut filler. Every sentence carries information.
   - Write like you're briefing a busy executive who will stop reading if bored.

4. DENSITY:
   - If a sentence can be cut without losing meaning, cut it.
   - If an adjective doesn't change the reader's understanding, remove it.
   - Prefer active voice. Name the actor.`;

export function cleanSlopFromText(text: string): string {
  let cleaned = text;

  for (const phrase of BANNED_PHRASES) {
    const regex = new RegExp(phrase, 'gi');
    cleaned = cleaned.replace(regex, (match) => {
      const replacements: Record<string, string> = {
        'delve into': 'examine',
        'delve deeper': 'look further at',
        'deep dive': 'detailed analysis',
        'leverage': 'use',
        'leveraging': 'using',
        'leveraged': 'used',
        'robust': 'strong',
        'seamless': 'smooth',
        'seamlessly': 'smoothly',
        'cutting-edge': 'advanced',
        'holistic': 'complete',
        'synergy': 'combined effect',
        'empower': 'enable',
        'empowering': 'enabling',
        'foster': 'build',
        'fostering': 'building',
        'spearheading': 'leading',
        'cornerstone': 'foundation',
        'multifaceted': 'complex',
        'myriad': 'many',
        'pivotal': 'important',
        'transformative': 'significant',
        'comprehensive': 'thorough',
        'navigate the complexities': 'handle the challenges',
        'poised to': 'ready to',
        'paving the way': 'enabling',
        'game-changer': 'significant change',
        'paradigm shift': 'major change',
      };

      const lower = match.toLowerCase();
      return replacements[lower] ?? '';
    });
  }

  cleaned = cleaned.replace(/\s{2,}/g, ' ');
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n');

  return cleaned;
}
