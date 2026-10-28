import { useSyncExternalStore } from 'react'

// Local log of transactions sent from this browser, so every one stays linkable to the explorer.
export interface ActivityItem {
  hash: string
  label: string
  chainId: number
  at: number
}

const KEY = 'safesend:activity'
const MAX_ITEMS = 30
const listeners = new Set<() => void>()

function readRaw(): string {
  try {
    return localStorage.getItem(KEY) ?? '[]'
  } catch {
    return '[]'
  }
}

export function recordActivity(item: Omit<ActivityItem, 'at'>): void {
  let items: ActivityItem[] = []
  try {
    items = JSON.parse(readRaw()) as ActivityItem[]
  } catch {
    items = []
  }
  if (items.some((i) => i.hash === item.hash)) return
  const next = [{ ...item, at: Date.now() }, ...items].slice(0, MAX_ITEMS)
  try {
    localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    // storage unavailable
  }
  listeners.forEach((l) => l())
}

function subscribe(cb: () => void) {
  listeners.add(cb)
  return () => {
    listeners.delete(cb)
  }
}

export function useActivityRaw(): string {
  return useSyncExternalStore(subscribe, readRaw)
}

export function parseActivity(raw: string): ActivityItem[] {
  try {
    return JSON.parse(raw) as ActivityItem[]
  } catch {
    return []
  }
}
