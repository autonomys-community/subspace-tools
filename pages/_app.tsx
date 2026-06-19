import '../styles/theme.scss'
import { AppProps } from 'next/app'
import { Inter } from 'next/font/google'
import Head from 'next/head'
import Link from 'next/link'
import Breadcrumbs from '../components/Breadcrumbs'
import Footer from '../components/Footer'
import Logo from '../components/Logo'
import SiteNav from '../components/SiteNav'

const inter = Inter({ subsets: ['latin'], display: 'swap' })

export default function App({ Component, pageProps }: AppProps) {
  return (
    <div className={`${inter.className} d-flex flex-column min-vh-100`}>
      <Head>
        {/*
          Baseline defense-in-depth CSP. Only the directives that are safe to
          enforce from a static-export <meta> tag (no server, so no nonces):
          none of these govern script/style/connect, so hydration, Bootstrap,
          RPC/indexer calls, and wallet connect are unaffected.
          The high-value pieces — a connect-src allowlist and frame-ancestors
          (anti-clickjacking) — are deferred until Pages sits behind a CDN that
          can set real headers and a Report-Only rollout. See issue #30.
        */}
        <meta
          httpEquiv="Content-Security-Policy"
          content="object-src 'none'; base-uri 'self'; form-action 'self'"
        />
        <title>Subspace Tools</title>
        <meta name="description" content="A collection of tools for working with the Autonomys Network and ecosystem." />
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
      </Head>
      <nav className="navbar navbar-expand navbar-light bg-white">
        <div className="container d-flex justify-content-between align-items-center">
          <div className="d-flex align-items-center gap-3">
            <Link href="/" className="navbar-brand fw-bold mb-0">
              <Logo />
              Subspace Tools
            </Link>
            <SiteNav />
          </div>
        </div>
      </nav>
      <main className="flex-grow-1">
        <Breadcrumbs />
        <Component {...pageProps} />
      </main>
      <Footer />
    </div>
  )
}
