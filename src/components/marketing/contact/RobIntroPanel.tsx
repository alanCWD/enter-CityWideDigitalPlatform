/**
 * Rob@ intro panel — first card in the contact page's left column.
 *
 * Source: `cwd-contact-intro.html` supplied by the Rob@ app. Styles live in
 * `src/styles/glass-theme.css` under the `.cwd-intro` scope so the markup here
 * stays plain. The image is served from the site's own `public/` folder.
 */
export function RobIntroPanel() {
  return (
    <section className="cwd-intro" aria-labelledby="cwd-intro-title">
      <div className="cwd-intro__media">
        <img
          className="cwd-intro__image"
          src="/rob-at-panel.jpg"
          alt="Rob@, CityWide Digital's chrome helpbot, lit by two amber eyes"
          width={640}
          height={512}
          loading="eager"
          decoding="async"
        />
        <div className="cwd-intro__shade" aria-hidden="true" />
        <p className="cwd-intro__status">
          <span className="cwd-intro__dot" aria-hidden="true" />
          Rob@ · on shift 24/7
        </p>
      </div>

      <div className="cwd-intro__body">
        <p className="cwd-intro__eyebrow">01 — First contact</p>
        <h2 className="cwd-intro__title" id="cwd-intro-title">
          Tell Rob@
          <br />
          what&rsquo;s broken.
        </h2>
        <p className="cwd-intro__sub">He&rsquo;ll handle the #@!! paperwork.</p>
        <p className="cwd-intro__copy">
          CityWide Digital keeps your business findable — a Google-synced website, accurate listings,
          active social, reviews on autopilot. Rob@ takes first contact, answers the awkward questions,
          and writes the brief so the crew never asks you to repeat yourself.
        </p>

        <div className="cwd-intro__actions">
          <a className="cwd-intro__button" href="#intake" data-cwd-cta="intro-start">
            Start the conversation
            <svg viewBox="0 0 16 16" width="16" height="16" fill="none" aria-hidden="true">
              <path
                d="M2.5 8h10M9 4.5 12.5 8 9 11.5"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </a>
          <a
            className="cwd-intro__button cwd-intro__button--ghost"
            href="https://calendly.com/alan-citywidedigital/30min"
            target="_blank"
            rel="noreferrer"
            data-cwd-cta="intro-book"
          >
            Book a discovery call
            <svg viewBox="0 0 16 16" width="16" height="16" fill="none" aria-hidden="true">
              <path
                d="M5 11 11 5M6 5h5v5"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </a>
        </div>

        <p className="cwd-intro__note">
          30-day trial · no card · Rob@ is an AI assistant; a human reviews every brief.
        </p>
      </div>
    </section>
  );
}
