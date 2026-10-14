import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, AppState, View, ScrollView, KeyboardAvoidingView, Platform, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { useColorScheme } from 'nativewind';
import { Ionicons } from '@expo/vector-icons';
import Animated, { useAnimatedStyle, useSharedValue, type SharedValue } from 'react-native-reanimated';
import { isNetworkError } from '../api/client';
import {
  StaleConversationError,
  fetchCoachStatus,
  fetchConversation,
  fetchLatestConversation,
  fetchTodaySummary,
  type AnswerCardDTO,
  type CoachEngineDTO,
  type TodaySummaryDTO,
} from '../api/coach';
import { Text } from '../components/ui/text';
import { PageTitle } from '../components/ui/page-title';
import { Button, buttonIconSize } from '../components/ui/button';
import { Skeleton } from '../components/ui/skeleton';
import { PromptBar } from '../components/coach/PromptBar';
import { ThinkingRow } from '../components/coach/thinking/ThinkingRow';
import { CoachToday, TODAY_FOOTNOTE, todayShowsFootnote } from '../components/coach/CoachToday';
import { CoachMessageRow } from '../components/coach/CoachMessageRow';
import { ErrorCard } from '../components/coach/ErrorCard';
import { ConversationsSheet } from '../components/coach/ConversationsSheet';
import { RoomCard } from '../components/coach/RoomCard';
import { COLLAPSED_ROW_HEIGHT, CollapsedKipHeader, collapseProgress } from '../components/coach/CollapsedKipHeader';
import { KipStateCard } from '../components/coach/KipStateCard';
import { DEFAULT_THINKING_TEXT } from '../lib/thinkingText';
import { useCoachStatusContext } from '../lib/coachStatus/CoachStatusProvider';
import { useTodayScene } from '../lib/home/useTodayScene';
import { KIP_COPY } from '../lib/kipCopy';
import { kipStage, kipStatusLine, spokenLine } from '../lib/kipStage';
import { readKipRoomShrunk, writeKipRoomShrunk } from '../lib/kipRoomPrefs';
import { useKipTurn } from '../lib/useKipTurn';
import { useScreenFocused } from '../lib/useScreenFocused';
import { PressableScale } from '../components/ui/pressable-scale';
import { COLORS } from '../theme';
import type { TabParamList } from '../navigation/TabsNavigator';
import { useTabBarClearance } from '../navigation/tabBarLayout';
import { useKeyboardVisible } from '../lib/useKeyboardVisible';
import { useCoachConversation, type CoachChatMessage } from '../lib/useCoachConversation';
import { suggestedQuestions } from '../lib/coachToday';
import { cardDestination } from '../lib/coachAnswers';

type CoachRoute = RouteProp<TabParamList, 'Coach'>;

type Phase = 'loading' | 'unavailable' | 'needs-consent' | 'ready';

// How long the steps checklist stays up, all ticked, once the answer starts (spec §5).
const STEPS_LINGER_MS = 300;

// How close to the bottom (pt) still counts as reading the latest message.
const NEAR_BOTTOM = 80;

// The phases with no chat (loading, consent, unavailable): the header, then the room and its card.
const STATE_CONTENT = { gap: 16, paddingHorizontal: 20, paddingVertical: 12 };

// Why a past conversation picked from the sheet did not open.
const CHAT_NOTES = {
  gone: { testID: 'coach-conversation-gone', text: 'That conversation is no longer available.' },
  failed: { testID: 'coach-conversation-failed', text: "Couldn't open that conversation just now. Try again in a moment." },
} as const;

function nearBottom({ contentOffset, contentSize, layoutMeasurement }: NativeScrollEvent): boolean {
  return contentOffset.y + layoutMeasurement.height >= contentSize.height - NEAR_BOTTOM;
}

