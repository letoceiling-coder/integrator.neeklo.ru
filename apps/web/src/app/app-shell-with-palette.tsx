import { useState } from 'react';
import { AppShell } from './app-shell';
import { CommandPalette } from '@/widgets/command-palette/command-palette';

export function AppShellWithPalette() {
  const [paletteOpen, setPaletteOpen] = useState(false);

  return (
    <>
      <AppShell onOpenSearch={() => setPaletteOpen(true)} />
      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
    </>
  );
}
