import Link from 'next/link'

export default function Home() {
  return (
    <div className="container py-5">
      <h1>Subspace Tools</h1>

      <h2 className="fs-4 mt-4">XDM</h2>
      <ul>
        <li><Link href="/xdm/send">Send XDM Transfer</Link></li>
        <li><Link href="/xdm/channels">View XDM Channel Status</Link></li>
        <li><Link href="/xdm/transfers">View XDM Transfer Status</Link></li>
      </ul>

      <h2 className="fs-4 mt-4">WAI3</h2>
      <ul>
        <li><Link href="/wrap">Wrap & Unwrap AI3 / WAI3</Link></li>
      </ul>
    </div>
  )
}
