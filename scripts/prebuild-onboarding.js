const fs = require('fs');
const p = 'src/lib/client-workflow.ts';
let t = fs.readFileSync(p, 'utf8');
t = t.replace("function firstName(name: string) {\n    return name.trim().split(/\\s+/)[0] || name;\n}", "function firstName(name: string) {\n    const parts = name.trim().split(/\\s+/).filter(Boolean);\n    if (!parts.length) return name;\n    if (parts.length === 1) return parts[0];\n    const cyr = /^[А-ЯЁа-яё-]+$/;\n    const surname = /(ов|ев|ёв|ин|ын|ский|цкий|ская|цкая|ова|ева|ёва|ина|ына)$/i;\n    if (cyr.test(parts[0]) && cyr.test(parts[1]) && surname.test(parts[0])) return parts[1];\n    const patronymic = /(вич|вна|ич|ична)$/i;\n    if (parts.length >= 3 && cyr.test(parts[2]) && patronymic.test(parts[2])) return parts[1];\n    return parts[0];\n}");
fs.writeFileSync(p, t);
console.log('prebuild onboarding patch applied');
