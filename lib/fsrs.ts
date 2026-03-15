import { createEmptyCard, fsrs, Rating, type Card as FsrsCard } from 'ts-fsrs';

type FsrsStateInput = {
  stability: number;
  difficulty: number;
  due: Date;
  lastReview: Date | null;
  interval: number | null;
  reps: number;
  lapses: number;
  state: number;
};

export type FsrsStatePersisted = FsrsStateInput;

const scheduler = fsrs();

function toPersistedCardState(card: FsrsCard): FsrsStatePersisted {
  return {
    stability: card.stability,
    difficulty: card.difficulty,
    due: card.due,
    lastReview: card.last_review ?? null,
    interval: card.scheduled_days,
    reps: card.reps,
    lapses: card.lapses,
    state: card.state,
  };
}

export function getInitialCardState(now: Date = new Date()): FsrsStatePersisted {
  return toPersistedCardState(createEmptyCard(now));
}

function mapGradeToRating(value: number): Rating {
  const clamped = Math.max(0, Math.min(1, value));

  if (clamped < 0.3) {
    return Rating.Again;
  }
  if (clamped < 0.5) {
    return Rating.Hard;
  }
  if (clamped < 0.8) {
    return Rating.Good;
  }

  return Rating.Easy;
}

export function mapLlmsGradeToFsrsRating(value: number): number {
  return mapGradeToRating(value);
}

function toFsrsCard(state: FsrsStateInput): FsrsCard {
  const base = createEmptyCard(state.due);

  return {
    ...base,
    stability: state.stability,
    difficulty: state.difficulty,
    due: state.due,
    reps: state.reps,
    lapses: state.lapses,
    state: state.state,
    last_review: state.lastReview ?? undefined,
    scheduled_days: state.interval ?? 0,
  };
}

export function nextDueDateFromGrade(
  currentState: FsrsStateInput,
  llmGrade: number,
  now: Date = new Date(),
): FsrsStatePersisted {
  const card = toFsrsCard(currentState);
  const grade = mapGradeToRating(llmGrade);
  const repeated = scheduler.next(card, now, grade as Exclude<Rating, Rating.Manual>);

  return toPersistedCardState(repeated.card);
}
