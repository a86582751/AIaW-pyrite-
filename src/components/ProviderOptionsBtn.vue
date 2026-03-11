<template>
  <q-btn
    icon="sym_o_page_info"
    :title="$t('providerOptionsBtn.providerOptions')"
    v-if="schema"
  >
    <q-menu
      anchor="top left"
      self="bottom left"
    >
      <json-input
        :schema
        v-model="options"
        component="item"
        :item-props="{
          class: 'px-3 py-1'
        }"
        :input-props="{
          filled: false,
          class: 'min-w-80px'
        }"
      />
    </q-menu>
  </q-btn>
</template>

<script setup lang="ts">
import { Boolean as TBoolean, Object as TObject, Number as TNumber, Optional, Unsafe } from '@sinclair/typebox'
import { computed, ref, watchEffect } from 'vue'
import JsonInput from './JsonInput.vue'
import { useI18n } from 'vue-i18n'
import { google } from '@ai-sdk/google'
import { inputValueEmpty, mergeObjects } from 'src/utils/functions'
import { anthropic } from '@ai-sdk/anthropic'
import { openai } from '@ai-sdk/openai'

const { t } = useI18n()

const props = defineProps<{
  providerName: string
  modelId: string
}>()

interface Rule {
  match: (provider: string, model: string) => boolean
  options: Record<string, any>
  default: Record<string, any>
  exec: (options: Record<string, any>) => { providerOptions: Record<string, any>, tools: Record<string, any> }
}

// 模型判断辅助函数
const isGPT51Model = (model: string) => /^gpt-5\.1/.test(model)
const isGPT52Model = (model: string) => /^gpt-5\.2/.test(model)
const isGPT54Model = (model: string) => /^gpt-5\.4/.test(model)
const isO3O4Model = (model: string) => /^(o3|o4)/.test(model)
const isGemini2Model = (model: string) => /^gemini-2\.[05]/.test(model)
const isGemini3Model = (model: string) => /^gemini-3(\.\d+)?-(flash|pro)/.test(model)
const isClaude4Model = (model: string) => /^claude-(opus|sonnet|haiku)-4/.test(model)
const isClaude37Model = (model: string) => /^claude-3-7/.test(model)

