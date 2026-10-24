import React, { useState } from 'react';
import { Sparkles, Send } from 'lucide-react';
import { Button, Spinner } from '@/components/ui';

export interface ChatMessage {
  sender: 'user' | 'ai';
  text: string;
  time: string;
}

export interface AssistantTabProps {
  messages: ChatMessage[];
  chatLoading: boolean;
  suggestions?: string[];
  onSendMessage: (prompt?: string) => Promise<void>;
}

export function AssistantTab({
  messages,
  chatLoading,
  suggestions,
  onSendMessage,
}: AssistantTabProps) {
  const [chatPrompt, setChatPrompt] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatPrompt.trim() || chatLoading) return;
    const text = chatPrompt;
    setChatPrompt('');
    onSendMessage(text);
  };

  return (
    <div className="space-y-4 animate-fade-in">
      <div>
        <h2 className="font-display text-2xl font-bold text-charcoal flex items-center gap-2">
          <Sparkles size={24} className="text-gold" />
          Celebration AI Planning Assistant
        </h2>
        <p className="text-sm text-muted">
          Your dedicated event consultant trained with your date, budget, guest count, and theme.
        </p>
      </div>

      {/* Chat Box */}
      <div className="bg-white rounded-3xl border border-ivory-200 p-5 shadow-sm flex flex-col h-[520px]">
        {/* Message History */}
        <div className="flex-1 overflow-y-auto space-y-4 pr-2">
          {messages.map((m, idx) => (
            <div
              key={idx}
              className={`flex ${
                m.sender === 'user' ? 'justify-end' : 'justify-start'
              }`}
            >
              <div
                className={`max-w-[85%] rounded-2xl p-4 text-sm leading-relaxed ${
                  m.sender === 'user'
                    ? 'bg-plum text-white rounded-br-none'
                    : 'bg-ivory-100 text-charcoal rounded-bl-none border border-ivory-200'
                }`}
              >
                <div className="whitespace-pre-wrap">{m.text}</div>
                <span
                  className={`text-[10px] block mt-1 ${
                    m.sender === 'user' ? 'text-plum-200' : 'text-muted'
                  }`}
                >
                  {m.time}
                </span>
              </div>
            </div>
          ))}
          {chatLoading && (
            <div className="flex justify-start">
              <div className="bg-ivory-100 text-charcoal rounded-2xl rounded-bl-none p-4 text-sm flex items-center gap-2 border border-ivory-200">
                <Spinner size="sm" />
                <span className="text-muted italic">Consultant is typing…</span>
              </div>
            </div>
          )}
        </div>

        {/* Quick Suggestion Chips */}
        {suggestions && suggestions.length > 0 && (
          <div className="pt-2 pb-2 flex flex-wrap items-center gap-1.5 border-t border-ivory-100">
            <span className="text-[11px] font-semibold text-muted mr-1">Suggestions:</span>
            {suggestions.map((s, idx) => (
              <button
                key={idx}
                type="button"
                disabled={chatLoading}
                onClick={() => onSendMessage(s)}
                className="text-xs bg-ivory-100 hover:bg-gold/15 text-charcoal hover:text-plum border border-ivory-300 rounded-full px-3 py-1 transition-all text-left"
              >
                💡 {s}
              </button>
            ))}
          </div>
        )}

        {/* Chat Input Bar */}
        <div className="pt-3 border-t border-ivory-200">
          <form onSubmit={handleSubmit} className="flex gap-2">
            <input
              type="text"
              value={chatPrompt}
              onChange={(e) => setChatPrompt(e.target.value)}
              placeholder="Ask anything: e.g. 'Draft inquiry email to venue', 'Suggest budget cuts'…"
              className="flex-1 rounded-2xl border border-ivory-300 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-gold"
            />
            <Button
              type="submit"
              variant="primary"
              disabled={!chatPrompt.trim() || chatLoading}
              rightIcon={<Send size={16} />}
            >
              Send
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
