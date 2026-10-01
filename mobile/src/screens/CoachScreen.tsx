import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, ScrollView, KeyboardAvoidingView, Platform, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { useColorScheme } from 'nativewind';
import { Ionicons } from '@expo/vector-icons';
import {
  StaleConversationError,
  fetchCoachStatus,
  fetchConversation,
  fetchLatestConversation,
  fetchTodaySummary,
  type CoachEngineDTO,
  type CoachMessageSource,
  type TodaySummaryDTO,
} from '../api/coach';
import { Text } from '../components/ui/text';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Skeleton } from '../components/ui/skeleton';
import { PromptBar } from '../components/coach/PromptBar';
import { ThoughtLine } from '../components/coach/thought-line';
import { CoachToday } from '../components/coach/CoachToday';
import { AnswerCard } from '../components/coach/AnswerCard';
import { FollowUpChips } from '../components/coach/FollowUpChips';
import { ErrorCard } from '../components/coach/ErrorCard';
import { ConversationsSheet } from '../components/coach/ConversationsSheet';
import { ChatBubble } from '../components/ui/chat-bubble';
import { MemoryProposalChips } from '../components/memory-proposal-chips';
import { Character } from '../components/characters/Character';
import { characterInfo } from '../components/characters/registry';
import { useCharacterMood } from '../characters/useCharacterMood';
import { useScreenFocused } from '../characters/useScreenFocused';
import { PressableScale } from '../components/ui/pressable-scale';
import { COLORS } from '../theme';
import type { TabParamList } from '../navigation/TabsNavigator';
import { useTabBarClearance } from '../navigation/tabBarLayout';
import { useKeyboardVisible } from '../lib/useKeyboardVisible';
import { useCharacterOptional } from '../characters/CharacterContext';
import { useCoachConversation, type CoachChatMessage } from '../lib/useCoachConversation';
import { suggestedQuestions } from '../lib/coachToday';
import { cardDestination, followUpsFor } from '../lib/coachAnswers';

type CoachRoute = RouteProp<TabParamList, 'Coach'>;

type Phase = 'loading' | 'unavailable' | 'needs-consent' | 'ready';

