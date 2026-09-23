export interface TurnToolResult {
    name: string;
    result: unknown;
    /**
     * The arguments the tool was called with, when the caller records them.
     * Only used to detect an ambiguous reference (see lookup): two calls of the
     * same tool with DIFFERENT arguments in one turn.
     */
    args?: unknown;
}
export type GuardrailReason = 'unwrapped_number' | 'invalid_field_path' | 'empty_reply';
export type GroundingVerdict = {
    ok: true;
    text: string;
} | {
    ok: false;
    reasons: GuardrailReason[];
};
export type PathSegment = string | number;
export interface ParsedReference {
    tool: string;
    path: PathSegment[];
}
export declare function parseReference(raw: string): ParsedReference | null;
export interface Resolution {
    text: string;
    /** [start, end) offsets into `text` of each resolved value; digits inside them are grounded. */
    spans: Array<[number, number]>;
    /** The raw content of every reference that did not resolve. */
    invalid: string[];
    /** Where those unresolved references sit in `text`; already rejected, so their own digits are not double-counted. */
    invalidSpans: Array<[number, number]>;
}
export declare function resolveReferences(raw: string, results: readonly TurnToolResult[]): Resolution;
/** True when `text` holds a digit (any Unicode decimal digit) outside every allowed span. */
export declare function hasUnwrappedDigit(text: string, groundedSpans: ReadonlyArray<[number, number]>): boolean;
/**
 * Validates one buffered model reply as a unit. On success returns the RESOLVED
 * text (the only thing that may reach the client); on failure returns every
 * reason so the orchestrator can log them distinctly.
 */
export declare function validateReply(raw: string, results: readonly TurnToolResult[]): GroundingVerdict;
//# sourceMappingURL=grounding.d.ts.map