// The KIP page (spec 2026-10-14 KIP Coach §3, W7): the header with KIP's status
// line, KIP's room, today's summary, suggested questions, the conversation
// (streamed sentence by sentence) and the composer. Loading and gating (status,
// consent, offline) live here; the conversation itself lives in
// useCoachConversation. There is no picker: every user's coach is KIP.
export function CoachScreen() {
  const navigation = useNavigation<any>();
  const clearance = useTabBarClearance();
  const keyboardVisible = useKeyboardVisible();
  const route = useRoute<CoachRoute>();
  const { colorScheme: scheme } = useColorScheme();
  const colors = scheme === 'dark' ? COLORS.dark : COLORS.light;
  const prefill = route?.params?.prefill;
  const coachShared = useCoachStatusContext();
  const thinkingText = coachShared?.thinkingText ?? DEFAULT_THINKING_TEXT;

  const [phase, setPhase] = useState<Phase>('loading');
  const [input, setInput] = useState(prefill ?? '');
  const [engine, setEngine] = useState<CoachEngineDTO>('local');
  const [today, setToday] = useState<TodaySummaryDTO | null>(null);
  const [todayLoading, setTodayLoading] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);
  // A past conversation picked from the sheet did not open: gone (404) or failed.
  const [chatNote, setChatNote] = useState<keyof typeof CHAT_NOTES | null>(null);
  // Follow the end of the chat as it grows: on after a send, off after a
  // history restore (the page opens at the top, today first) and while the
  // user has scrolled up to read.
  const followEnd = useRef(false);
  // Bumped by every send, new chat and conversation open: an older history
  // load that resolves later must not replace what the user has moved on to.
  const chatSeq = useRef(0);
  const focused = useScreenFocused();
  const scrollRef = useRef<ScrollView>(null);
  const mounted = useRef(true);
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
  // Offline (spec §3.4): a request that never left the device. The shared
  // CoachStatusProvider holds it when there is one, so Home and this page agree;
  // this page writes through to it and keeps its own copy for when there is none.
  const [localOffline, setLocalOffline] = useState(false);
  const offline = coachShared?.offline ?? localOffline;
  const setSharedOffline = coachShared?.setOffline;
  const setOffline = useCallback(
    (next: boolean) => {
      setLocalOffline(next);
      setSharedOffline?.(next);
    },
    [setSharedOffline],
  );
  const phaseRef = useRef<Phase>('loading');
  phaseRef.current = phase;
  // True only once the conversation history was actually fetched and applied.
  const historyLoaded = useRef(false);
  // The last non-empty prefill. The route param is consumed once applied (below),
  // but the consent round-trip must still carry it.
  const lastPrefill = useRef<string | undefined>(prefill);

  // Reduce Motion (spec §3.6): no typing loop, no turn, no room loops, no collapse fade.
  const [reduceMotion, setReduceMotion] = useState(false);
  useEffect(() => {
    let live = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((v) => {
      if (live) setReduceMotion(v);
    });
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => {
      live = false;
      sub.remove();
    };
  }, []);

  // "Shrink room" (spec §3.5): the card collapsed for good, remembered on the device. A choice made before the
  // stored one is read wins over it.
  const [shrunk, setShrunk] = useState(false);
  const shrunkChosen = useRef(false);
  useEffect(() => {
    let live = true;
    void readKipRoomShrunk().then((v) => {
      if (live && !shrunkChosen.current) setShrunk(v);
    });
    return () => {
      live = false;
    };
  }, []);

  // Collapse on scroll (spec §3.5): the card's bottom edge in the scroll content, the expanded header's height (the
  // collapsed header pins over it, so only the rest of its row reaches down over the scroll), the fade (0 → 1, a
  // shared value) and whether the collapsed header is up, fading in or fully in (state, changed only at the
  // thresholds). It takes taps only once fully in; until then they reach the expanded header under it.
  const cardBottom = useRef<number | null>(null);
  const headerHeight = useRef<number | null>(null);
  const lastProgress = useRef(0);
  const fade = useSharedValue(0);
  const [collapsed, setCollapsed] = useState<CollapseState>('hidden');
  const trackCollapse = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (cardBottom.current === null || headerHeight.current === null) return;
      const progress = collapseProgress(e.nativeEvent.contentOffset.y, cardBottom.current, COLLAPSED_ROW_HEIGHT - headerHeight.current);
      lastProgress.current = progress;
      fade.value = progress;
      setCollapsed(collapseState(progress, reduceMotion));
    },
    [fade, reduceMotion],
  );
  // Reduce Motion switched on mid-fade: no half-faded header waits for the next scroll.
  useEffect(() => {
    setCollapsed(collapseState(lastProgress.current, reduceMotion));
  }, [reduceMotion]);

  const conversation = useCoachConversation({
    preferredEngine: engine,
    onConsentRequired: () => navigation.navigate('CoachConsent', { prefill: undefined }),
    onDisabled: () => setPhase('unavailable'),
  });
  const { messages, conversationId, streaming, waiting, steps, answeredAt, error, send, stop, retry, overrideSafety, newChat } = conversation;
  const restoreHook = conversation.restore;
  // History opens at the top of the page, with today in view.
  const restore = useCallback(
    (past: Parameters<typeof restoreHook>[0]) => {
      followEnd.current = false;
      restoreHook(past);
    },
    [restoreHook],
  );
  const lingering = useStepsLinger(waiting, thinkingText === 'steps' && steps.length > 0 && steps.every((step) => step.done));
  // The linger is for an answer that started. A turn the server stopped, or one
  // that failed, drops the row at once; so does New chat (it clears the steps).
  const lastMessage = messages[messages.length - 1];
  const turnCut = !!error || (lastMessage?.role === 'assistant' && (lastMessage.state === 'stopped' || lastMessage.state === 'interrupted'));
  const showThinking = waiting || (lingering && steps.length > 0 && !turnCut);
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
      } catch (err) {
        // The status request did not complete: stay usable, but say so. A
        // request that never left the device is offline, not unverified.
        if (mounted.current) {
          if (isNetworkError(err)) setOffline(true);
          else setStatusUnverified(true);
          setPhase('ready');
          void loadToday();
        }
        return;
      }
      if (!mounted.current || reloadPending.current) return;
      setOffline(false);
      setStatusUnverified(false);
      if (!status.enabled) {
        setPhase('unavailable');
        return;
      }
      setEngine(status.engine ?? 'local');
      if (!status.consented) {
        if (redirectedToConsent.current) {
          setPhase('needs-consent');
          return;
        }
        if (navigation.isFocused?.() === false) return;
        redirectedToConsent.current = true;
        navigation.navigate('CoachConsent', { prefill: lastPrefill.current });
        return;
      }
      redirectedToConsent.current = false;
      void loadToday();
      // Once the chat is showing, a focus reload only re-checks status and
      // today: re-reading history would wipe what the live chat shows.
      if (phaseRef.current === 'ready' && (historyLoaded.current || conversationIdRef.current || messagesRef.current.length > 0)) return;
      const seq = chatSeq.current;
      const latest = await fetchLatestConversation();
      if (!mounted.current || reloadPending.current) return;
      // The user sent, or opened another chat, meanwhile: keep that.
      if (seq !== chatSeq.current) return;
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
  }, [navigation, loadToday, restore, setOffline]);
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

  // A turn that got through settles an unverified status (the coach is there)
  // and clears offline.
  useEffect(() => {
    if (answeredAt === null && !conversationId) return;
    setStatusUnverified(false);
    setOffline(false);
  }, [answeredAt, conversationId, setOffline]);

  // A send that never left the device (useCoachConversation's 'offline' kind):
  // show offline and put the question back in the bar, unless something new is
  // already typed there.
  useEffect(() => {
    if (error?.kind !== 'offline') return;
    setOffline(true);
    setInput((current) => current || error.request.message);
  }, [error, setOffline]);

  // Back in the foreground while offline: read the status again. Focus already
  // reloads (above).
  useEffect(() => {
    if (!offline) return undefined;
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void loadRef.current();
    });
    return () => sub.remove();
  }, [offline]);

  // Screen readers hear once that the answer is in (not for a safety reply,
  // a stop or an error: answeredAt is only set for a finished answer).
  useEffect(() => {
    if (answeredAt !== null) AccessibilityInfo.announceForAccessibility('Answer ready');
  }, [answeredAt]);

  // A question from a suggestion, a bar, a chip or the field. Stable, so the
  // memoised today summary and rows do not re-render on every keystroke.
  const ask = useCallback(
    (text: string): boolean => {
      const sent = send(text);
      if (sent) {
        chatSeq.current += 1;
        followEnd.current = true;
        lastPrefill.current = undefined;
        setChatNote(null);
      }
      return sent;
    },
    [send],
  );

  const retryTurn = useCallback(() => {
    followEnd.current = true;
    retry();
  }, [retry]);

  const resendWithOverride = useCallback(
    (originalMessage: string) => {
      followEnd.current = true;
      overrideSafety(originalMessage);
    },
    [overrideSafety],
  );

  // Without a summary there is no day to open; cardDestination then opens each page on its default day.
  const cardDate = today?.date ?? '';
  const openSource = useCallback(
    (card: AnswerCardDTO) => {
      const target = cardDestination(card, cardDate);
      navigation.navigate(target.name, target.params);
    },
    [navigation, cardDate],
  );

  function sendTyped() {
    if (ask(input)) setInput('');
  }

  async function openConversation(id: string) {
    setSheetOpen(false);
    setChatNote(null);
    const seq = ++chatSeq.current;
    try {
      const past = await fetchConversation(id);
      if (!mounted.current || seq !== chatSeq.current) return;
      restore(past);
      historyLoaded.current = true;
    } catch (e) {
      // Stay on the chat that is showing, and say why gently.
      if (mounted.current && seq === chatSeq.current) setChatNote(e instanceof StaleConversationError ? 'gone' : 'failed');
    }
  }

  function startNewChat() {
    setSheetOpen(false);
    setChatNote(null);
    chatSeq.current += 1;
    followEnd.current = false;
    newChat();
    historyLoaded.current = true;
  }

  const onContentSizeChange = useCallback(() => {
    if (followEnd.current) scrollRef.current?.scrollToEnd({ animated: true });
  }, []);
  // Only the user's own scrolling decides whether to keep following; the
  // programmatic scrollToEnd fires no drag events.
  const stopFollowing = useCallback(() => {
    followEnd.current = false;
  }, []);
  const followIfNearBottom = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    followEnd.current = nearBottom(e.nativeEvent);
  }, []);

  const day = useTodayScene(navigation);
  const stage = kipStage({
    phase,
    statusUnverified,
    offline,
    waiting,
    streaming,
    error: !!error && error.kind !== 'offline',
    empty: messages.length === 0 && !streaming,
    idle: { pose: day.scene.pose, mood: day.scene.mood },
  });
  const look = useKipTurn(stage, reduceMotion);
  const statusLine = kipStatusLine(stage.id, day.recovery, false);
  const openRecovery = useCallback(() => navigation.navigate('Recovery', { date: day.today }), [navigation, day.today]);

  const shrink = useCallback(() => {
    shrunkChosen.current = true;
    setShrunk(true);
    void writeKipRoomShrunk(true);
  }, []);
  // The thumbnail: back to the top, and out of shrunk mode if the room was shrunk.
  const expand = useCallback(() => {
    if (shrunk) {
      shrunkChosen.current = true;
      setShrunk(false);
      setCollapsed('hidden');
      lastProgress.current = 0;
      void writeKipRoomShrunk(false);
    }
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  }, [shrunk]);

  const roomCard = shrunk ? null : (
    <RoomCard
      stage={stage}
      look={look}
      window={day.window}
      recovery={day.recovery}
      reduceMotion={reduceMotion}
      onOpenRecovery={openRecovery}
      onLayout={(e) => {
        cardBottom.current = e.nativeEvent.layout.y + e.nativeEvent.layout.height;
      }}
      footer={
        <Button testID="kip-shrink-room" variant="outline" className="w-full" onPress={shrink}>
          {KIP_COPY.shrinkRoom}
        </Button>
      }
    />
  );

  const ready = phase === 'ready' && !statusUnverified;
  const collapsedHeader = (
    <CollapsedKipHeader
      stage={stage}
      look={look}
      statusLine={kipStatusLine(stage.id, day.recovery, true)}
      window={day.window}
      reduceMotion={reduceMotion}
      onExpand={expand}
      onConversations={() => setSheetOpen(true)}
      onNewChat={startNewChat}
      showActions={ready}
    />
  );
  // Shrunk, the page starts with the collapsed header in place of the expanded one.
  const header = shrunk ? (
    <View testID="kip-collapsed-header">{collapsedHeader}</View>
  ) : (
    <View
      testID="kip-header"
      className="flex-row items-start justify-between px-5 pb-2 pt-1"
      onLayout={(e) => {
        headerHeight.current = e.nativeEvent.layout.height;
      }}
      // Under the collapsed header once it is fully in: screen readers get one set of header controls.
      accessibilityElementsHidden={collapsed === 'in'}
      importantForAccessibility={collapsed === 'in' ? 'no-hide-descendants' : 'auto'}
    >
      <View className="shrink gap-0.5">
        <PageTitle>{KIP_COPY.pageTitle}</PageTitle>
        {/* One line at any text size (truncated), so the header never grows. */}
        <Text testID="kip-status-line" numberOfLines={1} accessibilityLabel={spokenLine(statusLine)} className="text-caption text-muted-foreground">
          {statusLine}
        </Text>
      </View>
      {ready ? (
        <View className="flex-row gap-2">
          {/* Spec B adds Decorate first in this row. */}
          <Button
            testID="coach-conversations-button"
            variant="outline"
            size="icon-lg"
            accessibilityLabel={KIP_COPY.conversationsLabel}
            onPress={() => setSheetOpen(true)}
          >
            <Ionicons name="menu-outline" size={buttonIconSize('icon-lg')} color={colors.foreground} />
          </Button>
          <Button testID="coach-new-chat-button" variant="outline" size="icon-lg" accessibilityLabel={KIP_COPY.newChatLabel} onPress={startNewChat}>
            <Ionicons name="create-outline" size={buttonIconSize('icon-lg')} color={colors.foreground} />
          </Button>
        </View>
      ) : null}
    </View>
  );

  if (phase === 'loading') {
    return (
      <SafeAreaView className="flex-1 bg-background">
        {header}
        <ScrollView contentContainerStyle={STATE_CONTENT}>
          {roomCard}
          <View testID="coach-loading" className="gap-3">
            <Skeleton className="h-12 w-2/3" />
            <Skeleton className="ml-auto h-10 w-1/2" />
            <Skeleton className="h-16 w-3/4" />
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (phase === 'needs-consent') {
    return (
      <SafeAreaView className="flex-1 bg-background">
        {header}
        <ScrollView contentContainerStyle={STATE_CONTENT}>
          {roomCard}
          <KipStateCard
            kind="consent"
            onReview={() => navigation.navigate('CoachConsent', { prefill: lastPrefill.current })}
            onNotNow={() => navigation.navigate('Home')}
          />
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (phase === 'unavailable') {
    return (
      <SafeAreaView className="flex-1 bg-background">
        {header}
        <ScrollView contentContainerStyle={STATE_CONTENT}>
          {roomCard}
          <KipStateCard kind="unavailable" />
        </ScrollView>
      </SafeAreaView>
    );
  }

  const last = messages[messages.length - 1];
  const lastQuestion = [...messages].reverse().find((m) => m.role === 'user')?.text;

  return (
    <SafeAreaView className="flex-1 bg-background">
      {/* The collapsed header is pinned over the expanded one once the card has scrolled under it (§3.5). */}
      <View className="z-10">
        {header}
        {!shrunk && collapsed !== 'hidden' ? (
          <CollapsedHeaderFade fade={fade} reduceMotion={reduceMotion} takesTaps={collapsed === 'in'}>
            {collapsedHeader}
          </CollapsedHeaderFade>
        ) : null}
      </View>
      {/* KeyboardAvoidingView owns its paddingBottom on iOS, so the bar clearance sits on this wrapper. */}
      <View testID="coach-clearance" style={{ flex: 1, paddingBottom: keyboardVisible ? 0 : clearance }}>
        <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
          <ScrollView
            ref={scrollRef}
            testID="coach-scroll"
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ gap: 16, paddingHorizontal: 20, paddingVertical: 12, flexGrow: 1 }}
            onContentSizeChange={onContentSizeChange}
            onScrollBeginDrag={stopFollowing}
            onScrollEndDrag={followIfNearBottom}
            onMomentumScrollEnd={followIfNearBottom}
            onScroll={trackCollapse}
            scrollEventThrottle={16}
          >
            {roomCard}

            {chatNote ? (
              <Text testID={CHAT_NOTES[chatNote].testID} className="px-1 text-caption text-muted-foreground">
                {CHAT_NOTES[chatNote].text}
              </Text>
            ) : null}

            {statusUnverified ? (
              <Text testID="coach-status-unverified" className="px-1 text-caption text-muted-foreground">
                {KIP_COPY.statusUnverified}
              </Text>
            ) : null}

            <CoachToday summary={today} loading={todayLoading} onAsk={ask} />
            {/* The page's one disclaimer: CoachToday shows it beside its comparisons, the page otherwise. */}
            {!todayShowsFootnote(today) ? (
              <Text testID="coach-today-footnote" className="text-caption text-muted-foreground">
                {TODAY_FOOTNOTE}
              </Text>
            ) : null}

            {messages.length === 0 && !streaming ? (
              <View testID="coach-empty" className="items-center gap-4 py-4">
                <View className="items-center gap-1 px-4">
                  <Text accessibilityRole="header" className="text-center text-heading">
                    {KIP_COPY.emptyHeading}
                  </Text>
                  <Text className="text-center text-caption text-muted-foreground">{KIP_COPY.emptyBody}</Text>
                </View>
                <View className="w-full gap-2">
                  {/* Three rows on first open (spec §3.4). */}
                  {suggestedQuestions(today).slice(0, 3).map((question, index) => (
                    <PressableScale
                      key={question}
                      testID={`coach-suggestion-${index}`}
                      accessibilityRole="button"
                      onPress={() => ask(question)}
                      className="flex-row items-center justify-between rounded-tile border border-border bg-card px-4 py-3.5"
                    >
                      <Text className="shrink text-body">{question}</Text>
                      <Ionicons name="arrow-up" size={16} color={colors.muted} />
                    </PressableScale>
                  ))}
                </View>
              </View>
            ) : null}

            {messages.map((message) => {
              const showFollowUps = message === last && message.role === 'assistant' && !streaming && message.state === 'done' && !message.safety;
              const unsettledSafety = !!message.safety && !message.safety.overridden;
              return (
                <CoachMessageRow
                  key={message.clientKey ?? message.id}
                  message={message}
                  showFollowUps={showFollowUps}
                  lastQuestion={showFollowUps ? lastQuestion : undefined}
                  busy={showFollowUps || unsettledSafety ? streaming : false}
                  onAsk={ask}
                  onOverrideSafety={resendWithOverride}
                  onOpenSource={openSource}
                />
              );
            })}

            {showThinking ? (
              <View className="items-start">
                <ThinkingRow style={thinkingText} steps={steps} paused={!focused} testID="coach-thinking" />
              </View>
            ) : null}

            {error && error.kind !== 'offline' ? <ErrorCard error={error} onRetry={retryTurn} /> : null}
            {offline && !streaming ? <KipStateCard kind="offline" /> : null}
          </ScrollView>

          <View className="px-4 pb-2 pt-1">
            <PromptBar
              value={input}
              onChangeText={setInput}
              onSend={sendTyped}
              busy={streaming}
              onStop={stop}
              placeholder={KIP_COPY.promptPlaceholder}
              inputLabel={KIP_COPY.promptLabel}
            />
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

type CollapseState = 'hidden' | 'fading' | 'in';

/** Under Reduce Motion the collapsed header switches at the threshold, with no fade. */
function collapseState(progress: number, reduceMotion: boolean): CollapseState {
  if (progress >= 1) return 'in';
  return progress > 0 && !reduceMotion ? 'fading' : 'hidden';
}

// The pinned collapsed header, faded by the scroll (a shared value, so a scroll step never re-renders the page). It
// mounts when the fade starts, so its first frame already has the current opacity. Under Reduce Motion it is only
// mounted at the threshold, fully in. While fading in it is a picture only: no taps and no screen-reader focus.
function CollapsedHeaderFade({ fade, reduceMotion, takesTaps, children }: {
  fade: SharedValue<number>;
  reduceMotion: boolean;
  takesTaps: boolean;
  children: React.ReactNode;
}) {
  const style = useAnimatedStyle(() => ({ opacity: reduceMotion ? 1 : fade.value }));
  return (
    <Animated.View
      testID="kip-collapsed-header"
      className="absolute left-0 right-0 top-0 bg-background"
      pointerEvents={takesTaps ? 'auto' : 'none'}
      accessibilityElementsHidden={!takesTaps}
      importantForAccessibility={takesTaps ? 'auto' : 'no-hide-descendants'}
      style={style}
    >
      {children}
    </Animated.View>
  );
}

// True for STEPS_LINGER_MS after `waiting` turns false, when `allTicked`: the
// steps happen quickly, so the finished checklist stays up long enough to
// read. Steps persist after the turn (useCoachConversation), so the lingering
// row shows them all ticked. A turn that ended unticked (an error, a stop)
// drops the row at once.
function useStepsLinger(waiting: boolean, allTicked: boolean): boolean {
  const [lingering, setLingering] = useState(false);
  const wasWaiting = useRef(false);
  const allTickedRef = useRef(allTicked);
  allTickedRef.current = allTicked;
  useEffect(() => {
    if (waiting) {
      wasWaiting.current = true;
      setLingering(false);
      return undefined;
    }
    if (!wasWaiting.current) return undefined;
    wasWaiting.current = false;
    if (!allTickedRef.current) return undefined;
    setLingering(true);
    const timer = setTimeout(() => setLingering(false), STEPS_LINGER_MS);
    return () => clearTimeout(timer);
  }, [waiting]);
  return lingering;
}
