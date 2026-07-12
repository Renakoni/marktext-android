<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import SettingsChoiceRow from './SettingsChoiceRow.vue'
import SettingsRow from './SettingsRow.vue'
import SettingsSection from './SettingsSection.vue'
import SettingsSelectRow from './SettingsSelectRow.vue'
import SettingsSliderRow from './SettingsSliderRow.vue'
import SettingsTextRow from './SettingsTextRow.vue'
import SettingsToggleRow from './SettingsToggleRow.vue'
import ToolbarQuickSettings from './ToolbarQuickSettings.vue'
import SelectionToolbarSettings from './SelectionToolbarSettings.vue'
import {
  SETTINGS_DETAIL_SECTIONS,
  type SettingsActionRow,
  type SettingsChoiceRow as SettingsChoiceDescriptor,
  type SettingsSliderRow as SettingsSliderDescriptor,
  type SettingsStatusRow,
  type SettingsTextRow as SettingsTextDescriptor,
  type SettingsToggleRow as SettingsToggleDescriptor,
} from '../settingsContent'
import { APP_LANGUAGE_OPTIONS, useI18n, type I18nKey } from '../../../lib/i18n'
import { SETTINGS_PAGES, type SettingsPage } from '../settingsNavigation'
import { useSettingsState } from '../settingsState'
import {
  isAdvancedMaintenanceActionId,
  type AdvancedMaintenanceActionId,
} from '../advancedSettings'
import { getAdvancedDiagnostics } from '../advancedDiagnostics'

const props = defineProps<{
  page: SettingsPage
  runMaintenanceAction?: (action: AdvancedMaintenanceActionId) => Promise<void> | void
}>()

const { locale, setLocale, t } = useI18n()
const { getValue, setValue } = useSettingsState()
const sections = computed(() => SETTINGS_DETAIL_SECTIONS[props.page] ?? [])
type MaintenanceActionId = AdvancedMaintenanceActionId

const maintenanceAction = ref<MaintenanceActionId | null>(null)
const maintenanceActionBusy = ref(false)
const maintenanceActionError = ref<string | null>(null)
const advancedDiagnostics = ref<Record<string, string>>({})
const maintenanceActionCopies: Record<
  MaintenanceActionId,
  {
    titleKey: I18nKey
    bodyKey: I18nKey
    actionKey: I18nKey
    confirmKey: I18nKey
    confirmTestId: string
    danger?: boolean
  }
> = {
  exportLogs: {
    titleKey: 'settings.maintenance.exportLogsTitle',
    bodyKey: 'settings.maintenance.exportLogsBody',
    actionKey: 'settings.maintenance.exportLogsAction',
    confirmKey: 'settings.maintenance.exportLogsConfirm',
    confirmTestId: 'settings-maintenance-export-confirm',
  },
  clearDrafts: {
    titleKey: 'settings.maintenance.clearDraftsTitle',
    bodyKey: 'settings.maintenance.clearDraftsBody',
    actionKey: 'settings.maintenance.clearDraftsAction',
    confirmKey: 'settings.maintenance.clearDraftsConfirm',
    confirmTestId: 'settings-maintenance-clear-confirm',
    danger: true,
  },
  resetSettings: {
    titleKey: 'settings.maintenance.resetSettingsTitle',
    bodyKey: 'settings.maintenance.resetSettingsBody',
    actionKey: 'settings.maintenance.resetSettingsAction',
    confirmKey: 'settings.maintenance.resetSettingsConfirm',
    confirmTestId: 'settings-maintenance-reset-confirm',
    danger: true,
  },
}
const activeMaintenanceActionCopy = computed(() =>
  maintenanceAction.value ? maintenanceActionCopies[maintenanceAction.value] : null,
)
const languageOptions = computed(() =>
  APP_LANGUAGE_OPTIONS.map(option => ({
    id: option.id,
    label: t(option.labelKey),
    testId: option.testId,
  })),
)

function setLanguage(value: string) {
  const nextLocale = APP_LANGUAGE_OPTIONS.find(option => option.id === value)?.id
  if (nextLocale) {
    setLocale(nextLocale)
  }
}

function getToggleValue(row: SettingsToggleDescriptor) {
  return getValue(row.id, row.defaultValue)
}