const rules: Rule[] = [
  // GPT-5.1 推理模型 - 支持reasoning_summary
  {
    match: (provider: string, model: string) =>
      provider.startsWith('openai.responses') && (isO3O4Model(model) || isGPT51Model(model) || model === 'o1'),
    options: {},
    default: {},
    exec: () => ({
      providerOptions: {
        openai: {
          reasoningSummary: 'auto'
        }
      },
      tools: {}
    })
  },
  // OpenAI Responses API - 联网搜索和代码执行（GPT-5.2/5.4不支持）
  {
    match: (provider: string, model: string) =>
      provider.startsWith('openai.responses') && !isGPT52Model(model) && !isGPT54Model(model),
    options: {
      webSearch: Optional(TBoolean({ title: t('providerOptionsBtn.webSearch') })),
      codeExecution: Optional(TBoolean({ title: t('providerOptionsBtn.codeExecution') })),
      textVerbosity: Optional(Unsafe({
        title: t('providerOptionsBtn.textVerbosity'),
        type: 'string',
        enum: ['low', 'medium', 'high']
      }))
    },
    default: {
      textVerbosity: 'medium'
    },
    exec: options => {
      const { webSearch, codeExecution, textVerbosity } = options
      const tools: Record<string, any> = {}
      if (webSearch) tools.web_search_preview = openai.tools.webSearchPreview({})
      if (codeExecution) tools.code_interpreter = openai.tools.codeInterpreter({})

      return {
        providerOptions: {
          openai: {
            textVerbosity
          }
        },
        tools
      }
    }
  },
  // OpenAI Chat Completions API - 推理强度设置
  {
    match: (provider: string, model: string) =>
      (provider.startsWith('openai.') || provider.startsWith('openai-compatible.')) &&
      (isO3O4Model(model) || model.startsWith('gpt-5') || model === 'o1'),
    options: {
      reasoningEffort: Optional(Unsafe({
        title: t('providerOptionsBtn.reasoningEffort'),
        type: 'string',
        enum: isGPT51Model(props.modelId)
          ? ['none', 'low', 'medium', 'high']
          : isGPT52Model(props.modelId)
            ? ['none', 'low', 'medium', 'high', 'xhigh']
            : ['low', 'medium', 'high']
      }))
    },
    default: {},
    exec: ({ reasoningEffort }) => {
      return {
        providerOptions: {
          openai: { reasoningEffort },
          'openai-compatible': { reasoningEffort }
        },
        tools: {}
      }
    }
  },
  // Gemini 2.x 和 3.x 系列 - 联网搜索、代码执行、思考模式
  {
    match: (provider: string, model: string) =>
      provider.startsWith('google.') && (isGemini2Model(model) || isGemini3Model(model)),
    options: {
      webSearch: Optional(TBoolean({ title: t('providerOptionsBtn.webSearch') })),
      codeExecution: Optional(TBoolean({ title: t('providerOptionsBtn.codeExecution') })),
      urlContext: Optional(TBoolean({ title: t('providerOptionsBtn.urlContext') })),
      thinkingBudget: Optional(TNumber({ title: t('providerOptionsBtn.thinkingBudget') }))
    },
    default: {},
    exec: options => {
      const tools: Record<string, any> = {}
      if (options.webSearch) tools.google_search = google.tools.googleSearch({})
      if (options.codeExecution) tools.code_execution = google.tools.codeExecution({})
      if (options.urlContext) tools.url_context = google.tools.urlContext({})

      const googleOptions: Record<string, any> = {
        thinkingConfig: {
          includeThoughts: true
        }
      }
      if (!inputValueEmpty(options.thinkingBudget)) {
        googleOptions.thinkingConfig.thinkingBudget = options.thinkingBudget
      }
      return {
        providerOptions: {
          google: googleOptions
        },
        tools
      }
    }
  },
  // Claude 4.x 和 3.7 - 联网搜索、代码执行、扩展思考
  {
    match: (provider: string, model: string) =>
      provider.startsWith('anthropic.') && (isClaude4Model(model) || isClaude37Model(model)),
    options: {
      webSearch: Optional(TBoolean({ title: t('providerOptionsBtn.webSearch') })),
      codeExecution: Optional(TBoolean({ title: t('providerOptionsBtn.codeExecution') })),
      extendedThinking: Optional(TBoolean({ title: t('providerOptionsBtn.extendedThinking') })),
      thinkingBudget: Optional(TNumber({ title: t('providerOptionsBtn.thinkingBudget'), default: 32000 }))
    },
    default: {},
    exec: options => {
      const tools: Record<string, any> = {}
      if (options.webSearch) tools.web_search = anthropic.tools.webSearch_20250305()
      if (options.codeExecution) tools.code_execution = anthropic.tools.codeExecution_20250522()

      const anthropicOptions: Record<string, any> = {}
      if (options.extendedThinking) {
        anthropicOptions.thinking = {
          type: 'enabled',
          budgetTokens: inputValueEmpty(options.thinkingBudget) ? 32000 : options.thinkingBudget
        }
      }
      return {
        providerOptions: {
          anthropic: anthropicOptions
        },
        tools
      }
    }
  }
]

const options = ref({})
const providerOptions = defineModel<Record<string, any>>('providerOptions')
const tools = defineModel<Record<string, any>>('tools')

const activeRules = computed(() => rules.filter(rule => rule.match(props.providerName, props.modelId)))

const schema = computed(() => {
  const matched = activeRules.value
  if (!matched.length) return null
  return TObject(mergeObjects(matched.map(rule => rule.options), 0))
})

watchEffect(() => {
  options.value = mergeObjects(activeRules.value.map(r => r.default), 0)
})

watchEffect(() => {
  const results = activeRules.value.map(r => r.exec(options.value))
  providerOptions.value = mergeObjects(results.map(r => r.providerOptions), 1)
  tools.value = mergeObjects(results.map(r => r.tools), 0)
})
</script>
