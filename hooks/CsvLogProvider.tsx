import React, { createContext, useRef } from 'react'
import type { CsvLog } from '@/utils/csv'

export const CsvLogContext = createContext<Map<string, CsvLog> | null>(null)

/** Place outside capability gates to retain this route visit's log across reconnects. */
export function CsvLogProvider({ children }: { children: React.ReactNode }) {
  const logs = useRef(new Map<string, CsvLog>())
  return <CsvLogContext.Provider value={logs.current}>{children}</CsvLogContext.Provider>
}
