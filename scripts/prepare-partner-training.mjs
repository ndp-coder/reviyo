// Prices and support details are resolved from the same configuration as the app.
// Then render locally with Windows System.Speech and render-partner-training.py.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import ts from 'typescript';

const root = fileURLToPath(new URL('../', import.meta.url));
function config(path) {
  const exports = {};
  const source = ts.transpileModule(readFileSync(root + path, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(source, { exports });
  return exports;
}
const { PLANS, formatRupees } = config('src/config/plans.ts');
const { legal } = config('src/config/legal.ts');
const small = ['zero','one','two','three','four','five','six','seven','eight','nine','ten','eleven','twelve','thirteen','fourteen','fifteen','sixteen','seventeen','eighteen','nineteen'];
const tens = ['', '', 'twenty','thirty','forty','fifty','sixty','seventy','eighty','ninety'];
function words(n) {
  if (!Number.isInteger(n) || n < 0 || n >= 100000) throw new Error('Update the price narration for this amount.');
  if (n < 20) return small[n];
  if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? ' ' + words(n % 10) : '');
  if (n < 1000) return words(Math.floor(n / 100)) + ' hundred' + (n % 100 ? ' and ' + words(n % 100) : '');
  return words(Math.floor(n / 1000)) + ' thousand' + (n % 1000 ? ' ' + words(n % 1000) : '');
}
const replacements = {
  monthlyDisplay: formatRupees(PLANS['1_month'].price), monthlySpeech: words(PLANS['1_month'].price),
  sixDisplay: formatRupees(PLANS['6_months'].price), sixSpeech: words(PLANS['6_months'].price),
  annualDisplay: formatRupees(PLANS['12_months'].price), annualSpeech: words(PLANS['12_months'].price),
  supportSpeech: legal.supportEmail.replace('@', ' at ').replaceAll('.', ' dot '),
};
const source = readFileSync(root + 'scripts/partner-training-content.json', 'utf8');
const resolved = source.replace(/\{(\w+)\}/g, (_, key) => {
  if (!(key in replacements)) throw new Error('Unknown training placeholder: ' + key);
  return replacements[key];
});
const content = JSON.parse(resolved);
content.recorded = new Date().toISOString().slice(0, 10);
mkdirSync(root + 'output/partner-training', { recursive: true });
writeFileSync(root + 'output/partner-training/content.json', JSON.stringify(content, null, 2));
console.log(`${content.chapters.length} chapters, ${content.chapters.flatMap(c => c.scenes).length} scenes. Prices read from app configuration.`);
