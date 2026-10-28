import { useCallback, useMemo, useSyncExternalStore } from 'react'

// Nicknames live only in this browser (localStorage), keyed by the owner's wallet.
const listeners = new Set<() => void>()
const keyFor = (owner: string) => 'safesend:nicknames:' + owner.toLowerCase()

function read(owner: string | undefined): string {
  if (!owner) return '{}'
  try {
    return localStorage.getItem(keyFor(owner)) ?? '{}'
  } catch {
    return '{}'
  }
}

function subscribe(cb: () => void) {
  listeners.add(cb)
  return () => {
    listeners.delete(cb)
  }
}

export function useNicknames(owner: string | undefined) {
  const raw = useSyncExternalStore(subscribe, () => read(owner))

  const names = useMemo<Record<string, string>>(() => {
    try {
      return JSON.parse(raw) as Record<string, string>
    } catch {
      return {}
    }
  }, [raw])

  const setName = useCallback(
    (address: string, name: string) => {
      if (!owner) return
      const next = { ...names }
      const trimmed = name.trim().slice(0, 32)
      if (trimmed) next[address.toLowerCase()] = trimmed
      else delete next[address.toLowerCase()]
      try {
        localStorage.setItem(keyFor(owner), JSON.stringify(next))
      } catch {
        // storage unavailable
      }
      listeners.forEach((l) => l())
    },
    [owner, names],
  )

  const nameOf = useCallback((address: string) => names[address.toLowerCase()], [names])

  return { nameOf, setName }
}
