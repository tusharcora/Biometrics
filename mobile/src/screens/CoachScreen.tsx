import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, ScrollView, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { useColorScheme } from 'nativewind';
import { Ionicons } from '@expo/vector-icons';
import {
  CoachConsentRequiredError,
  CoachDisabledError,
  CoachTimeoutError,
  fetchCoachStatus,
  fetchLatestConversation,
  sendCoachMessage,
  type CoachMessageSource,
  type MemoryDTO,
  StaleConversationError,
  type SendCoachMessageInput,
} from '../api/coach';
import { Text } from '../components/ui/text';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Skeleton } from '../components/ui/skeleton';
import { ChatBubble } from '../components/ui/chat-bubble';
import { MemoryProposalChips } from '../components/memory-proposal-chips';
import { COLORS } from '../theme';
import type { TabParamList } from '../navigation/TabsNavigator';
import { useTabBarClearance } from '../navigation/tabBarLayout';
import { useKeyboardVisible } from '../lib/useKeyboardVisible';

type CoachRoute = RouteProp<TabParamList, 'Coach'>;

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  source?: CoachMessageSource | string;
  // True only for a reply that just arrived, so it fades in; history does not.
  fresh?: boolean;
  // Memories the coach proposed to keep on this turn (shown under the bubble).
  memoryProposals?: MemoryDTO[];
  // Set on a user bubble whose send failed, so the transcript does not show it
  // sitting there as though the coach received it.
  failed?: boolean;
  // Present on a crisis-safety reply.
  safety?: {
    resources: string[];
    // The user message that triggered it, resent if they say it was a false alarm.
    originalMessage: string;
    overridden: boolean;
  };
}

type Phase = 'loading' | 'unavailable' | 'needs-consent' | 'ready';

const ERROR_TEXT = {
  timeout: 'The coach took too long to answer. Nothing was lost; you can try again.',
  generic: 'Something went wrong sending that. You can try again.',
};

