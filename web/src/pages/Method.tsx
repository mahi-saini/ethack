export default function Method() {
  return (
    <div className="page">
      <section className="method-hero">
        <img className="method-mark" src="/green_liquid_logo.png" alt="Green Liquid mark" />
        <div>
          <p className="kicker">How it works</p>
          <h1>The recipe. Not the lecture.</h1>
          <p className="lede">
            No walls of text. Just <strong>how the juice gets made</strong> — and what we will <em>not</em> pretend.
          </p>
        </div>
      </section>

      <div className="recipe" aria-label="The Green Liquid recipe">
        <span>📄 Read the 10-K</span>
        <span className="arrow" aria-hidden="true">→</span>
        <span>⚖️ Vs the industry</span>
        <span className="arrow" aria-hidden="true">→</span>
        <span>🙊 Catch the gap</span>
        <span className="arrow" aria-hidden="true">→</span>
        <span>🎛️ You set the mix</span>
      </div>

      <div className="fun-grid">
        <article className="fun-card">
          <div className="emoji" aria-hidden="true">🌱</div>
          <h3>What “good” means</h3>
          <ul>
            <li><strong>Planet</strong> — do they treat the Earth carefully?</li>
            <li><strong>People</strong> — do they treat humans fairly?</li>
            <li><strong>Money</strong> — can they <em>afford</em> to keep the promise?</li>
            <li><strong>Trust</strong> — who’s in charge, and can we believe them?</li>
            <li>That’s <strong>ESEG</strong>. Not a mystery acronym.</li>
          </ul>
        </article>

        <article className="fun-card">
          <div className="emoji" aria-hidden="true">📚</div>
          <h3>The homework</h3>
          <ul>
            <li>Every S&amp;P 500 company files a <strong>10-K</strong>.</li>
            <li>Public. Yearly. Legally serious.</li>
            <li>We pulled the sustainability passages — then scored <strong>21 everyday factors</strong>.</li>
            <li><em>Got real carbon numbers later?</em> Drop them in. The app stays.</li>
          </ul>
        </article>

        <article className="fun-card">
          <div className="emoji" aria-hidden="true">📊</div>
          <h3>How a score is born</h3>
          <ul>
            <li><strong>50</strong> = typical for <em>this</em> industry</li>
            <li><strong>80</strong> = clearly ahead 🏁</li>
            <li><strong>20</strong> = clearly behind</li>
            <li>Under the hood: a <strong>z-score</strong> vs sector peers, shown as a percentile.</li>
            <li>A steel mill is <em>not</em> scored like a software firm.</li>
          </ul>
        </article>

        <article className="fun-card">
          <div className="emoji" aria-hidden="true">⭐</div>
          <h3>The ideal company</h3>
          <ul>
            <li>There is no one perfect firm.</li>
            <li>Each sector gets a <strong>north star</strong> — the 90th percentile on every factor.</li>
            <li>Distance to that silhouette = how far they still have to go.</li>
            <li><em>Against their actual neighbors.</em></li>
          </ul>
        </article>

        <article className="fun-card">
          <div className="emoji" aria-hidden="true">🙊</div>
          <h3>Say vs do</h3>
          <ul>
            <li><strong>Say:</strong> “we will,” “net-zero by 2050,” “committed to…”</li>
            <li><strong>Do:</strong> “we reduced,” “achieved,” “bought renewable power.”</li>
            <li>A wide gap = 🚩 <em>talking louder than acting</em>.</li>
            <li>A warning. Not a moral verdict.</li>
          </ul>
        </article>

        <article className="fun-card">
          <div className="emoji" aria-hidden="true">🤫</div>
          <h3>Silence is a score</h3>
          <ul>
            <li>Missing answers get a <strong>negative mark</strong>.</li>
            <li>We do <em>not</em> give anyone the benefit of the doubt.</li>
            <li>If peers disclose it and you don’t — that is part of the job.</li>
            <li>Transparency is not extra credit. ✅</li>
          </ul>
        </article>

        <article className="fun-card">
          <div className="emoji" aria-hidden="true">🎚️</div>
          <h3>Your mix</h3>
          <ul>
            <li>Everyone starts <strong>25 / 25 / 25 / 25</strong>.</li>
            <li>Turn up Planet. Or People. Or Money. Or Trust.</li>
            <li>The ranking <em>should</em> change with you.</li>
            <li>A pension fund and a climate campaigner do not have to agree.</li>
          </ul>
        </article>

        <article className="fun-card">
          <div className="emoji" aria-hidden="true">🧮</div>
          <h3>The calculator</h3>
          <ul>
            <li>Ask in your own words. The <strong>numbers never invent themselves</strong>.</li>
            <li>It only reads the <em>same scores</em> as the rest of the site.</li>
            <li>Try the $1 billion net-zero split. 💸</li>
            <li>Not a chatbot. Arithmetic you can check.</li>
          </ul>
        </article>

        <article className="fun-card">
          <div className="emoji" aria-hidden="true">🚧</div>
          <h3>Limits we’ll say out loud</h3>
          <ul>
            <li>10-Ks are written by <em>lawyers</em>.</li>
            <li>More words ≠ more impact.</li>
            <li>This is a public score first, a portfolio second.</li>
            <li><strong>Not investment advice.</strong> A map. 🗺️</li>
          </ul>
        </article>
      </div>
    </div>
  );
}
