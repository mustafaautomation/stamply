import Link from "next/link"

export default function NotFound() {
  return (
    <div className="grid min-h-screen place-items-center bg-[#f4efe6] px-4 text-center">
      <div>
        <p className="font-display text-6xl">404</p>
        <p className="mt-2 text-[#6e6258]">That page is not on the card.</p>
        <Link href="/" className="mt-4 inline-block underline">
          Back to Stamply
        </Link>
      </div>
    </div>
  )
}