// The coach conversation. Each reply arrives whole in one response (spec 2/4),
// so the only in-flight state is a static "Thinking…" line; nothing here
// suggests token streaming.
export function CoachScreen() {
  const navigation = useNavigation<any>();
  const clearance = useTabBarClearance();
  const keyboardVisible = useKeyboardVisible();
  const route = useRoute<CoachRoute>();
  const { colorScheme: scheme } = useColorScheme();
  const colors = scheme === 'dark' ? COLORS.dark : COLORS.light;
  const prefill = route?.params?.prefill;

  const [phase, setPhase] = useState<Phase>('loading');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [input, setInput] = useState(prefill ?? '');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<{ text: string; request: SendCoachMessageInput } | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  const mounted = useRef(true);
  const localId = useRef(0);
  const redirectedToConsent = useRef(false);
  const loadInFlight = useRef(false);
  // A load requested while another is in flight (e.g. tab focus during the first
  // load). The in-flight result may be stale by then, so it is discarded and
  // one fresh load runs instead.
  const reloadPending = useRef(false);
  const loadRef = useRef<() => Promise<void>>(async () => {});
  // True when the status check itself could not be completed, as opposed to
  // having completed and said the coach is available.
  const [statusUnverified, setStatusUnverified] = useState(false);
  // The phase, readable from inside load() without making it re-create.
  const phaseRef = useRef<Phase>('loading');
  // True only once the conversation history was actually fetched and applied.
  // A failed history load still opens the chat (fail-open), but leaves this
  // false so the next focus retries it.
  const historyLoaded = useRef(false);
  // The last non-empty prefill. The route param is consumed once applied (below),
  // but the consent round-trip must still carry it.
  const lastPrefill = useRef<string | undefined>(prefill);
  // Read inside async handlers so a stale closure never resends the wrong id.
  const conversationIdRef = useRef<string | null>(null);
  conversationIdRef.current = conversationId;
  phaseRef.current = phase;
  // Mirrors `messages` so `load()` can see a message the user just sent (the
  // optimistic bubble) before the reply -- and conversationIdRef -- arrives.
  const messagesRef = useRef<ChatMessage[]>([]);
  messagesRef.current = messages;

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  // A prefill can arrive after this tab is already mounted (the tab is reused
  // by every entry point), so a changed param must reach the input.
  // The param is consumed after it is applied, so the same text arriving again
  // (a second "Ask about this" on the same score type) is a change again.
  useEffect(() => {
    if (!prefill) return;
    lastPrefill.current = prefill;
    setInput(prefill);
    navigation.setParams?.({ prefill: undefined });
    // Only a changed prefill should re-apply; `navigation` identity must not.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefill]);

  const load = useCallback(async () => {
    // Mount and tab focus can both trigger a load. Run one at a time, but never
    // drop a request: the finally below re-runs once if one arrived meanwhile.
    if (loadInFlight.current) {
      reloadPending.current = true;
      return;
    }
    loadInFlight.current = true;
    try {
      let status;
      try {
        status = await fetchCoachStatus();
      } catch {
        // The status request did not complete. Failing closed would hide a
        // working coach over one dropped request, so the screen stays usable --
        // but it must not imply everything is fine, which is what falling
        // through to a bare 'ready' did. Say so; the first send settles it.
        if (mounted.current) {
          setStatusUnverified(true);
          setPhase('ready');
        }
        return;
      }
      if (!mounted.current || reloadPending.current) return;
      setStatusUnverified(false);
      if (!status.enabled) {
        setPhase('unavailable');
        return;
      }
      if (!status.consented) {
        // The server decides: a changed consent version lands here too. Send
        // the user to consent once; if they come back without agreeing, stay on
        // a card rather than bouncing them straight back there.
        if (redirectedToConsent.current) {
          setPhase('needs-consent');
          return;
        }
        redirectedToConsent.current = true;
        navigation.navigate('CoachConsent', { prefill: lastPrefill.current });
        return;
      }
      redirectedToConsent.current = false;
      // Once the chat is showing, a focus reload only re-checks status. History
      // rows carry no safety card, memory chips or unsent bubbles, so re-reading
      // them would wipe what the live conversation is showing. A chat that
      // opened without its history (the fetch failed) is retried, unless the
      // user has meanwhile started a conversation -- which includes a message
      // they just sent but whose reply (and conversationId) has not arrived
      // yet -- because the retry would wipe it.
      if (phaseRef.current === 'ready' && (historyLoaded.current || conversationIdRef.current || messagesRef.current.length > 0)) return;
      const conversation = await fetchLatestConversation();
      if (!mounted.current || reloadPending.current) return;
      setConversationId(conversation.conversationId);
      setMessages(
        conversation.messages.map((m) => ({
          id: m.id,
          // CoachHistoryMessageDTO.role is already 'user' | 'assistant' -- the
          // server lowercases it before sending (see that type's comment).
          role: m.role,
          text: m.text,
          source: m.source,
        })),
      );
      historyLoaded.current = true;
      setPhase('ready');
    } catch {
      // History alone is a convenience now: failing to load past messages must
      // not stop someone asking a new question. A status failure is handled
      // above, where it can be reported rather than silently swallowed.
      if (mounted.current) setPhase('ready');
    } finally {
      loadInFlight.current = false;
      if (reloadPending.current) {
        reloadPending.current = false;
        if (mounted.current) void loadRef.current();
      }
    }
  }, [navigation]);
  loadRef.current = load;

  useEffect(() => {
    void load();
    // Load once on mount; later loads come from tab focus below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The Coach tab stays mounted while the user visits consent and comes back,
  // so re-read status whenever it regains focus. Optional so a screen rendered
  // without a real navigator (as in tests) still works.
  useEffect(() => {
    const unsubscribe = navigation.addListener?.('focus', () => {
      void load();
    });
    return unsubscribe;
  }, [navigation, load]);

  const deliver = useCallback(
    async (request: SendCoachMessageInput) => {
      setSending(true);
      setError(null);
      try {
        let res;
        try {
          res = await sendCoachMessage({
            ...request,
            ...(conversationIdRef.current ? { conversationId: conversationIdRef.current } : {}),
          });
        } catch (e) {
          // The server retains transcripts for 90 days, so an id held across a
          // long gap can simply be gone. The coach is still there: drop the id
          // and send the same message as a new conversation, once.
          if (!(e instanceof StaleConversationError) || !conversationIdRef.current) throw e;
          conversationIdRef.current = null;
          setConversationId(null);
          res = await sendCoachMessage(request);
        }
        if (!mounted.current) return;
        setStatusUnverified(false);
        setConversationId(res.conversationId);
        setMessages((prev) => {
          // A resend under safetyOverride settles the earlier safety card.
          const settled = request.safetyOverride
            ? prev.map((m) => (m.safety && m.safety.originalMessage === request.message ? { ...m, safety: { ...m.safety, overridden: true } } : m))
            : prev;
          const next: ChatMessage = {
            id: res.message.id,
            role: 'assistant',
            text: res.message.text,
            source: res.message.source,
            fresh: true,
            memoryProposals: res.memoryProposals?.length ? res.memoryProposals : undefined,
            safety:
              res.message.source === 'safety' && res.safety
                ? { resources: res.safety.resources, originalMessage: request.message, overridden: false }
                : undefined,
          };
          return [...settled, next];
        });
      } catch (e) {
        if (!mounted.current) return;
        // Whatever went wrong, the message did not land. Mark the bubble so the
        // transcript stops showing it as though the coach had received it.
        setMessages((prev) =>
          prev.map((m) => (m.role === 'user' && m.text === request.message && !m.failed ? { ...m, failed: true } : m)),
        );
        if (e instanceof CoachConsentRequiredError) {
          navigation.navigate('CoachConsent', { prefill: undefined });
        } else if (e instanceof CoachDisabledError) {
          setPhase('unavailable');
        } else {
          setError({ text: e instanceof CoachTimeoutError ? ERROR_TEXT.timeout : ERROR_TEXT.generic, request });
        }
      } finally {
        if (mounted.current) setSending(false);
      }
    },
    [navigation],
  );

  function send() {
    const text = input.trim();
    if (!text || sending) return;
    localId.current += 1;
    // The prefill has been used; a later consent round-trip must not resurrect it.
    lastPrefill.current = undefined;
    setMessages((prev) => [...prev, { id: `local-${localId.current}`, role: 'user', text }]);
    setInput('');
    void deliver({ message: text });
  }

  function overrideSafety(originalMessage: string) {
    if (sending) return;
    void deliver({ message: originalMessage, safetyOverride: true });
  }

  function retry() {
    if (!error || sending) return;
    void deliver(error.request);
  }

  if (phase === 'loading') {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <View testID="coach-loading" className="gap-3 p-4">
          <Skeleton className="h-12 w-2/3" />
          <Skeleton className="ml-auto h-10 w-1/2" />
          <Skeleton className="h-16 w-3/4" />
        </View>
      </SafeAreaView>
    );
  }

  if (phase === 'needs-consent') {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <View testID="coach-needs-consent" className="flex-1 items-center justify-center gap-3 p-6">
          <Text className="text-center text-muted-foreground">The coach needs your OK before it can look at your scores.</Text>
          <Button testID="coach-review-consent-button" onPress={() => navigation.navigate('CoachConsent', { prefill: lastPrefill.current })}>
            Review what is shared
          </Button>
        </View>
      </SafeAreaView>
    );
  }

  if (phase === 'unavailable') {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <View testID="coach-unavailable" className="flex-1 items-center justify-center p-6">
          <Text className="text-center text-muted-foreground">The AI Coach is not available right now.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const canSend = input.trim().length > 0 && !sending;

  return (
    <SafeAreaView className="flex-1 bg-background">
      {/* KeyboardAvoidingView owns its paddingBottom on iOS, so the bar clearance sits on this wrapper. */}
      <View testID="coach-clearance" style={{ flex: 1, paddingBottom: keyboardVisible ? 0 : clearance }}>
        <KeyboardAvoidingView
          className="flex-1"
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={90}
        >
          <ScrollView
            ref={scrollRef}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ gap: 12, padding: 16, flexGrow: 1 }}
            onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
          >
            {statusUnverified ? (
              <Text testID="coach-status-unverified" className="px-1 text-sm text-muted-foreground">
                We couldn't check the coach just now. You can still send a message.
              </Text>
            ) : null}

            {messages.length === 0 && !sending ? (
              <View testID="coach-empty" className="flex-1 items-center justify-center gap-2 py-16">
                <Ionicons name="chatbubbles-outline" size={28} color={colors.muted} />
                <Text className="text-center text-muted-foreground">
                  Ask about your scores, what moved them, or your habit patterns.
                </Text>
              </View>
            ) : null}

            {messages.map((message) => (
              <View key={message.id} className="gap-1">
                {message.failed ? (
                  <Text testID={`coach-message-failed-${message.id}`} className="self-end text-xs text-destructive">
                    Not sent
                  </Text>
                ) : null}
                <ChatBubble role={message.role} text={message.text} source={message.source as CoachMessageSource} animate={message.fresh === true}>
                  {message.safety ? (
                    <View className="gap-3">
                      <Card testID="coach-safety-resources" className="gap-1 border-accent bg-muted">
                        <Text className="text-sm font-semibold">Support is available</Text>
                        {message.safety.resources.map((resource) => (
                          <Text key={resource} className="text-sm">
                            {resource}
                          </Text>
                        ))}
                      </Card>
                      {!message.safety.overridden ? (
                        <Button
                          testID="coach-safety-override"
                          variant="ghost"
                          size="sm"
                          disabled={sending}
                          onPress={() => overrideSafety(message.safety!.originalMessage)}
                        >
                          {"That's not why I'm asking"}
                        </Button>
                      ) : null}
                    </View>
                  ) : null}
                </ChatBubble>
                {message.memoryProposals ? <MemoryProposalChips proposals={message.memoryProposals} /> : null}
              </View>
            ))}

            {sending ? (
              <View className="items-start">
                <Text testID="coach-thinking" className="px-1 text-sm text-muted-foreground">
                  Thinking…
                </Text>
              </View>
            ) : null}

            {error ? (
              <Card className="gap-2">
                <Text testID="coach-error" className="text-sm text-destructive">
                  {error.text}
                </Text>
                <Button testID="coach-retry-button" variant="ghost" size="sm" onPress={retry}>
                  Try again
                </Button>
              </Card>
            ) : null}
          </ScrollView>

          <View className="flex-row items-end gap-2 border-t border-border p-3">
            <TextInput
              testID="coach-input"
              value={input}
              onChangeText={setInput}
              placeholder="Ask the coach"
              placeholderTextColor={colors.muted}
              multiline
              editable={!sending}
              style={{ color: colors.foreground, maxHeight: 120 }}
              className="flex-1 rounded-xl border border-border bg-card px-4 py-3"
            />
            <Button testID="coach-send-button" accessibilityLabel="Send" disabled={!canSend} onPress={send} className={canSend ? '' : 'opacity-50'}>
              <Ionicons name="arrow-up" size={20} color="rgb(255,255,255)" />
            </Button>
          </View>
        </KeyboardAvoidingView>
      </View>
    </SafeAreaView>
  );
}
