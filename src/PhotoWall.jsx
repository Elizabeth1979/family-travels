import React from 'react';

const TYPE_LABELS = { travel: 'Travel', event: 'Event' };

// Deterministic soft background for albums that have no cover image, so the
// wall shows a labelled colored tile instead of a broken image. (Nothing is
// hidden — empty-album filtering is intentionally out of scope.)
const PLACEHOLDER_COLORS = ['#4aa3b5', '#d68c45', '#6c7a89', '#9b6a8f', '#5a8f69'];

function placeholderColor(seed) {
    let h = 0;
    for (let i = 0; i < seed.length; i++) {
        h = (h * 31 + seed.charCodeAt(i)) >>> 0;
    }
    return PLACEHOLDER_COLORS[h % PLACEHOLDER_COLORS.length];
}

function Tile({ card }) {
    const type = (card.type || 'travel').toLowerCase();
    const badgeLabel = TYPE_LABELS[type] || TYPE_LABELS.travel;
    const isEvent = type === 'event';

    return (
        <a className="pw-tile" href={card.url} aria-label={`Open album ${card.title}`}>
            {card.cover ? (
                <img
                    className="pw-img"
                    src={card.cover}
                    alt={card.alt || card.title || ''}
                    loading="lazy"
                />
            ) : (
                <div
                    className="pw-placeholder"
                    style={{ background: placeholderColor(card.title || card.id || '') }}
                >
                    <span>{card.title}</span>
                </div>
            )}
            <span className={`pw-badge ${isEvent ? 'pw-badge-event' : ''}`}>{badgeLabel}</span>
            <div className="pw-caption">
                <b>{card.title}</b>
                {card.date ? <span>{card.date}</span> : null}
            </div>
        </a>
    );
}

export default function PhotoWall({ cards }) {
    if (!cards || cards.length === 0) {
        return <div className="pw-empty">No albums to show yet.</div>;
    }
    return (
        <div className="pw-scroll">
            <div className="pw-wall">
                {cards.map((card) => (
                    <Tile key={card.id} card={card} />
                ))}
            </div>
        </div>
    );
}