// The Coach page (spec 1): header, today's summary, suggested questions, the
// conversation (streamed sentence by sentence) and the composer. Loading and
// gating (status, character picker, consent) live here; the conversation
// itself lives in useCoachConversation.
export function CoachScreen() {
  const navigation = useNavigation<any>();
  const clearance = useTabBarClearance();
  const keyboardVisible = useKeyboardVisible();
  const route = useRoute<CoachRoute>();
  const { colorScheme: scheme } = useColorScheme();
  const colors = scheme === 'dark' ? COLORS.dark : COLORS.light;
  const prefill = route?.params?.prefill;
  const characterCtx = useCharacterOptional();
  const name = characterInfo(characterCtx?.characterId).name;

  const [phase, setPhase] = useState<Phase>('loading');
  const [input, setInput] = useState(prefill ?? '');
  const [engine, setEngine] = useState<CoachEngineDTO>('local');
  const [today, setToday] = useState<TodaySummaryDTO | null>(null);
  const [todayLoading, setTodayLoading] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);
  // A past conversation picked from the sheet was gone (deleted or past retention).
  const [conversationGone, setConversationGone] = useState(false);
  const focused = useScreenFocused();
  const scrollRef = useRef<ScrollView>(null);
  const mounted = useRef(true);
  const redirectedToConsent = useRef(false);
  // Meet your coach opens by itself at most once per mount of this tab.
  const pickerOpened = useRef(false);
  const loadInFlight = useRef(false);
  // A load requested while another is in flight (e.g. tab focus during the first
  // load). The in-flight result may be stale by then, so it is discarded and
  // one fresh load runs instead.
  const reloadPending = useRef(false);
  const loadRef = useRef<() => Promise<void>>(async () => {});
  // True when the status check itself could not be completed, as opposed to
  // having completed and said the coach is available.
  const [statusUnverified, setStatusUnverified] = useState(false);
  const phaseRef = useRef<Phase>('loading');
  phaseRef.current = phase;
  // True only once the conversation history was actually fetched and applied.
  const historyLoaded = useRef(false);
  // The last non-empty prefill. The route param is consumed once applied (below),
  // but the consent round-trip must still carry it.
  const lastPrefill = useRef<string | undefined>(prefill);

  const conversation = useCoachConversation({
    preferredEngine: engine,
    onConsentRequired: () => navigation.navigate('CoachConsent', { prefill: undefined }),
    onDisabled: () => setPhase('unavailable'),
  });
  const { messages, conversationId, streaming, waiting, statusLabel, answeredAt, error, restore, send, stop } = conversation;
  const mood = useCharacterMood({ sending: streaming, answeredAt });
  // Read inside load(): a message just sent (before its conversationId
  // arrives) must stop a focus reload from replacing the chat with history.
  const conversationIdRef = useRef<string | null>(null);
  conversationIdRef.current = conversationId;
  const messagesRef = useRef<CoachChatMessage[]>([]);
  messagesRef.current = messages;

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  // A prefill can arrive after this tab is already mounted; the param is
  // consumed once applied, so the same text arriving again is a change again.
  useEffect(() => {
    if (!prefill) return;
    lastPrefill.current = prefill;
    setInput(prefill);
    navigation.setParams?.({ prefill: undefined });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefill]);

  const openPicker = useCallback(() => {
    if (pickerOpened.current) return false;
    pickerOpened.current = true;
    navigation.navigate('MeetYourCoach', { mode: 'first' });
    return true;
  }, [navigation]);

  // First Coach-tab visit with the coach enabled and no character chosen yet:
  // the picker comes first, before consent. Only over this tab.
  const providerStatus = characterCtx?.statusLoaded ? characterCtx.status : null;
  const providerSaysNotChosen = !!providerStatus?.enabled && providerStatus.personaChosen === false;
  useEffect(() => {
    if (providerSaysNotChosen && focused && navigation.isFocused?.() !== false) openPicker();
  }, [providerSaysNotChosen, focused, navigation, openPicker]);

  // Today's summary. A failed refresh keeps what is on screen; a failed first
  // load simply leaves the section out.
  const loadToday = useCallback(async () => {
    setTodayLoading(true);
    try {
      const summary = await fetchTodaySummary();
      if (mounted.current) setToday(summary);
    } catch {
      // Keep the last summary, if any.
    } finally {
      if (mounted.current) setTodayLoading(false);
    }
  }, []);

  const load = useCallback(async () => {
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
        // The status request did not complete: stay usable, but say so.
        if (mounted.current) {
          setStatusUnverified(true);
          setPhase('ready');
          void loadToday();
        }
        return;
      }
      if (!mounted.current || reloadPending.current) return;
      setStatusUnverified(false);
      if (!status.enabled) {
        setPhase('unavailable');
        return;
      }
      setEngine(status.engine ?? 'local');
      const pickerJustOpened = status.personaChosen === false && navigation.isFocused?.() !== false && openPicker();
      if (!status.consented) {
        if (redirectedToConsent.current) {
          setPhase('needs-consent');
          return;
        }
        if (pickerJustOpened || navigation.isFocused?.() === false) return;
        redirectedToConsent.current = true;
        navigation.navigate('CoachConsent', { prefill: lastPrefill.current });
        return;
      }
      redirectedToConsent.current = false;
      void loadToday();
      // Once the chat is showing, a focus reload only re-checks status and
      // today: re-reading history would wipe what the live chat shows.
      if (phaseRef.current === 'ready' && (historyLoaded.current || conversationIdRef.current || messagesRef.current.length > 0)) return;
      const latest = await fetchLatestConversation();
      if (!mounted.current || reloadPending.current) return;
      restore(latest);
      historyLoaded.current = true;
      setPhase('ready');
    } catch {
      // Past messages are a convenience: failing to load them must not stop a new question.
      if (mounted.current) setPhase('ready');
    } finally {
      loadInFlight.current = false;
      if (reloadPending.current) {
        reloadPending.current = false;
        if (mounted.current) void loadRef.current();
      }
    }
  }, [navigation, openPicker, loadToday, restore]);
  loadRef.current = load;

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The tab stays mounted while the user visits consent and comes back.
  useEffect(() => {
    const unsubscribe = navigation.addListener?.('focus', () => {
      void load();
    });
    return unsubscribe;
  }, [navigation, load]);

  // A question from a suggestion, a bar, a chip or the field. Stable, so the
  // memoised today summary does not re-render on every keystroke.
  const ask = useCallback(
    (text: string): boolean => {
      const sent = send(text);
      if (sent) {
        lastPrefill.current = undefined;
        setConversationGone(false);
      }
      return sent;
    },
    [send],
  );

  function sendTyped() {
    if (ask(input)) setInput('');
  }

  async function openConversation(id: string) {
    setSheetOpen(false);
    setConversationGone(false);
    try {
      const past = await fetchConversation(id);
      if (mounted.current) {
        restore(past);
        historyLoaded.current = true;
      }
    } catch (e) {
      // Offline: stay on the chat that is showing. Gone (404): say so gently.
      if (mounted.current && e instanceof StaleConversationError) setConversationGone(true);
    }
  }

  function startNewChat() {
    setSheetOpen(false);
    setConversationGone(false);
    conversation.newChat();
    historyLoaded.current = true;
  }

  const ready = phase === 'ready' && !statusUnverified;
  const header = (
    <View className="flex-row items-center justify-between px-5 pb-2 pt-1">
      <View className="flex-row items-center gap-3">
        <Character testID="coach-header-character" mood={mood} size={36} paused={!focused} />
        <Text className="font-display text-display">Coach</Text>
      </View>
      {ready ? (
        <View className="flex-row gap-2">
          <Pressable
            testID="coach-conversations-button"
            accessibilityRole="button"
            accessibilityLabel="Conversations and coach memory"
            onPress={() => setSheetOpen(true)}
            hitSlop={4}
            className="h-11 w-11 items-center justify-center rounded-full border border-border bg-muted active:opacity-70"
          >
            <Ionicons name="menu-outline" size={20} color={colors.foreground} />
          </Pressable>
          <Pressable
            testID="coach-new-chat-button"
            accessibilityRole="button"
            accessibilityLabel="New chat"
            onPress={startNewChat}
            hitSlop={4}
            className="h-11 w-11 items-center justify-center rounded-full border border-border bg-muted active:opacity-70"
          >
            <Ionicons name="create-outline" size={18} color={colors.foreground} />
          </Pressable>
        </View>
      ) : null}
    </View>
  );

  if (phase === 'loading') {
    return (
      <SafeAreaView className="flex-1 bg-background">
        {header}
        <View testID="coach-loading" className="gap-3 p-5">
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
        {header}
        <View testID="coach-needs-consent" className="flex-1 items-center justify-center gap-4 p-8">
          <Character mood="idle" size={56} glow paused={!focused} />
          <Text className="text-center text-base text-muted-foreground">The coach needs your OK before it can look at your scores.</Text>
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
        {header}
        <View testID="coach-unavailable" className="flex-1 items-center justify-center gap-4 p-8">
          <Character mood="idle" size={56} paused={!focused} />
          <Text className="text-center text-base text-muted-foreground">The AI Coach is not available right now.</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Without a summary there is no day to open; cardDestination then opens the Metrics tab.
  const cardDate = today?.date ?? '';
  const last = messages[messages.length - 1];

  function renderMessage(message: CoachChatMessage) {
    if (message.role === 'user') {
      return (
        <View key={message.id} className="gap-1">
          {message.failed ? (
            <Text testID={`coach-message-failed-${message.id}`} className="self-end text-xs text-destructive">
              Not sent
            </Text>
          ) : null}
          <ChatBubble role="user" text={message.text} />
        </View>
      );
    }
    // The empty answer being waited on shows as the thinking line instead.
    if (message.state === 'streaming' && !message.text && !message.safety) return null;
    const isLatest = message === last;
    const showFollowUps = isLatest && !streaming && message.state === 'done' && !message.safety;
    // The question this answers: a chip repeating it is dropped.
    const lastQuestion = showFollowUps ? [...messages].reverse().find((m) => m.role === 'user')?.text : undefined;
    return (
      <View key={message.id} className="gap-2">
        {message.text ? (
          <ChatBubble role="assistant" text={message.text} source={message.source as CoachMessageSource} animate={false}>
            {message.safety ? (
              <View className="gap-3">
                <Card testID="coach-safety-resources" className="gap-1 border-accent/40 bg-accent/10">
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
                    disabled={streaming}
                    onPress={() => conversation.overrideSafety(message.safety!.originalMessage)}
                  >
                    {"That's not why I'm asking"}
                  </Button>
                ) : null}
              </View>
            ) : null}
          </ChatBubble>
        ) : null}
        {message.card ? (
          <AnswerCard
            card={message.card}
            onOpenSource={() => {
              const target = cardDestination(message.card!, cardDate);
              navigation.navigate(target.name, target.params);
            }}
          />
        ) : null}
        {message.state === 'stopped' ? (
          <Text testID={`coach-stopped-${message.id}`} className="text-xs text-muted-foreground">
            Stopped
          </Text>
        ) : null}
        {message.answeredLocally ? (
          <Text testID="coach-local-note" className="text-xs text-muted-foreground">
            Answered by the on-device model
          </Text>
        ) : null}
        {message.memoryProposals ? <MemoryProposalChips proposals={message.memoryProposals} /> : null}
        {showFollowUps ? <FollowUpChips questions={followUpsFor(message.card, lastQuestion)} onAsk={ask} disabled={streaming} /> : null}
      </View>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      {header}
      {/* KeyboardAvoidingView owns its paddingBottom on iOS, so the bar clearance sits on this wrapper. */}
      <View testID="coach-clearance" style={{ flex: 1, paddingBottom: keyboardVisible ? 0 : clearance }}>
        <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
          <ScrollView
            ref={scrollRef}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ gap: 16, paddingHorizontal: 20, paddingVertical: 12, flexGrow: 1 }}
            onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
          >
            {conversationGone ? (
              <Text testID="coach-conversation-gone" className="px-1 text-sm text-muted-foreground">
                That conversation is no longer available.
              </Text>
            ) : null}

            {statusUnverified ? (
              <Text testID="coach-status-unverified" className="px-1 text-sm text-muted-foreground">
                We couldn't check the coach just now. You can still send a message.
              </Text>
            ) : null}

            <CoachToday summary={today} loading={todayLoading} onAsk={ask} />

            {messages.length === 0 && !streaming ? (
              <View testID="coach-empty" className="items-center gap-4 py-4">
                <Character testID="coach-hero-character" mood={mood} size={64} paused={!focused} />
                <View className="items-center gap-1 px-4">
                  <Text className="text-center font-display text-display-sm">What would you like to know?</Text>
                  <Text className="text-center text-sm text-muted-foreground">Ask about your data, or anything health and fitness.</Text>
                </View>
                <View className="w-full gap-2">
                  {suggestedQuestions(today).map((question, index) => (
                    <PressableScale
                      key={question}
                      testID={`coach-suggestion-${index}`}
                      accessibilityRole="button"
                      onPress={() => ask(question)}
                      className="flex-row items-center justify-between rounded-tile border border-border bg-card px-4 py-3.5"
                    >
                      <Text className="shrink text-base">{question}</Text>
                      <Ionicons name="arrow-up" size={16} color={colors.muted} />
                    </PressableScale>
                  ))}
                </View>
              </View>
            ) : null}

            {messages.map(renderMessage)}

            {waiting ? (
              <View className="items-start">
                <ThoughtLine
                  working
                  label={statusLabel ?? 'Thinking…'}
                  glyph={<Character testID="coach-thinking-character" mood="thinking" size={20} paused={!focused} />}
                  testID="coach-thinking"
                />
              </View>
            ) : null}

            {error ? <ErrorCard error={error} onRetry={conversation.retry} /> : null}
          </ScrollView>

          <View className="px-4 pb-2 pt-1">
            <PromptBar value={input} onChangeText={setInput} onSend={sendTyped} busy={streaming} onStop={stop} placeholder={`Ask ${name} anything…`} />
          </View>
        </KeyboardAvoidingView>
      </View>

      <ConversationsSheet
        visible={sheetOpen}
        onClose={() => setSheetOpen(false)}
        onOpen={(id) => void openConversation(id)}
        onNewChat={startNewChat}
        onOpenMemory={() => {
          setSheetOpen(false);
          navigation.navigate('CoachMemory');
        }}
        currentId={conversationId}
      />
    </SafeAreaView>
  );
}
