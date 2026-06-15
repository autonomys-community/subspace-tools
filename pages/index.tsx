import Link from 'next/link'
import { NAV_SECTIONS } from '../config/navigation'

export default function Home() {
  return (
    <div className="container py-5">
      <div className="mb-5">
        <h1 className="fw-bold mb-2" style={{ letterSpacing: '-0.02em' }}>
          Subspace Tools
        </h1>
        <p className="fs-5 text-secondary mb-0">
          A collection of tools for working with the Autonomys Network and ecosystem.
        </p>
      </div>

      {NAV_SECTIONS.map((section) => (
        <section key={section.label} className="mb-5">
          <h2 className="section-eyebrow mb-3">{section.label}</h2>
          <div className="row g-3">
            {section.items.map((item) => (
              <div key={item.href} className="col-12 col-md-6 col-lg-4">
                <Link href={item.href} className="tool-card">
                  <div className="tool-card__title">{item.label}</div>
                  <p className="tool-card__desc">{item.description}</p>
                </Link>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
