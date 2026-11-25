"use client"

export function LogoutLink({ className }: { className?: string }) {
  return (
    <button
      type="button"
      className={className ?? "text-sm underline"}
      onClick={async () => {
        await fetch("/api/auth/logout", { method: "POST" })
        window.location.assign("/")
      }}
    >
      Log out
    </button>
  )
}
