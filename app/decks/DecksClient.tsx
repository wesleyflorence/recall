'use client';

import { useState } from 'react';

const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

type DeckCardRow = {
  id: number;
  question: string;
  rubric: string;
  referenceAnswer: string | null;
  difficultyHint: string | null;
  createdAt: string;
};

type DeckRow = {
  id: number;
  name: string;
  description: string | null;
  sourceMaterial: string | null;
  createdAt: string;
  cards: DeckCardRow[];
};

type DeckApiPayload = {
  id: number;
  name: string;
  description: string | null;
  sourceMaterial: string | null;
  createdAt: string;
  cards: DeckCardRow[];
  _count?: {
    cards: number;
  };
};

type DeckApiCardsResponse = DeckApiPayload[];

type GenerateApiResponse = {
  error?: string;
  cards?: DeckCardRow[];
};

type ImportResponse = {
  error?: string;
  deckId?: number;
};

type DecksClientProps = {
  initialDecks: DeckRow[];
};

function normalizeDecksFromApi(payload: DeckApiCardsResponse): DeckRow[] {
  return payload.map((deck) => ({
    id: deck.id,
    name: deck.name,
    description: deck.description,
    sourceMaterial: deck.sourceMaterial,
    createdAt: deck.createdAt,
    cards: deck.cards,
  }));
}

function getCountForDeck(countByDeck: Record<number, number>, deckId: number) {
  const count = Number.isFinite(countByDeck[deckId]) ? countByDeck[deckId] : 5;
  return Math.max(1, Math.min(20, Math.floor(count)));
}

