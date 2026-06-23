export const renderFileTemplate = (template: string, vars: Record<string, string>): string =>
  template.replace(/\{\{\s*([A-Za-z0-9_.-]+)\s*\}\}/g, (match, key: string) => vars[key] ?? match);
