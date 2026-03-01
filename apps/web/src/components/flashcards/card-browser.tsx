import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Search,
  ArrowRight,
  ExternalLink,
  X,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getDomainTabItems } from "@/lib/domains";
import { getDifficultyClasses } from "@/lib/ui-constants";
import type { Flashcard, FlashcardProgress } from "@/lib/flashcards";

const DOMAIN_TABS = getDomainTabItems();

function getStatusBadge(interval: number | undefined, hasProgress: boolean) {
  if (!hasProgress) return { label: "New", className: "bg-blue-500/10 text-blue-400" };
  if (interval !== undefined && interval > 21) return { label: "Mastered", className: "bg-emerald-500/10 text-emerald-400" };
  return { label: "Learning", className: "bg-amber-500/10 text-amber-400" };
}

function formatRelativeDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays <= 0) return "Today";
  if (diffDays === 1) return "Tomorrow";
  if (diffDays < 7) return `In ${diffDays} days`;
  if (diffDays < 30) return `In ${Math.ceil(diffDays / 7)} weeks`;
  return `In ${Math.ceil(diffDays / 30)} months`;
}

interface CardBrowserProps {
  cards: Flashcard[];
  dueCounts: Record<string, number>;
  domainFilter: string;
  onDomainFilterChange: (value: string) => void;
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  expandedCard: string | null;
  onExpandedCardChange: (id: string | null) => void;
  getCardProgress: (id: string) => FlashcardProgress | null | undefined;
}

export function CardBrowser({
  cards,
  dueCounts,
  domainFilter,
  onDomainFilterChange,
  searchQuery,
  onSearchQueryChange,
  expandedCard,
  onExpandedCardChange,
  getCardProgress,
}: CardBrowserProps) {
  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h2 className="text-lg font-semibold text-zinc-200 flex items-center gap-2">
          <Search className="h-5 w-5 text-zinc-500" />
          Card Library
        </h2>
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
          <Input
            placeholder="Search cards..."
            value={searchQuery}
            onChange={(e) => onSearchQueryChange(e.target.value)}
            className="pl-9 bg-zinc-900 border-zinc-800 text-zinc-300 text-xs placeholder:text-zinc-600 h-9"
          />
          {searchQuery && (
            <button
              onClick={() => onSearchQueryChange("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      <Tabs value={domainFilter} onValueChange={onDomainFilterChange}>
        <TabsList className="bg-zinc-900/80 border border-zinc-800 h-auto flex-wrap">
          {DOMAIN_TABS.map((tab) => (
            <TabsTrigger
              key={tab.slug}
              value={tab.slug}
              className={cn(
                "text-xs data-[state=active]:bg-emerald-500/10 data-[state=active]:text-emerald-400 data-[state=active]:border-emerald-500/20",
                "text-zinc-500 hover:text-zinc-300"
              )}
            >
              {tab.label}
              {(dueCounts[tab.slug] ?? 0) > 0 && (
                <span className="ml-1.5 inline-flex items-center justify-center h-4 min-w-[16px] px-1 rounded-full bg-emerald-500/20 text-emerald-400 text-[9px] font-bold">
                  {dueCounts[tab.slug]}
                </span>
              )}
            </TabsTrigger>
          ))}
        </TabsList>

        <div className="mt-4">
          {cards.length === 0 ? (
            <div className="text-center py-12">
              <Search className="h-8 w-8 text-zinc-700 mx-auto mb-3" />
              <p className="text-sm text-zinc-500">No cards found matching your search.</p>
            </div>
          ) : (
            <>
              <p className="text-xs text-zinc-600 mb-3">
                Showing {cards.length} cards
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {cards.map((card) => {
                  const cardProg = getCardProgress(card.id);
                  const cardStatus = getStatusBadge(cardProg?.interval, !!cardProg);
                  const isExpanded = expandedCard === card.id;

                  return (
                    <Card
                      key={card.id}
                      className={cn(
                        "border-zinc-800 bg-zinc-900/50 transition-all cursor-pointer",
                        isExpanded
                          ? "border-emerald-500/30 bg-zinc-900"
                          : "hover:border-zinc-700 hover:bg-zinc-900"
                      )}
                      onClick={() =>
                        onExpandedCardChange(isExpanded ? null : card.id)
                      }
                    >
                      <CardContent className="pt-5 pb-4">
                        <div className="flex items-start justify-between gap-2 mb-3">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <Badge
                              variant="secondary"
                              className="bg-zinc-800 text-zinc-400 text-[10px]"
                            >
                              D{card.domain}
                            </Badge>
                            <Badge
                              variant="secondary"
                              className={cn(
                                "text-[10px] capitalize",
                                getDifficultyClasses(card.difficulty)
                              )}
                            >
                              {card.difficulty}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Badge
                              variant="secondary"
                              className={cn("text-[10px]", cardStatus.className)}
                            >
                              {cardStatus.label}
                            </Badge>
                            {isExpanded ? (
                              <ChevronUp className="h-3.5 w-3.5 text-zinc-500" />
                            ) : (
                              <ChevronDown className="h-3.5 w-3.5 text-zinc-500" />
                            )}
                          </div>
                        </div>

                        <p
                          className={cn(
                            "text-sm font-medium text-zinc-300 leading-relaxed",
                            !isExpanded && "line-clamp-2"
                          )}
                        >
                          {card.question}
                        </p>

                        {isExpanded && (
                          <div className="mt-4 pt-4 border-t border-zinc-800 space-y-3">
                            <div>
                              <p className="text-[10px] font-semibold text-emerald-400 uppercase tracking-wider mb-1.5">
                                Answer
                              </p>
                              <p className="text-xs text-zinc-300 leading-relaxed whitespace-pre-line">
                                {card.answer}
                              </p>
                            </div>
                            <div>
                              <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-1.5">
                                Explanation
                              </p>
                              <p className="text-xs text-zinc-500 leading-relaxed whitespace-pre-line">
                                {card.explanation}
                              </p>
                            </div>
                            {card.sourceUrl && (
                              <a
                                href={card.sourceUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-xs text-emerald-500/70 hover:text-emerald-400 transition-colors"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <ExternalLink className="h-3 w-3" />
                                Source
                              </a>
                            )}
                            {cardProg && (
                              <div className="flex items-center gap-3 text-[10px] text-zinc-600 pt-1">
                                <span>Ease: {cardProg.ease.toFixed(2)}</span>
                                <span>Interval: {cardProg.interval}d</span>
                                <span>
                                  Next: {formatRelativeDate(cardProg.nextReview)}
                                </span>
                              </div>
                            )}
                          </div>
                        )}

                        {!isExpanded && (
                          <div className="flex items-center gap-1 mt-3 text-xs text-zinc-600">
                            <ArrowRight className="h-3 w-3" />
                            <span>Click to expand</span>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </Tabs>
    </div>
  );
}
