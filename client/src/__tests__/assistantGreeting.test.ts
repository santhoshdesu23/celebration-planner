import { describe, it, expect } from 'vitest';
import { buildGreetingMessages } from '../lib/assistantGreeting';

describe('buildGreetingMessages', () => {
  it('returns a single AI greeting with the exact existing wording', () => {
    expect(buildGreetingMessages('Sapphire Ball')).toEqual([
      {
        sender: 'ai',
        text: '👋 Hello! I am your Celebration AI Assistant for **Sapphire Ball**. You can ask me for budget trimming ideas, vendor inquiry templates, games, or run-of-show schedules!',
        time: 'Just now',
      },
    ]);
  });

  it('returns a fresh array each call', () => {
    expect(buildGreetingMessages('A')).not.toBe(buildGreetingMessages('A'));
  });
});

