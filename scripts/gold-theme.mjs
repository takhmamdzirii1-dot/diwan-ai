import { readFileSync, writeFileSync } from 'fs';

const files = [
  'app/globals.css',
  'src/components/studio/StudioDashboard.tsx',
  'src/components/studio/DashboardSidebar.tsx',
  'src/components/studio/MessageBubble.tsx',
  'src/components/studio/StudioSidebar.tsx',
  'src/components/studio/StudioChat.tsx',
  'src/components/studio/StudioImage.tsx',
  'src/components/studio/StudioVideo.tsx',
  'src/components/studio/StudioWorkspace.tsx',
  'components/ui/claude-style-chat-input.tsx',
  'components/ui/v0-ai-chat.tsx',
  'src/components/AuthModal.tsx',
  'src/components/TopUpModal.tsx',
];

// Ordered replacement map: old -> new (Nardo + Champagne Gold)
const map = [
  // Root tokens
  ['--obsidian: #08090C;', '--obsidian: #16181A;'],
  ['--obsidian-2: #0D0E12;', '--obsidian-2: #1A1C1F;'],
  ['--cyan-glow: #00F5D4;', '--gold-accent: #E6C27A;'],
  ['--cyan-deep: #00B4D8;', '--gold-deep: #B8934A;'],
  ['--violet-glow: #9D4EDD;', '--nardo-line: rgba(255,255,255,0.08);'],
  ['--violet-deep: #7928CA;', '--nardo-surface: #212326;'],
  ['--ice: #00E5FF;', '--ice: #E6C27A;'],
  ['--champagne: #E8C87A;', '--champagne: #E6C27A;'],
  ['--champagne-bright: #F4DEA9;', '--champagne-bright: #F0DCAB;'],
  ['--champagne-dim: rgba(232, 200, 122, 0.45);', '--champagne-dim: rgba(230, 194, 122, 0.45);'],
  ['--teal: #1FD8B8;', '--teal: #E6C27A;'],
  ['--color-vantra-teal: #1FD8B8;', '--color-vantra-teal: #E6C27A;'],
  ['--color-vantra-teal-hover: #34E2C2;', '--color-vantra-teal-hover: #F0DCAB;'],

  // obsidian-bg
  ['radial-gradient(1100px 600px at 4% 10%, rgba(0, 245, 212, 0.06), transparent 60%)', 'radial-gradient(1000px 560px at 50% -8%, rgba(230, 194, 122, 0.05), transparent 62%)'],
  ['radial-gradient(1100px 600px at 96% 90%, rgba(157, 78, 221, 0.08), transparent 60%)', 'radial-gradient(900px 600px at 100% 100%, rgba(255, 255, 255, 0.025), transparent 60%)'],
  ['radial-gradient(700px 420px at 50% 0%, rgba(0, 180, 216, 0.04), transparent 65%)', ''],
  ['linear-gradient(180deg, #08090C 0%, #0D0E12 100%)', 'linear-gradient(180deg, #16181A 0%, #131518 100%)'],

  // Wing glows -> gold ambience
  ['background: radial-gradient(circle, rgba(0, 245, 212, 0.13) 0%, rgba(0, 180, 216, 0.05) 45%, transparent 70%);', 'background: radial-gradient(circle, rgba(230, 194, 122, 0.06) 0%, rgba(197, 160, 89, 0.025) 45%, transparent 70%);'],
  ['background: radial-gradient(circle, rgba(157, 78, 221, 0.16) 0%, rgba(121, 40, 202, 0.06) 45%, transparent 70%);', 'background: radial-gradient(circle, rgba(255, 255, 255, 0.03) 0%, rgba(255, 255, 255, 0.012) 45%, transparent 70%);'],

  // Nav pill
  ['linear-gradient(100deg, rgba(0, 245, 212, 0.14) 0%, rgba(157, 78, 221, 0.14) 100%)', 'linear-gradient(100deg, rgba(230, 194, 122, 0.13) 0%, rgba(230, 194, 122, 0.05) 100%)'],
  ['border: 1px solid rgba(0, 245, 212, 0.28);', 'border: 1px solid rgba(230, 194, 122, 0.32);'],
  ['box-shadow: 0 0 24px -8px rgba(0, 245, 212, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.06);', 'box-shadow: 0 0 24px -10px rgba(230, 194, 122, 0.45), inset 0 1px 0 rgba(255, 255, 255, 0.05);'],

  // Avatar ring conic
  ['conic-gradient(from 0deg, #00F5D4, #00B4D8, #9D4EDD, #7928CA, #00F5D4)', 'conic-gradient(from 0deg, #E6C27A, #B8934A, #F0DCAB, #8A6D3B, #E6C27A)'],

  // Neon dots -> champagne
  ['.neon-dot:nth-child(1) { background: #00F5D4; box-shadow: 0 0 9px #00F5D4; }', '.neon-dot:nth-child(1) { background: #E6C27A; box-shadow: 0 0 9px rgba(230,194,122,0.75); }'],
  ['.neon-dot:nth-child(2) { background: #00E5FF; box-shadow: 0 0 9px #00E5FF; animation-delay: 0.15s; }', '.neon-dot:nth-child(2) { background: #F0DCAB; box-shadow: 0 0 9px rgba(240,220,171,0.65); animation-delay: 0.15s; }'],
  ['.neon-dot:nth-child(3) { background: #9D4EDD; box-shadow: 0 0 9px #9D4EDD; animation-delay: 0.3s; }', '.neon-dot:nth-child(3) { background: #B8934A; box-shadow: 0 0 9px rgba(184,147,74,0.65); animation-delay: 0.3s; }'],

  // Sliders
  ['linear-gradient(90deg, rgba(0, 245, 212, 0.75), rgba(157, 78, 221, 0.75))', 'linear-gradient(90deg, rgba(230, 194, 122, 0.8), rgba(184, 147, 74, 0.8))'],
  ['box-shadow: 0 0 10px rgba(0, 229, 255, 0.8), 0 0 3px rgba(255, 255, 255, 0.9);', 'box-shadow: 0 0 10px rgba(230, 194, 122, 0.75), 0 0 3px rgba(255, 255, 255, 0.9);'],
  ['box-shadow: 0 0 10px rgba(0, 229, 255, 0.8);', 'box-shadow: 0 0 10px rgba(230, 194, 122, 0.7);'],

  // Legacy user bubble cyan -> neutral gloss
  ['border: 1px solid rgba(0, 245, 212, 0.22);', 'border: 1px solid rgba(255, 255, 255, 0.1);'],
  ['background: linear-gradient(135deg, rgba(0, 245, 212, 0.1) 0%, rgba(0, 180, 216, 0.05) 60%, rgba(255, 255, 255, 0.02) 100%);', 'background: linear-gradient(180deg, rgba(255, 255, 255, 0.085), rgba(255, 255, 255, 0.04));'],
  ['box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.07), 0 0 24px -12px rgba(0, 245, 212, 0.35);', 'box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.1), 0 14px 34px -18px rgba(0, 0, 0, 0.9);'],

  // Input shell gold frame
  ['rgba(31, 216, 184, 0.38),', 'rgba(230, 194, 122, 0.4),'],
  ['rgba(31, 216, 184, 0.75),', 'rgba(230, 194, 122, 0.75),'],
  ['0 0 46px -14px rgba(31, 216, 184, 0.22);', '0 0 46px -14px rgba(230, 194, 122, 0.18);'],
  ['0 0 70px -12px rgba(31, 216, 184, 0.38),', '0 0 70px -12px rgba(230, 194, 122, 0.3),'],
  ['background: linear-gradient(180deg, rgba(14, 16, 22, 0.92), rgba(8, 9, 13, 0.96));', 'background: linear-gradient(180deg, rgba(33, 35, 38, 0.94), rgba(22, 24, 26, 0.97));'],
  ['background: linear-gradient(180deg, rgba(7, 7, 10, 0.2), rgba(7, 7, 10, 0.9));', 'background: linear-gradient(180deg, rgba(22, 24, 26, 0.2), rgba(22, 24, 26, 0.9));'],
  ['radial-gradient(circle at 52% 26%, rgba(45, 29, 67, 0.24), transparent 30rem),', 'radial-gradient(circle at 50% 20%, rgba(230, 194, 122, 0.04), transparent 30rem),'],
  ['#07070a', '#16181A'],

  // Suggest card hover
  ['rgba(31, 216, 184, 0.09),', 'rgba(230, 194, 122, 0.08),'],
  ['border-color: rgba(31, 216, 184, 0.28);', 'border-color: rgba(230, 194, 122, 0.32);'],
  ['0 0 30px -12px rgba(31, 216, 184, 0.25);', '0 0 30px -12px rgba(230, 194, 122, 0.22);'],

  // AI panel top hairline
  ['linear-gradient(90deg, transparent, rgba(0,245,212,0.45), rgba(157,78,221,0.35), transparent)', 'linear-gradient(90deg, transparent, rgba(230,194,122,0.5), rgba(197,160,89,0.3), transparent)'],

  // Generic hex swaps (CSS + tailwind arbitrary values)
  ['#00F5D4', '#E6C27A'],
  ['#00B4D8', '#B8934A'],
  ['#00E5FF', '#E6C27A'],
  ['#9D4EDD', '#C5A059'],
  ['#7928CA', '#8A6D3B'],
  ['#1FD8B8', '#E6C27A'],
  ['#34E2C2', '#F0DCAB'],
  ['#34e2c2', '#f0dcab'],
  ['#0EA98E', '#8A6D3B'],
  ['#5ce8cf', '#F0DCAB'],
  ['#7FE8D4', '#E6C27A'],
  ['#E8C87A', '#E6C27A'],
  ['#F4DEA9', '#F0DCAB'],
  ['rgba(31, 216, 184', 'rgba(230, 194, 122'],
  ['rgba(31,216,184', 'rgba(230,194,122'],
  ['rgba(0, 245, 212', 'rgba(230, 194, 122'],
  ['rgba(0,245,212', 'rgba(230,194,122'],
  ['rgba(0, 229, 255', 'rgba(230, 194, 122'],
  ['rgba(0,229,255', 'rgba(230,194,122'],
  ['rgba(157, 78, 221', 'rgba(197, 160, 89'],
  ['rgba(157,78,221', 'rgba(197,160,89'],
  ['rgba(232, 200, 122', 'rgba(230, 194, 122'],
  ['rgba(232,200,122', 'rgba(230,194,122'],
  ['rgba(104, 78, 168', 'rgba(255, 255, 255'],
  ['rgba(64, 38, 110', 'rgba(60, 55, 45'],
  ['rgba(46, 30, 84', 'rgba(40, 38, 34'],
  ['#07070b', '#16181A'],
  ['bg-[#050506]', 'bg-[#16181A]'],
  ['bg-[#07070a]', 'bg-[#16181A]'],
  ['bg-[#0A0B0E]', 'bg-[#212326]'],
  ['bg-[#08080b]', 'bg-[#16181A]'],
  ['bg-[#0E1015]', 'bg-[#212326]'],
  ['bg-[#0E1016]', 'bg-[#212326]'],
  ['bg-[#050608]', 'bg-[#1A1C1F]'],
  ['bg-[#060609]', 'bg-[#1A1C1F]'],
  ['bg-[#0A0A0B]/95', 'bg-[#212326]/95'],
  ['bg-[#0A0B0F]/95', 'bg-[#212326]/95'],
  ['bg-[#0A0C11]/85', 'bg-[#1A1C1F]/90'],
  ['from-[#050506]', 'from-[#16181A]'],
  ['#050506 22%', '#16181A 30%'],
  ['rgba(5,5,6,0.88)', 'rgba(22,24,26,0.92)'],
  ['rgba(5,5,6,0.94)', 'rgba(22,24,26,0.94)'],
  ['rgba(5,5,6,0.6)', 'rgba(22,24,26,0.6)'],
  ['bg-[#0D0E12]', 'bg-[#1A1C1F]'],
  ['bg-[#07080B]', 'bg-[#1A1C1F]'],
  ['bg-[#0A0B0E]/95', 'bg-[#212326]/95'],
];

let totalChanges = 0;
for (const file of files) {
  let content;
  try {
    content = readFileSync(file, 'utf8');
  } catch {
    continue;
  }
  let changes = 0;
  for (const [from, to] of map) {
    if (content.includes(from)) {
      const parts = content.split(from);
      changes += parts.length - 1;
      content = parts.join(to);
    }
  }
  if (changes > 0) {
    writeFileSync(file, content, 'utf8');
    console.log(`${file}: ${changes} replacements`);
    totalChanges += changes;
  }
}
console.log(`TOTAL: ${totalChanges}`);