export default function DecksClient({ initialDecks }: DecksClientProps) {
  const [decks, setDecks] = useState<DeckRow[]>(initialDecks);
  const [deckName, setDeckName] = useState('');
  const [deckDescription, setDeckDescription] = useState('');
  const [sourceMaterial, setSourceMaterial] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [importText, setImportText] = useState('');
  const [actionDeckId, setActionDeckId] = useState<number | null>(null);
  const [generatingCountByDeck, setGeneratingCountByDeck] = useState<Record<number, number>>({});
  const [importing, setImporting] = useState(false);

  const refreshDecks = async () => {
    const response = await fetch(`${BASE}/api/decks`, { cache: 'no-store' });
    const payload = (await response.json()) as DeckApiCardsResponse;
    if (!response.ok) {
      throw new Error('Failed to load decks');
    }

    setDecks(normalizeDecksFromApi(payload));
  };

  const handleCreateDeck = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!deckName.trim()) {
      setError('Deck topic is required');
      return;
    }

    setCreating(true);
    setError('');

    try {
      const response = await fetch(`${BASE}/api/decks`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          name: deckName.trim(),
          description: deckDescription.trim() || null,
          sourceMaterial: sourceMaterial.trim() || null,
        }),
      });

      const created = (await response.json()) as {
        error?: string;
      };

      if (!response.ok) {
        setError(created?.error ?? 'Failed to create deck');
        return;
      }

      setDeckName('');
      setDeckDescription('');
      setSourceMaterial('');
      await refreshDecks();
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'Failed to create deck');
    } finally {
      setCreating(false);
    }
  };

  const handleGenerate = async (deckId: number) => {
    const count = getCountForDeck(generatingCountByDeck, deckId);
    setActionDeckId(deckId);
    setError('');

    try {
      const response = await fetch(`${BASE}/api/decks/${deckId}/generate`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({ count }),
      });

      const payload = (await response.json()) as GenerateApiResponse;
      if (!response.ok) {
        setError(payload.error ?? 'Generation failed');
        return;
      }

      if (!payload.cards || payload.cards.length === 0) {
        setError('No cards were generated');
        return;
      }

      await refreshDecks();
    } catch (generateError) {
      setError(generateError instanceof Error ? generateError.message : 'Generation failed');
    } finally {
      setActionDeckId(null);
    }
  };

  const handleImportDeck = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!importText.trim()) {
      setError('Deck JSON is required');
      return;
    }

    setImporting(true);
    setError('');

    try {
      const response = await fetch(`${BASE}/api/decks/import`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: importText,
      });

      const payload = (await response.json()) as ImportResponse;
      if (!response.ok) {
        setError(payload.error ?? 'Deck import failed');
        return;
      }

      setImportText('');
      await refreshDecks();
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : 'Deck import failed');
    } finally {
      setImporting(false);
    }
  };

  const handleGenerateCountChange = (deckId: number, value: string) => {
    const parsed = Number.parseInt(value, 10);
    if (!Number.isFinite(parsed)) {
      return;
    }

    setGeneratingCountByDeck((previous) => ({
      ...previous,
      [deckId]: Math.max(1, Math.min(20, parsed)),
    }));
  };

  return (
    <>
      <section className="card">
        <form className="stack" onSubmit={handleCreateDeck}>
          <h2 className="subtitle">New deck</h2>
          <label className="field">
            <span>Topic</span>
            <input
              className="input"
              placeholder="e.g. Music Theory"
              value={deckName}
              onChange={(event) => setDeckName(event.target.value)}
            />
          </label>
          <label className="field">
            <span>Description</span>
            <input
              className="input"
              placeholder="Optional notes"
              value={deckDescription}
              onChange={(event) => setDeckDescription(event.target.value)}
            />
          </label>
          <label className="field">
            <span>Source material</span>
            <textarea
              className="textarea"
              rows={4}
              placeholder="Paste article, notes, or raw material for card generation."
              value={sourceMaterial}
              onChange={(event) => setSourceMaterial(event.target.value)}
            />
          </label>
          <div className="inline-actions">
            <button className="btn btn-primary" type="submit" disabled={creating}>
              {creating ? 'Creating…' : 'Create deck'}
            </button>
          </div>
          {error ? <p className="error">{error}</p> : null}
        </form>
      </section>

      <section className="card">
        <h2 className="subtitle">Your decks</h2>
        <details>
          <summary>Import deck JSON</summary>
          <form className="stack" onSubmit={handleImportDeck} style={{ padding: '12px' }}>
            <label className="field">
              <span>Deck export JSON</span>
              <textarea
                className="textarea"
                rows={5}
                placeholder='{"name":"...","cards":[...]}'
                value={importText}
                onChange={(event) => setImportText(event.target.value)}
              />
            </label>
            <div className="inline-actions">
              <button className="btn btn-secondary" type="submit" disabled={importing}>
                {importing ? 'Importing…' : 'Import deck'}
              </button>
            </div>
          </form>
        </details>

        {decks.length === 0 ? (
          <p className="muted">No decks yet. Create one above.</p>
        ) : (
          decks.map((deck) => (
            <article className="deck-card" key={deck.id}>
              <div className="deck-card-head">
                <div>
                  <h3>{deck.name}</h3>
                  <p className="muted">{deck.description ?? 'No description'}</p>
                  <p className="muted" style={{ marginTop: '2px' }}>
                    Created {new Date(deck.createdAt).toLocaleDateString()} · {deck.cards.length} cards
                  </p>
                </div>
                <div className="inline-actions">
                  <label className="inline-field">
                    <span>Count</span>
                    <input
                      type="number"
                      min={1}
                      max={20}
                      className="input input-small"
                      value={generatingCountByDeck[deck.id] ?? 5}
                      onChange={(event) => handleGenerateCountChange(deck.id, event.target.value)}
                    />
                  </label>
                  <button
                    className="btn btn-secondary"
                    type="button"
                    disabled={actionDeckId === deck.id}
                    onClick={() => void handleGenerate(deck.id)}
                  >
                    {actionDeckId === deck.id ? 'Generating…' : 'Generate cards'}
                  </button>
                  <a href={`${BASE}/api/decks/${deck.id}/export`} className="btn btn-secondary" download>
                    Export
                  </a>
                </div>
              </div>

              {deck.sourceMaterial ? (
                <details>
                  <summary>Source material</summary>
                  <p className="muted" style={{ whiteSpace: 'pre-wrap' }}>
                    {deck.sourceMaterial}
                  </p>
                </details>
              ) : null}

              <h4>Cards ({deck.cards.length})</h4>
              {deck.cards.length === 0 ? (
                <p className="muted" style={{ padding: '0 16px 12px' }}>No cards yet — generate some above.</p>
              ) : (
                <ul className="card-list">
                  {deck.cards.map((card) => (
                    <li className="card-list-item" key={card.id}>
                      <p className="strong">{card.question}</p>
                      <p className="muted">Rubric: {card.rubric}</p>
                    </li>
                  ))}
                </ul>
              )}
            </article>
          ))
        )}
      </section>
    </>
  );
}
