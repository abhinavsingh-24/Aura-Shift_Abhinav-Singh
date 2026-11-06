import { useState } from 'react';
import { answerAdventureQuestion } from '../lib/adventureAssistant';

const SUGGESTED_PROMPTS = [
  'Find live music this weekend',
  'Suggest a technology event or hackathon',
  'Help me plan something affordable or free',
  'Show me something happening in Bengaluru',
  'Cultural and art events in Mumbai',
  'What sports and outdoor sessions are upcoming?',
];

export default function AdventureAssistantPage({
  allEvents = [],
  selectedInterests = [],
  selectedCity = '',
  savedQuestIds = [],
  onViewDetails,
  assistantMessages = [],
  setAssistantMessages,
  setToast,
}) {
  const [draft, setDraft] = useState('');

  const handleAsk = (promptText) => {
    const prompt = (promptText || draft).trim();
    if (!prompt) return;

    const answer = answerAdventureQuestion(prompt, allEvents, {
      interests: selectedInterests,
      city: selectedCity,
      savedIds: savedQuestIds,
      now: new Date(),
    });

    if (setAssistantMessages) {
      setAssistantMessages((current) => [
        ...current,
        { id: `u-${Date.now()}`, role: 'user', text: prompt },
        { id: `a-${Date.now() + 1}`, role: 'assistant', text: answer.text, events: answer.events },
      ].slice(-30));
    }
    setDraft('');
  };

  const clearChat = () => {
    if (setAssistantMessages) {
      setAssistantMessages([]);
    }
    if (setToast) {
      setToast('Your local assistant conversation was cleared.');
    }
  };

  return (
    <section className="panel feature-panel assistant-panel" aria-labelledby="assistant-heading">
      <div className="section-heading">
        <div>
          <span className="eyebrow">Adventure Assistant</span>
          <h2 id="assistant-heading">Plan a little adventure.</h2>
          <p className="small-copy">
            Ask for ideas, compare upcoming quests, or get a starting point for a day out.
            Uses a transparent local matching engine over SIDEQUEST verified events across India.
          </p>
        </div>
        <span className="feature-emblem" aria-hidden="true">✧</span>
      </div>

      <div className="assistant-disclaimer">
        <strong>Explorer note:</strong> Recommendations depend on verified event details currently available.
        Check dates, venues, and ticket passes before heading out.
      </div>

      <div className="assistant-prompts" aria-label="Suggested questions">
        {SUGGESTED_PROMPTS.map((prompt) => (
          <button
            type="button"
            className="interest-chip"
            key={prompt}
            onClick={() => {
              setDraft(prompt);
              handleAsk(prompt);
            }}
          >
            {prompt}
          </button>
        ))}
      </div>

      <div className="assistant-thread" aria-live="polite">
        {assistantMessages.length ? (
          assistantMessages.map((message) => (
            <article
              className={`assistant-message ${message.role === 'user' ? 'from-user' : 'from-guide'}`}
              key={message.id}
            >
              <span>{message.role === 'user' ? 'YOU' : 'SIDEQUEST GUIDE'}</span>
              <p style={{ whiteSpace: 'pre-line' }}>{message.text}</p>
              {message.events?.length ? (
                <div className="assistant-event-links">
                  {message.events.map((event) => (
                    <button
                      type="button"
                      className="secondary-btn btn-sm"
                      key={event.id}
                      onClick={() => onViewDetails?.(event)}
                    >
                      View {event.title}
                    </button>
                  ))}
                </div>
              ) : null}
            </article>
          ))
        ) : (
          <div className="empty-state">
            <strong>Your guide is ready.</strong>
            <br />
            Ask about indie concerts, developer summits, college festivals, or open weekend meetups across India.
          </div>
        )}
      </div>

      <form
        className="assistant-compose"
        onSubmit={(event) => {
          event.preventDefault();
          handleAsk();
        }}
      >
        <label htmlFor="adventure-assistant-input">What are you in the mood for?</label>
        <textarea
          id="adventure-assistant-input"
          rows="3"
          maxLength="500"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="e.g. Find a tech meetup or music gig in Bengaluru this weekend…"
        />
        <div className="chat-compose-footer">
          <small>{draft.length}/500 · Stored locally on this device</small>
          <button className="primary-btn" type="submit" disabled={!draft.trim()}>
            Ask the guide
          </button>
        </div>
      </form>

      {assistantMessages.length > 0 && (
        <div style={{ marginTop: '1rem', textAlign: 'right' }}>
          <button type="button" className="secondary-btn btn-sm" onClick={clearChat}>
            Clear conversation
          </button>
        </div>
      )}
    </section>
  );
}
