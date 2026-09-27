import type { ChatIntent } from './intent-router';

/** Compact customer-language eval corpus; add cases here when a real phrasing fails. */
export const actionRoutingCases: ReadonlyArray<readonly [string, ChatIntent]> = [
  ['make a chart', 'create_chart'],
  ['mak a charte', 'create_chart'],
  ['crée un graphique', 'create_chart'],
  ['اعمل لي مخطط', 'create_chart'],
  ['اعطيني على شكل عرض تقديمي', 'create_presentation'],
  ['ديرها بوربوينت', 'create_presentation'],
  ['give it to me as pptx', 'create_presentation'],
  ['fais-moi ça en présentation', 'create_presentation'],
  ['اعطيني اياه في sheet', 'create_spreadsheet'],
  ['put this into Excel', 'export_xlsx'],
  ['give it to me txt', 'export_txt'],
  ['حطها في ملف نصي', 'export_txt'],
  ['give this to me as Markdown', 'export_md'],
  ['export this as JSON', 'export_json'],
  ['make this CSV', 'export_csv'],
  ['What is a chart?', 'normal_chat'],
  ['Explain PowerPoint', 'normal_chat'],
  ['ما هو PDF؟', 'normal_chat'],
];
