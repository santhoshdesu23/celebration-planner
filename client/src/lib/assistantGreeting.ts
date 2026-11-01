import type { ChatMessage } from '@/components/dashboard';

/** Initial AI assistant message shown for a celebration. */
export function buildGreetingMessages(title: string): ChatMessage[] {
  return [
    {
      sender: 'ai',
      text: `👋 Hello! I am your Celebration AI Assistant for **${title}**. You can ask me for budget trimming ideas, vendor inquiry templates, games, or run-of-show schedules!`,
      time: 'Just now',
    },
  ];
}

