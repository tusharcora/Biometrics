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
  type SendCoachMessageInput,
} from '../api/coach';
import { Text } from '../components/ui/text';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Skeleton } from '../components/ui/skeleton';
import { ChatBubble } from '../components/ui/chat-bubble';
import { MemoryProposalChips } from '../components/memory-proposal-chips';
import { COLORS } from '../theme';
import type { RootStackParamList } from '../navigation/RootNavigator';

type CoachRoute = RouteProp<RootStackParamList, 'Coach'>;

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  source?: CoachMessageSource | string;
  // True only for a reply that just arrived, so it fades in; history does not.
  fresh?: boolean;
  // Memories the coach proposed to keep on this turn (shown under the bubble).
  memoryProposals?: MemoryDTO[];
  // Present on a crisis-safety reply.
  safety?: {
    resources: string[];
    // The user message that triggered it, resent if they say it was a false alarm.
    originalMessage: string;
    overridden: boolean;
  };
}

type Phase = 'loading' | 'unavailable' | 'ready';

const ERROR_TEXT = {
  timeout: 'The coach took too long to answer. Nothing was lost; you can try again.',
  generic: 'Something went wrong sending that. You can try again.',
};

// The coach conversation. Each reply arrives whole in one response (spec 2/4),
// so the only in-flight state is a static "Thinking…" line; nothing here
// suggests token streaming.
export function CoachScreen() {
  const navigation = useNavigation<any>();
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
  // Read inside async handlers so a stale closure never resends the wrong id.
  const conversationIdRef = useRef<string | null>(null);
  conversationIdRef.current = conversationId;

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const status = await fetchCoachStatus();
        if (cancelled) return;
        if (!status.enabled) {
          setPhase('unavailable');
          return;
        }
        if (!status.consented) {
          // The server decides: a changed consent version lands here too.
          navigation.replace('CoachConsent', { prefill });
          return;
        }
        const conversation = await fetchLatestConversation();
        if (cancelled) return;
        setConversationId(conversation.conversationId);
        setMessages(
          conversation.messages.map((m) => ({
            id: m.id,
            role: m.role === 'USER' ? 'user' : 'assistant',
            text: m.text,
            source: m.source,
          })),
        );
        setPhase('ready');
      } catch {
        // History is a convenience: a failure to load it must not lock the user
        // out of asking a question. Status failures already fail closed above
        // only when the server says so.
        if (!cancelled) setPhase('ready');
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const deliver = useCallback(
    async (request: SendCoachMessageInput) => {
      setSending(true);
      setError(null);
      try {
        const res = await sendCoachMessage({
          ...request,
          ...(conversationIdRef.current ? { conversationId: conversationIdRef.current } : {}),
        });
        if (!mounted.current) return;
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
        if (e instanceof CoachConsentRequiredError) {
          navigation.replace('CoachConsent', { prefill: undefined });
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
      <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
        <ScrollView
          ref={scrollRef}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ gap: 12, padding: 16, flexGrow: 1 }}
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
        >
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
    </SafeAreaView>
  );
}
