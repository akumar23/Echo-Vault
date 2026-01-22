'use client'

const testimonials = [
  {
    quote:
      "Finally, a journal app that doesn't want to harvest my data. The AI reflections are surprisingly thoughtful, and knowing it all runs locally gives me peace of mind.",
    author: 'Sarah M.',
    role: 'Daily Journaler',
    initials: 'SM',
  },
  {
    quote:
      "I recommend EchoVault to clients who want to maintain a reflective practice. The privacy-first approach means I don't have to worry about their sensitive thoughts being stored in some cloud.",
    author: 'Dr. James Chen',
    role: 'Therapist',
    initials: 'JC',
  },
  {
    quote:
      "The semantic search is a game-changer. I can find entries by meaning, not just keywords. It's like having a conversation with my past self.",
    author: 'Alex K.',
    role: 'Software Engineer',
    initials: 'AK',
  },
]

export function Testimonials() {
  return (
    <section className="testimonials" id="testimonials">
      <div className="testimonials__header">
        <span className="testimonials__badge">Early Users</span>
        <h2 className="testimonials__title">What people are saying</h2>
      </div>

      <div className="testimonials__grid">
        {testimonials.map((testimonial) => (
          <div key={testimonial.author} className="testimonial-card">
            <blockquote className="testimonial-card__quote">
              &ldquo;{testimonial.quote}&rdquo;
            </blockquote>
            <div className="testimonial-card__author">
              <div className="testimonial-card__avatar">{testimonial.initials}</div>
              <div className="testimonial-card__info">
                <span className="testimonial-card__name">{testimonial.author}</span>
                <span className="testimonial-card__role">{testimonial.role}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
