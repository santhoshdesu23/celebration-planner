import { Sparkles, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui';
import type { AiIdea } from '@celebration-planner/shared';

export interface IdeasTabProps {
  ideas: AiIdea[];
  isRegenerating: boolean;
  onRegenerateIdeas: () => void;
  onSelectPrompt: (prompt: string) => void;
}

export function IdeasTab({
  ideas,
  isRegenerating,
  onRegenerateIdeas,
  onSelectPrompt,
}: IdeasTabProps) {
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl font-bold text-charcoal">
            Curated AI Inspiration & Concepts
          </h2>
          <p className="text-sm text-muted">
            Bespoke aesthetics, sensory details, and signature experiences designed for your celebration.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={onRegenerateIdeas}
          loading={isRegenerating}
          leftIcon={<RefreshCw size={14} />}
        >
          Refresh AI Ideas
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {ideas.map((idea, index) => (
          <div
            key={idea.id || index}
            className="bg-white rounded-3xl border border-ivory-200 p-6 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden flex flex-col justify-between"
          >
            <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-gold/15 to-transparent rounded-bl-full pointer-events-none" />
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold tracking-wider uppercase text-gold bg-gold/10 px-3 py-1 rounded-full">
                  {idea.category}
                </span>
                <Sparkles size={16} className="text-gold" />
              </div>
              <h3 className="font-display text-lg font-bold text-charcoal mb-2">
                {idea.title}
              </h3>
              <p className="text-sm text-charcoal-light leading-relaxed mb-4">
                {idea.description}
              </p>
            </div>
            {idea.tags && idea.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-3 border-t border-ivory-200">
                {idea.tags.map((tag, tIdx) => (
                  <span
                    key={tIdx}
                    className="text-xs bg-ivory-100 text-charcoal-light px-2.5 py-1 rounded-full font-medium"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Quick Inspiration Pills */}
      <div className="bg-plum-50 rounded-3xl p-6 border border-plum-100">
        <h3 className="font-display text-base font-bold text-plum mb-2">
          Need more tailored recommendations?
        </h3>
        <p className="text-xs text-muted mb-4">
          Click any prompt to instantly consult your personal Celebration AI assistant:
        </p>
        <div className="flex flex-wrap gap-2">
          {[
            'Suggest 3 creative interactive guest icebreakers',
            'What are the trending color palettes for this theme?',
            'Recommend signature mocktail and cocktail pairings',
            'Give me creative party favors under $5 per guest',
          ].map((prompt, pIdx) => (
            <button
              key={pIdx}
              onClick={() => onSelectPrompt(prompt)}
              className="text-xs font-medium bg-white hover:bg-gold/10 hover:border-gold border border-plum-200 text-charcoal px-3 py-2 rounded-xl transition-colors shadow-2xs"
            >
              ✦ {prompt}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
