import { routeQuestion } from './question-router';

describe('routeQuestion', () => {
  // Coding triggers → deepseek-reasoner
  it('routes "write a function to reverse a string" to coding', () => {
    const result = routeQuestion('write a function to reverse a string');
    expect(result.model).toBe('deepseek-reasoner');
    expect(result.systemPromptKey).toBe('coding');
  });

  it('routes "implement binary search" to coding', () => {
    const result = routeQuestion('implement binary search');
    expect(result.model).toBe('deepseek-reasoner');
    expect(result.systemPromptKey).toBe('coding');
  });

  it('routes "what is the time complexity of quicksort" to coding', () => {
    const result = routeQuestion('what is the time complexity of quicksort');
    expect(result.model).toBe('deepseek-reasoner');
    expect(result.systemPromptKey).toBe('coding');
  });

  it('routes "solve this leetcode problem" to coding', () => {
    const result = routeQuestion('solve this leetcode problem');
    expect(result.model).toBe('deepseek-reasoner');
    expect(result.systemPromptKey).toBe('coding');
  });

  // System design triggers → deepseek-reasoner
  it('routes "design a system for ride sharing" to systemdesign', () => {
    const result = routeQuestion('design a system for ride sharing');
    expect(result.model).toBe('deepseek-reasoner');
    expect(result.systemPromptKey).toBe('systemdesign');
  });

  it('routes "how would you architect a chat application" to systemdesign', () => {
    const result = routeQuestion('how would you architect a chat application');
    expect(result.model).toBe('deepseek-reasoner');
    expect(result.systemPromptKey).toBe('systemdesign');
  });

  it('routes "design twitter at scale" to systemdesign', () => {
    const result = routeQuestion('design twitter at scale');
    expect(result.model).toBe('deepseek-reasoner');
    expect(result.systemPromptKey).toBe('systemdesign');
  });

  // Math triggers → deepseek-reasoner
  it('routes "calculate the probability of rolling two sixes" to math', () => {
    const result = routeQuestion('calculate the probability of rolling two sixes');
    expect(result.model).toBe('deepseek-reasoner');
    expect(result.systemPromptKey).toBe('math');
  });

  it('routes "what is the expected value of a dice roll" to math', () => {
    const result = routeQuestion('what is the expected value of a dice roll');
    expect(result.model).toBe('deepseek-reasoner');
    expect(result.systemPromptKey).toBe('math');
  });

  // Behavioral triggers → deepseek-chat
  it('routes "tell me about yourself" to behavioral', () => {
    const result = routeQuestion('tell me about yourself');
    expect(result.model).toBe('deepseek-chat');
    expect(result.systemPromptKey).toBe('behavioral');
  });

  it('routes "describe a time you handled conflict" to behavioral', () => {
    const result = routeQuestion('describe a time you handled conflict with a teammate');
    expect(result.model).toBe('deepseek-chat');
    expect(result.systemPromptKey).toBe('behavioral');
  });

  it('routes "what is your greatest weakness" to behavioral', () => {
    const result = routeQuestion('what is your greatest weakness');
    expect(result.model).toBe('deepseek-chat');
    expect(result.systemPromptKey).toBe('behavioral');
  });

  // Default → technical
  it('routes generic technical question to technical', () => {
    const result = routeQuestion('what is a REST API');
    expect(result.model).toBe('deepseek-chat');
    expect(result.systemPromptKey).toBe('technical');
  });

  it('routes empty string to technical fallback', () => {
    const result = routeQuestion('');
    expect(result.model).toBe('deepseek-chat');
    expect(result.systemPromptKey).toBe('technical');
  });

  // Case insensitivity
  it('is case insensitive — uppercase IMPLEMENT routes to coding', () => {
    const result = routeQuestion('IMPLEMENT a sorting algorithm');
    expect(result.model).toBe('deepseek-reasoner');
    expect(result.systemPromptKey).toBe('coding');
  });

  // Coding takes priority over behavioral if both present
  it('prefers coding over behavioral when both triggers present', () => {
    const result = routeQuestion('tell me about yourself while you implement a function');
    expect(result.systemPromptKey).toBe('coding');
  });
});
