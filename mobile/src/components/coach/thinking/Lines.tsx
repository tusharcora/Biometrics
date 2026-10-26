import React from 'react';
import { Text } from '../../ui/text';
import { dotCount, useElapsed, useKipVoice } from './shared';
import type { ThinkingStyleProps } from './types';
import { useThinkingLine } from './useThinkingLine';

// A: "KIP is typing it up..." with the name in KIP's label colour, the line
// moving on every 2.4 s and the dots ticking in time.
export function Lines({ paused }: ThinkingStyleProps) {
  const { name, text } = useKipVoice();
  const { line } = useThinkingLine(paused);
  const elapsed = useElapsed(paused);
  const dots = dotCount(elapsed);
  return (
    <Text className="pb-3 text-caption text-muted-foreground">
      <Text className="text-caption font-semibold" style={{ color: text }}>
        {name}
      </Text>
      {` is ${line}`}
      {/* Three dots always take their room, so the line never shifts as they tick. */}
      <Text className="text-caption text-muted-foreground">{'.'.repeat(dots)}</Text>
      <Text className="text-caption" style={{ color: 'transparent' }}>
        {'.'.repeat(3 - dots)}
      </Text>
    </Text>
  );
}
