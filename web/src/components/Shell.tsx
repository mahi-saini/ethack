import { NavLink, Outlet } from "react-router-dom";

const links = [
  ["/", "Home"],
  ["/explore", "Explore"],
  ["/rankings", "Rankings"],
  ["/compare", "Compare"],
  ["/studio", "Charts"],
  ["/net-zero", "Net-zero"],
  ["/advisor", "Calculator"],
  ["/method", "How it works"],
] as const;

export default function Shell() {
  return (
    <>
      <a className="skip" href="#main">
        Skip to content
      </a>
      <header className="shell-header">
        <NavLink to="/" className="brand">
          <img className="brand-logo" src="/green_liquid_logo.png" alt="" />
          Green Liquid
        </NavLink>
        <nav className="nav" aria-label="Main">
          {links.map(([to, label]) => (
            <NavLink key={to} to={to} end={to === "/"}>
              {label}
            </NavLink>
          ))}
        </nav>
      </header>
      <main id="main">
        <Outlet />
      </main>
      <footer className="footer">
        Green Liquid reads 10-K filings, Net Zero Tracker, SBTi, Climate TRACE, and CA100. Silence is treated as a
        risk. This is a research tool, not investment advice.
      </footer>
    </>
  );
}
