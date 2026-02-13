import Handlebars from 'handlebars'
import type { TemplateData } from './types'

/**
 * Render a Handlebars template with the given data.
 */
export function renderTemplate(template: string, data: TemplateData): string {
  const compiled = Handlebars.compile(template)
  return compiled(data)
}
