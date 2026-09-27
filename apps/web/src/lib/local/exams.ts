import { blueprint, exams } from "./catalog";
type Question = (typeof exams)[number]["questions"][number];
export function questionsFor(id: string, domain?: string) {
    const exam = exams.find(item => item.examId === id);
    if (!exam && id !== "domain-quiz")
        return null;
    const pool = exam?.questions ?? exams.flatMap(item => item.questions).filter((question, index, all) => all.findIndex(item => item.id === question.id) === index);
    const chosen = blueprint.domains.find(item => item.slug === domain);
    const questions = chosen ? pool.filter(question => question.objectiveCode.startsWith(`${chosen.number}.`)) : pool;
    return { id, title: exam?.title ?? `${chosen?.name ?? "Domain"} Quiz`, description: exam?.description ?? "Focused quiz combining the bundled practice exams.", timeLimit: exam?.timeLimit ?? 25, questions, totalQuestions: questions.length };
}
export function publicExam(id: string, domain?: string) {
    const exam = questionsFor(id, domain);
    if (!exam)
        return null;
    return { ...exam, questions: exam.questions.map(question => ({ id: question.id, type: question.type, text: question.question, objective: question.objectiveCode, options: question.options, difficulty: question.difficulty, tags: question.tags, sourceUrl: question.sourceUrl })) };
}
export function gradeAnswer(question: Pick<Question, "type" | "correctAnswer">, answer: string | string[] | null) {
    if (answer === null)
        return false;
    const normalize = (value: string) => value.trim().toLocaleLowerCase("en-US");
    if (question.type === "multiple_select" || question.type === "drag_and_drop") {
        if (!Array.isArray(answer) || !Array.isArray(question.correctAnswer))
            return false;
        const user = answer.map(normalize), key = question.correctAnswer.map(normalize);
        const orderedUser = question.type === "multiple_select" ? [...user].sort() : user;
        const orderedKey = question.type === "multiple_select" ? [...key].sort() : key;
        return orderedUser.length === orderedKey.length && orderedUser.every((value, index) => value === orderedKey[index]);
    }
    return typeof answer === "string" && typeof question.correctAnswer === "string" && normalize(answer) === normalize(question.correctAnswer);
}
export function gradeExam(id: string, answers: Record<string, string | string[]>, timeTaken: number, domain?: string) {
    const exam = questionsFor(id, domain);
    if (!exam)
        return null;
    const questionResults = exam.questions.map(question => ({ questionId: question.id, text: question.question, correct: gradeAnswer(question, answers[question.id] ?? null), userAnswer: answers[question.id] ?? null, correctAnswer: question.correctAnswer, explanation: question.explanation }));
    const totalCorrect = questionResults.filter(result => result.correct).length;
    const domainBreakdown = blueprint.domains.map(item => {
        const results = questionResults.filter((_, index) => exam.questions[index].objectiveCode.startsWith(`${item.number}.`));
        const correct = results.filter(result => result.correct).length;
        return { domain: item.name, correct, total: results.length, percentage: results.length ? Math.round(correct / results.length * 100) : 0 };
    }).filter(item => item.total > 0);
    const score = exam.totalQuestions ? Math.round(totalCorrect / exam.totalQuestions * 100) : 0;
    return { score, totalQuestions: exam.totalQuestions, totalCorrect, passed: score >= 70, timeTaken, questionResults, domainBreakdown };
}
