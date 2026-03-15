'use client';

import { useEffect, useRef, useState } from 'react';

const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? '';
import Link from 'next/link';
import MarkdownText from '@/components/MarkdownText';

type ReviewCard = {
  cardId: number;
  card: {
    id: number;
    deckId: number;
    deckName: string;
    question: string;
    rubric: string;
    referenceAnswer: string | null;
    difficultyHint: string | null;
  };
};

type NextPayload = {
  cards: ReviewCard[];
};

type ReviewResult = {
  review: {
    llmGrade: number;
    llmFeedback: string | null;
  };
};

type ApiError = {
  error?: string;
};

type SpeechLike = {
  start: () => void;
  stop: () => void;
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: null | ((event: unknown) => void);
  onend: null | (() => void);
  onerror: null | ((event: unknown) => void);
};

type SpeechRecognitionCtor = new () => SpeechLike;

export default function ReviewClient() {
  const [card, setCard] = useState<ReviewCard | null>(null);
  const [responseText, setResponseText] = useState('');
  const [loadingCard, setLoadingCard] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<ReviewResult['review'] | null>(null);
  const [error, setError] = useState('');
  const [noCardDue, setNoCardDue] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const [recording, setRecording] = useState(false);
  const recognitionRef = useRef<SpeechLike | null>(null);
  const recognitionCtorRef = useRef<SpeechRecognitionCtor | null>(null);

  const resetResultState = () => {
    setFeedback(null);
    setError('');
    setResponseText('');
  };

  useEffect(() => {
    const AnyWindow = window as {
      SpeechRecognition?: SpeechRecognitionCtor;
      webkitSpeechRecognition?: SpeechRecognitionCtor;
    };

    const ctor = AnyWindow.SpeechRecognition ?? AnyWindow.webkitSpeechRecognition;
    if (typeof ctor === 'function') {
      recognitionCtorRef.current = ctor;
      setSpeechSupported(true);
    }
  }, []);

  const loadNextCard = async () => {
    setLoadingCard(true);
    setNoCardDue(false);
    resetResultState();

    try {
      const response = await fetch(`${BASE}/api/reviews/next?limit=1`, { cache: 'no-store' });
      const payload = (await response.json()) as NextPayload | ApiError;

      if (!response.ok) {
        setError((payload as ApiError).error ?? 'Failed to load review card');
        setCard(null);
        return;
      }

      const nextCard = Array.isArray((payload as NextPayload).cards) ? (payload as NextPayload).cards[0] : null;
      if (!nextCard) {
        setCard(null);
        setNoCardDue(true);
        return;
      }

      setCard(nextCard);
    } catch (nextError) {
      setCard(null);
      setError(nextError instanceof Error ? nextError.message : 'Failed to load review card');
    } finally {
      setLoadingCard(false);
    }
  };

  useEffect(() => {
    void loadNextCard();
  }, []);

  const getSpeechRecognition = (): SpeechLike | null => {
    if (!recognitionRef.current && recognitionCtorRef.current) {
      recognitionRef.current = new recognitionCtorRef.current();
    }
    return recognitionRef.current;
  };

  const startRecording = () => {
    const recognition = getSpeechRecognition();
    if (!recognition) {
      return;
    }

    recognition.lang = 'en-US';
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.onresult = (event: unknown) => {
      const recognitionEvent = event as {
        results: Array<{
          0: { transcript: string };
        }>;
      };

      const transcript = Array.from(recognitionEvent.results)
        .map((result) => result?.[0]?.transcript)
        .filter(Boolean)
        .join(' ')
        .trim();
      if (transcript) {
        setResponseText((previous) => `${previous ? `${previous} ` : ''}${transcript}`);
      }
    };
    recognition.onend = () => {
      setRecording(false);
    };
    recognition.onerror = () => {
      setRecording(false);
    };

    recognition.start();
    setRecording(true);
  };

  const stopRecording = () => {
    recognitionRef.current?.stop();
    setRecording(false);
  };

  const toggleRecording = () => {
    if (!speechSupported) {
      return;
    }
    if (recording) {
      stopRecording();
      return;
    }
    startRecording();
  };

  const submitResponse = async () => {
    if (submitting || !card || !responseText.trim()) {
      return;
    }

    setSubmitting(true);
      setError('');

    try {
      const response = await fetch(`${BASE}/api/reviews`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          cardId: card.cardId,
          responseText: responseText.trim(),
        }),
      });

      const payload = (await response.json()) as ReviewResult | ApiError;
      if (!response.ok) {
        setError((payload as ApiError).error ?? 'Failed to submit response');
        return;
      }

      setFeedback((payload as ReviewResult).review);
    } finally {
      setSubmitting(false);
    }
  };

  const onSubmitResponse = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await submitResponse();
  };

  const onSkipCard = async () => {
    stopRecording();
    await loadNextCard();
  };

  const handleKeyDown = async (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      await onSkipCard();
      return;
    }

    if (event.key === 'Enter' && !event.shiftKey && !event.ctrlKey && !event.metaKey && !event.altKey) {
      event.preventDefault();
      await submitResponse();
    }
  };

  return (
    <section className="card">
      <h1 className="title">Review Session</h1>

      {loadingCard ? (
        <p className="muted">Loading next card…</p>
      ) : error ? (
        <p className="error">{error}</p>
      ) : noCardDue ? (
        <div className="empty-state">
          <p className="muted">No cards are due right now.</p>
          <Link href="/decks" className="btn btn-secondary">
            Manage decks
          </Link>
        </div>
      ) : card ? (
        <div className="review-stack">
          <p className="muted">Deck: {card.card.deckName}</p>
          <h2 className="subtitle">
            <MarkdownText>{card.card.question}</MarkdownText>
          </h2>
          {card.card.difficultyHint ? (
            <p className="muted">{card.card.difficultyHint}</p>
          ) : null}

          <form className="stack" onSubmit={onSubmitResponse}>
            <label className="field">
              <span>Your answer</span>
              <textarea
                className="textarea"
                rows={6}
                value={responseText}
                onChange={(event) => setResponseText(event.target.value)}
                placeholder="Type your response here"
                onKeyDown={handleKeyDown}
              />
            </label>
            {speechSupported ? (
              <button
                type="button"
                className={`btn ${recording ? 'btn-destructive' : 'btn-secondary'}`}
                onClick={toggleRecording}
              >
                {recording ? 'Stop recording' : 'Start recording'}
              </button>
            ) : null}
            <button className="btn btn-primary" type="submit" disabled={submitting || !responseText.trim()}>
              {submitting ? 'Submitting…' : 'Submit'}
            </button>
          </form>

          {feedback ? (
            <article className="result-card">
              <p className="result-title">Result</p>
              <p>Grade: {(feedback.llmGrade * 100).toFixed(0)}%</p>
              <div className="muted">
                <MarkdownText>
                  {feedback.llmFeedback ?? 'No feedback provided.'}
                </MarkdownText>
              </div>
              <button className="btn btn-secondary" type="button" onClick={() => void loadNextCard()}>
                Next card
              </button>
              <p className="muted">Shortcuts: Enter = submit, Escape = skip.</p>
            </article>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