function getChoiceValue(row: SettingsChoiceDescriptor) {
  const value = getValue(row.id, row.defaultValue)
  return row.options.some(option => option.id === value) ? value : row.defaultValue
}

function getSliderValue(row: SettingsSliderDescriptor) {
  return getValue(row.id, row.defaultValue)
}

function getTextValue(row: SettingsTextDescriptor) {
  return getValue(row.id, row.defaultValue)
}

function optionLabels(row: SettingsChoiceDescriptor) {
  return row.options.map(option => ({
    id: option.id,
    label: t(option.labelKey),
    testId: `${row.testId}-option-${option.id.replace(/[^a-z0-9]+/gi, '-')}`,
  }))
}

function getActionValue(row: SettingsActionRow) {
  return row.valueKey ? t(row.valueKey) : undefined
}

function getStatusValue(row: SettingsStatusRow) {
  if (props.page === SETTINGS_PAGES.ADVANCED) {
    const value = advancedDiagnostics.value[row.id]
    if (value) {
      return value
    }
  }
  return t(row.valueKey)
}

function shouldShowCustomToolbar() {
  return getValue<string>('toolbarQuickBarMode', 'default') === 'custom'
}

function shouldShowSettingsRow(rowId: string) {
  if (props.page === SETTINGS_PAGES.APPEARANCE && rowId === 'customTheme') {
    return getValue<string>('themeMode', 'system') === 'custom'
  }
  return true
}

function setStoredValue(rowId: string, value: boolean | number | string) {
  setValue(rowId, value)
}

function getMaintenanceActionId(rowId: string): MaintenanceActionId | null {
  return isAdvancedMaintenanceActionId(rowId) ? rowId : null
}

function getMaintenanceActionCopy(rowId: string) {
  const maintenanceActionId = props.page === SETTINGS_PAGES.ADVANCED
    ? getMaintenanceActionId(rowId)
    : null
  return maintenanceActionId ? maintenanceActionCopies[maintenanceActionId] : null
}

function recordAction(row: SettingsActionRow) {
  const maintenanceActionId = props.page === SETTINGS_PAGES.ADVANCED
    ? getMaintenanceActionId(row.id)
    : null
  if (maintenanceActionId) {
    maintenanceAction.value = maintenanceActionId
    maintenanceActionError.value = null
    return
  }
  setValue(`action:${row.id}`, Date.now())
}

function closeMaintenanceSheet() {
  if (maintenanceActionBusy.value) {
    return
  }
  maintenanceAction.value = null
  maintenanceActionError.value = null
}

async function confirmMaintenanceAction() {
  const action = maintenanceAction.value
  if (!action || maintenanceActionBusy.value) {
    return
  }

  maintenanceActionBusy.value = true
  maintenanceActionError.value = null
  try {
    await props.runMaintenanceAction?.(action)
    maintenanceAction.value = null
  } catch (error) {
    maintenanceActionError.value = error instanceof Error
      ? error.message
      : t('settings.maintenance.genericError')
  } finally {
    maintenanceActionBusy.value = false
  }
}

watch(
  () => props.page,
  page => {
    if (page !== SETTINGS_PAGES.ADVANCED) {
      return
    }

    getAdvancedDiagnostics().then(result => {
      advancedDiagnostics.value = {
        deviceInfo: result.deviceInfo,
        webviewInfo: result.webViewInfo,
      }
    })
  },
  { immediate: true },
)
</script>

