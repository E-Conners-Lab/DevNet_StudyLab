import { blueprint, flashcards, labs, objectiveIds } from "./catalog";
import type { StudyProgress } from "./schema";
export function dashboardStats(state: StudyProgress) {
    const now = Date.now();
    const domains = blueprint.domains.map(domain => {
        const completed = domain.objectives.filter(objective => state.objectives.includes(objective.code)).length;
        const cards = flashcards.filter(card => card.domain === domain.number), domainLabs = labs.filter(lab => lab.domainSlug === domain.slug);
        return { number: domain.number, name: domain.name, slug: domain.slug, weight: domain.weight, progress: Math.round(completed / domain.objectives.length * 100), stats: { objectivesCompleted: completed, objectivesTotal: domain.objectives.length, flashcardsDue: cards.filter(card => !state.flashcards[card.id] || Date.parse(state.flashcards[card.id].nextReview) <= now).length, labsDone: domainLabs.filter(lab => state.labs[lab.slug]?.completed).length, labsTotal: domainLabs.length } };
    });
    const recentActivity = state.examAttempts.slice(0, 5).map(attempt => ({ type: "exam", text: `Practice exam: ${attempt.score}%`, time: attempt.completedAt }));
    return { domains, overallProgress: Math.round(state.objectives.length / objectiveIds.length * 100), bestExamScore: Math.max(0, ...state.examAttempts.map(attempt => attempt.score)), totalExamAttempts: state.examAttempts.length, recentActivity };
}
