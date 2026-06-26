import { useCallback } from 'react';
import { useChatStore, flushStorage } from '../stores/chatStore';
import { useSettingsStore } from '../stores/settingsStore';
import { chatCompletionStream, chatCompletion } from '../api/chat';
import type { MessageNode } from '../stores/chatStore';
import type { Message } from '../types/api';

/**
 * P1-1: 统一的聊天完成 hook
 * 将 sendMessage/handleRegenerate 中重复的流式消费逻辑抽取为共享 hook
 */
export function useChatCompletion() {
  const {
    addMessage,
    updateMessage,
    setStreamingMessage,
    setAbortController,
    regenerateMessage,
    getParentUserMessage,
  } = useChatStore.getState();

  const getStore = useChatStore.getState;
  const getSettings = useSettingsStore.getState;

  /** 从当前消息向上遍历构建请求消息列表 */
  const buildRequestMessages = useCallback((upToMessageId: string): Message[] => {
    const state = getStore();
    const result: Message[] = [];
    const visited = new Set<string>();
    let currentId: string | null = upToMessageId;

    while (currentId && !visited.has(currentId)) {
      visited.add(currentId);
      const currentMsg: MessageNode | undefined = state.messages[currentId];
      if (!currentMsg) break;
      result.unshift({
        role: currentMsg.role,
        content: currentMsg.content as string | Message['content'],
      });
      currentId = currentMsg.parentId;
    }

    return result;
  }, [getStore]);

  /** 流式/非流式生成响应的核心逻辑 */
  const runCompletion = useCallback(async (
    assistantMessageId: string,
    requestMessages: Message[],
    activeModel: string,
  ) => {
    const { streamEnabled, reasoningEffort } = getSettings();
    const { updateMessage: update } = getStore();

    const abortController = new AbortController();
    setAbortController(abortController);

    const requestPayload: any = {
      model: activeModel,
      messages: requestMessages,
      stream: true,
    };
    if (reasoningEffort && reasoningEffort !== 'medium') {
      requestPayload.reasoning_effort = reasoningEffort;
    }

    try {
      if (streamEnabled) {
        const stream = chatCompletionStream(requestPayload, abortController.signal);

        // P0-1: requestAnimationFrame 节流
        let fullContent = '';
        let rafPending = false;
        const flushContent = () => {
          if (rafPending) return;
          rafPending = true;
          requestAnimationFrame(() => {
            update(assistantMessageId, { content: fullContent });
            rafPending = false;
          });
        };

        for await (const chunk of stream) {
          if (abortController.signal.aborted) break;
          const delta = chunk.choices?.[0]?.delta?.content || '';
          if (delta) {
            fullContent += delta;
            flushContent();
          }
        }
        // 确保最终内容已写入
        if (rafPending) {
          await new Promise<void>((resolve) => {
            requestAnimationFrame(() => {
              update(assistantMessageId, { content: fullContent });
              rafPending = false;
              resolve();
            });
          });
        }
      } else {
        const response = await chatCompletion({
          ...requestPayload,
          stream: false,
        }, abortController.signal);

        const assistantMessage = response.choices?.[0]?.message;
        if (assistantMessage) {
          update(assistantMessageId, { content: assistantMessage.content });
        }
      }
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        // 用户主动中断，保留已生成内容
      } else {
        const errorMsg = (error as Error).message || '未知错误';
        update(assistantMessageId, {
          content: errorMsg.includes('Failed to fetch')
            ? `⚠️ 网络连接失败，请检查网络或 API 地址配置。`
            : `错误: ${errorMsg}`,
          isError: true,
        });
      }
    } finally {
      setStreamingMessage(null);
      setAbortController(null);
      flushStorage();
    }
  }, [getStore, getSettings, setAbortController, setStreamingMessage]);

  /** 生成新的 assistant 响应 */
  const generateResponse = useCallback(async (
    userMessageId: string,
    conversationId: string,
  ) => {
    const state = getStore();
    const settings = getSettings();
    const requestMessages = buildRequestMessages(userMessageId);
    const conversation = state.conversations.find((c) => c.id === conversationId);
    const activeModel = conversation?.model && conversation.model !== 'auto'
      ? conversation.model
      : (settings.model === 'auto' ? 'auto' : settings.model);

    const assistantMessageId = addMessage(conversationId, userMessageId, {
      role: 'assistant',
      content: '',
    });

    updateMessage(assistantMessageId, { model: activeModel });
    setStreamingMessage(assistantMessageId);

    await runCompletion(assistantMessageId, requestMessages, activeModel);
  }, [getStore, getSettings, buildRequestMessages, addMessage, updateMessage, setStreamingMessage, runCompletion]);

  /** 使用相同/不同模型重新生成 */
  const handleRegenerate = useCallback(async (
    assistantMessageId: string,
    customModel?: string,
  ) => {
    const state = getStore();
    const settings = getSettings();
    const newAssistantId = regenerateMessage(assistantMessageId);
    if (!newAssistantId) return;

    const parentUser = getParentUserMessage(assistantMessageId);
    if (!parentUser) return;

    const requestMessages = buildRequestMessages(parentUser.id);
    const currentConv = state.conversations.find((c) => c.id === state.currentConversationId);
    const activeModel = customModel
      ? customModel
      : (currentConv?.model && currentConv.model !== 'auto'
        ? currentConv.model
        : (settings.model === 'auto' ? 'auto' : settings.model));

    updateMessage(newAssistantId, { model: activeModel });
    setStreamingMessage(newAssistantId);

    await runCompletion(newAssistantId, requestMessages, activeModel);
  }, [getStore, getSettings, buildRequestMessages, regenerateMessage, getParentUserMessage, updateMessage, setStreamingMessage, runCompletion]);

  /** 停止当前流式生成 */
  const handleStop = useCallback(() => {
    const { abortController } = getStore();
    if (abortController) {
      abortController.abort();
    }
  }, [getStore]);

  return { generateResponse, handleRegenerate, handleStop, buildRequestMessages };
}
