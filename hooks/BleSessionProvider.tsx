import React, { createContext, useContext } from 'react';
import { BleReconnectOverlay } from '@/components/BleReconnectOverlay';
import { useBleSession } from './useBleSession';

const BleSessionContext = createContext<ReturnType<typeof useBleSession> | null>(null);

export function BleSessionProvider({ children }: { children: React.ReactNode }) {
  const session = useBleSession();
  return (
    <BleSessionContext.Provider value={session}>
      {children}
      <BleReconnectOverlay visible={session.isReconnecting} />
    </BleSessionContext.Provider>
  );
}

export function useBle() {
  const ctx = useContext(BleSessionContext);
  if (!ctx) throw new Error('useBle must be used within BleSessionProvider');
  return ctx;
}
