import { Link } from 'react-router-dom';
import { Sparkles, Heart, Github, Twitter } from 'lucide-react';

const footerLinks = {
  Product: [
    { label: 'Plan an Event', to: '/create' },
    { label: 'Features', to: '/#features' },
    { label: 'Pricing', to: '/#pricing', disabled: true },
  ],
  Support: [
    { label: 'Documentation', to: '/docs', disabled: true },
    { label: 'FAQs', to: '/faq', disabled: true },
    { label: 'Contact Us', to: '/contact', disabled: true },
  ],
};

export function Footer() {
  return (
    <footer
      role="contentinfo"
      className="bg-plum text-white/80 mt-auto"
    >
      <div className="section-container py-16">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10">
          {/* Brand */}
          <div className="md:col-span-2">
            <Link
              to="/"
              className="inline-flex items-center gap-2 mb-4"
              aria-label="Celebration Planner home"
            >
              <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center">
                <Sparkles size={16} className="text-gold-300" />
              </div>
              <span className="font-display font-semibold text-lg text-white">
                Celebration<span className="text-gold-300">Planner</span>
              </span>
            </Link>
            <p className="text-sm leading-relaxed text-white/60 max-w-xs">
              AI-powered planning for weddings, birthdays, and community events.
              Budget tracking, timelines, and vendor management — all in one
              place.
            </p>
            <div className="flex items-center gap-3 mt-6">
              <a
                href="https://github.com"
                aria-label="GitHub"
                className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Github size={16} />
              </a>
              <a
                href="https://twitter.com"
                aria-label="Twitter / X"
                className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Twitter size={16} />
              </a>
            </div>
          </div>

          {/* Links */}
          {Object.entries(footerLinks).map(([section, links]) => (
            <div key={section}>
              <h3 className="text-white font-semibold text-sm mb-4 uppercase tracking-wider">
                {section}
              </h3>
              <ul className="space-y-2.5">
                {links.map((link) => (
                  <li key={link.label}>
                    {link.disabled ? (
                      <span
                        className="text-sm text-white/40 cursor-not-allowed"
                        aria-disabled="true"
                        title="Coming soon"
                      >
                        {link.label}
                        <span className="ml-2 text-xs text-gold-400/60">
                          Soon
                        </span>
                      </span>
                    ) : (
                      <Link
                        to={link.to}
                        className="text-sm text-white/60 hover:text-white transition-colors"
                      >
                        {link.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="border-t border-white/10 mt-12 pt-6 flex flex-col sm:flex-row items-center justify-between gap-2">
          <p className="text-xs text-white/40">
            © {new Date().getFullYear()} Celebration Planner. All rights
            reserved.
          </p>
          <p className="text-xs text-white/40 flex items-center gap-1">
            Made with <Heart size={10} className="text-gold-300" /> for
            Hack2Skill PromptWars Challenge 5
          </p>
        </div>
      </div>
    </footer>
  );
}
