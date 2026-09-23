export type MemoryFeedback = 'confirm' | 'dismiss';
/** Rule 1: the user is explicitly telling the coach to drop what it just noted. */
export declare function isExplicitMemoryDismissal(message: string): boolean;
/**
 * Classifies the user's next message against ONE pending entry's value. Without
 * a value only rule 1 can fire.
 */
export declare function classifyMemoryFeedback(message: string, entryValue?: string): MemoryFeedback;
//# sourceMappingURL=memoryFeedback.d.ts.map