<template>
  <SettingsSection
    v-if="page === SETTINGS_PAGES.APPEARANCE"
    :title="t('settings.section.language')"
  >
    <SettingsChoiceRow
      :aria-label="t('settings.language.app')"
      :model-value="locale"
      :options="languageOptions"
      test-id="settings-language-app"
      @update:model-value="setLanguage"
    />
  </SettingsSection>

  <SettingsSection v-for="section in sections" :key="section.titleKey" :title="t(section.titleKey)">
    <template v-for="row in section.rows" :key="row.testId">
      <SettingsToggleRow
        v-if="shouldShowSettingsRow(row.id) && row.kind === 'toggle'"
        :label="t(row.labelKey)"
        :model-value="getToggleValue(row)"
        :test-id="row.testId"
        @update:model-value="value => setStoredValue(row.id, value)"
      />
      <SettingsSelectRow
        v-else-if="shouldShowSettingsRow(row.id) && row.kind === 'choice' && row.display === 'select'"
        :label="t(row.labelKey)"
        :model-value="getChoiceValue(row)"
        :options="optionLabels(row)"
        :test-id="row.testId"
        @update:model-value="value => setStoredValue(row.id, value)"
      />
      <SettingsChoiceRow
        v-else-if="shouldShowSettingsRow(row.id) && row.kind === 'choice'"
        :label="t(row.labelKey)"
        :model-value="getChoiceValue(row)"
        :options="optionLabels(row)"
        :test-id="row.testId"
        @update:model-value="value => setStoredValue(row.id, value)"
      />
      <SettingsSliderRow
        v-else-if="shouldShowSettingsRow(row.id) && row.kind === 'slider'"
        :label="t(row.labelKey)"
        :model-value="getSliderValue(row)"
        :min="row.min"
        :max="row.max"
        :step="row.step"
        :unit="row.unitKey ? t(row.unitKey) : undefined"
        :test-id="row.testId"
        @update:model-value="value => setStoredValue(row.id, value)"
      />
      <SettingsTextRow
        v-else-if="shouldShowSettingsRow(row.id) && row.kind === 'text'"
        :label="t(row.labelKey)"
        :model-value="getTextValue(row)"
        :placeholder="row.placeholderKey ? t(row.placeholderKey) : undefined"
        :multiline="row.multiline"
        :test-id="row.testId"
        @update:model-value="value => setStoredValue(row.id, value)"
      />
      <SettingsRow
        v-else-if="shouldShowSettingsRow(row.id) && row.kind === 'action'"
        :label="t(row.labelKey)"
        :value="getActionValue(row)"
        :action-label="getMaintenanceActionCopy(row.id) ? t(getMaintenanceActionCopy(row.id)!.actionKey) : undefined"
        :action-variant="getMaintenanceActionCopy(row.id)?.danger ? 'danger' : 'default'"
        :test-id="row.testId"
        button
        @activate="recordAction(row)"
      />
      <ToolbarQuickSettings
        v-else-if="shouldShowSettingsRow(row.id) && row.kind === 'customToolbar' && shouldShowCustomToolbar()"
        :test-id="row.testId"
      />
      <SelectionToolbarSettings
        v-else-if="shouldShowSettingsRow(row.id) && row.kind === 'customSelectionToolbar'"
        :test-id="row.testId"
      />
      <SettingsRow
        v-else-if="shouldShowSettingsRow(row.id) && row.kind === 'status'"
        :label="t(row.labelKey)"
        :value="getStatusValue(row)"
        :test-id="row.testId"
      />
    </template>
  </SettingsSection>

  <Transition name="editor-sheet">
    <section
      v-if="activeMaintenanceActionCopy"
      class="draft-save-sheet"
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-maintenance-title"
      data-testid="settings-maintenance-sheet"
      @click.self="closeMaintenanceSheet"
    >
      <div class="draft-save-panel">
        <h2 id="settings-maintenance-title">{{ t(activeMaintenanceActionCopy.titleKey) }}</h2>
        <p>{{ t(activeMaintenanceActionCopy.bodyKey) }}</p>
        <p v-if="maintenanceActionError" role="alert">
          {{ maintenanceActionError }}
        </p>
        <div class="draft-save-actions">
          <button
            type="button"
            :class="{ 'danger-action': activeMaintenanceActionCopy.danger, 'primary-action': !activeMaintenanceActionCopy.danger }"
            :disabled="maintenanceActionBusy"
            :aria-busy="maintenanceActionBusy ? 'true' : undefined"
            :data-testid="activeMaintenanceActionCopy.confirmTestId"
            @click="confirmMaintenanceAction"
          >
            {{ t(activeMaintenanceActionCopy.confirmKey) }}
          </button>
          <button
            type="button"
            :disabled="maintenanceActionBusy"
            data-testid="settings-maintenance-cancel"
            @click="closeMaintenanceSheet"
          >
            {{ t('editor.link.cancel') }}
          </button>
        </div>
      </div>
    </section>
  </Transition>
</template>
