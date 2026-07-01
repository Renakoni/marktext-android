import type { MobileEditorCommandTarget } from './mobileCommands'

type MaybeHandled = boolean | void

interface MuyaCommandRuntime {
  undo?: () => void
  redo?: () => void
  format?: (type: string) => MaybeHandled
  updateParagraph?: (type: string) => MaybeHandled
}

function runPublicCommand(
  editor: MuyaCommandRuntime,
  command: ((type: string) => MaybeHandled) | undefined,
  type: string,
) {
  if (typeof command !== 'function') {
    return false
  }

  return command.call(editor, type)
}

export function createMuyaMobileEditorCommandTarget(
  editor: unknown,
): MobileEditorCommandTarget {
  const commandEditor = editor as MuyaCommandRuntime

  return {
    undo: () => commandEditor.undo?.(),
    redo: () => commandEditor.redo?.(),
    format: type => runPublicCommand(commandEditor, commandEditor.format, type),
    updateParagraph: type => runPublicCommand(commandEditor, commandEditor.updateParagraph, type),
  }
}
