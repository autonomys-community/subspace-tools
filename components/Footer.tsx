// Site footer: brand line plus external links. Fills the empty page bottom
// and gives every page a consistent close.
export default function Footer() {
  return (
    <footer className="site-footer mt-5">
      <div className="container d-flex flex-column flex-sm-row justify-content-between align-items-center gap-2 py-4">
        <span>Subspace Tools — community tools for the Autonomys Network.</span>
        <nav className="d-flex gap-3">
          <a href="https://github.com/autonomys-community/subspace-tools" target="_blank" rel="noopener noreferrer">
            GitHub
          </a>
          <a href="https://autonomys.xyz" target="_blank" rel="noopener noreferrer">
            Autonomys
          </a>
          <a href="https://develop.autonomys.xyz" target="_blank" rel="noopener noreferrer">
            Docs
          </a>
        </nav>
      </div>
    </footer>
  );
}
