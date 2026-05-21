export type QuestionType =
  | 'behavioral'
  | 'technical'
  | 'coding'
  | 'systemdesign'
  | 'math'
  | 'screenshot';

export type ModelChoice = 'deepseek-chat' | 'deepseek-reasoner';

export interface RouteResult {
  model: ModelChoice;
  format: string;
  systemPromptKey: string;
}

const BEHAVIORAL_TRIGGERS = [
  'tell me about yourself', 'describe a time', 'how do you handle',
  'greatest weakness', 'greatest strength', 'why did you leave',
  'where do you see yourself', 'why do you want', 'what motivates',
  'conflict with', 'challenging situation', 'proud of', 'failure',
  'leadership', 'teamwork', 'disagreement',
];

const CODING_TRIGGERS = [
  'write a function', 'implement', 'solve this', 'algorithm',
  'time complexity', 'space complexity', 'optimize', 'refactor',
  'debug this', 'whats wrong with', 'leetcode', 'hackerrank',
  'binary search', 'dynamic programming', 'recursion', 'linked list',
];

const SYSTEM_DESIGN_TRIGGERS = [
  'design a system', 'how would you architect', 'scale this',
  'design twitter', 'design uber', 'design netflix', 'design whatsapp',
  'microservices', 'load balancer', 'database sharding', 'caching strategy',
  'how would you build', 'system design',
];

const MATH_TRIGGERS = [
  'calculate', 'probability', 'how many ways', 'prove that',
  'derive', 'what is the formula', 'expected value', 'permutation',
  'combination', 'statistics', 'regression',
];

export function routeQuestion(transcript: string): RouteResult {
  const lower = transcript.toLowerCase();

  if (CODING_TRIGGERS.some(t => lower.includes(t))) {
    return { model: 'deepseek-reasoner', format: 'code', systemPromptKey: 'coding' };
  }

  if (SYSTEM_DESIGN_TRIGGERS.some(t => lower.includes(t))) {
    return { model: 'deepseek-reasoner', format: 'structured', systemPromptKey: 'systemdesign' };
  }

  if (MATH_TRIGGERS.some(t => lower.includes(t))) {
    return { model: 'deepseek-reasoner', format: 'stepbystep', systemPromptKey: 'math' };
  }

  if (BEHAVIORAL_TRIGGERS.some(t => lower.includes(t))) {
    return { model: 'deepseek-chat', format: 'star', systemPromptKey: 'behavioral' };
  }

  // Default — technical/general
  return { model: 'deepseek-chat', format: 'concise', systemPromptKey: 'technical' };
}
