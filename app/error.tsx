"use client"

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="grid min-h-screen place-items-center bg-[#f4efe6] px-4 text-center">
      <div>
        <p className="font-display text-4xl">The counter hit a snag.</p>
        <button type="button" className="mt-4 underline" onClick={() => reset()}>
          Try again
        </button>
      </div>
    </div>
  )
}
