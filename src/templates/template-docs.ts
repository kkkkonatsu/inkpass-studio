import type { LocalizedText } from './schema'

export interface TemplateDocs {
  credits?: string
  license?: string
}

export interface LicensePreset {
  id: string
  name: string
  recommended?: boolean
  summary: LocalizedText
  text: string
}

export const CREDITS_STARTER_TEMPLATE = `Template Author: [Your Name / @handle]
Artwork / Design: [Artist Name / Link]
Fonts Used:
- [Font Name] by [Author] ([License / URL])

Links:
- [Website / X / Pixiv / GitHub URL]

Notes:
- Non-commercial fan-made template for InkPass Studio.
`

export const LICENSE_PRESETS: readonly LicensePreset[] = [
  {
    id: 'cc-by-nc-sa-4.0',
    name: 'CC BY-NC-SA 4.0',
    recommended: true,
    summary: {
      en: 'Recommended for fan templates — free for non-commercial use & remixes with credit; remixes must keep the same license.',
      ja: 'ファン制作向け推奨 — クレジット表記があれば非営利利用・改変OK（改変物も同じライセンスで共有）。',
      'zh-Hans': '推荐用于同人模板 — 署名即可非商业使用与二改，二改作品须沿用相同许可协议。',
      'zh-Hant': '推薦用於同人範本 — 標註出處即可非商業使用與改作，改作須沿用相同授權條款。',
    },
    text: `Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International (CC BY-NC-SA 4.0)

Copyright (c) [Year] [Author Name]

You are free to:
- Share: copy and redistribute this template in any medium or format.
- Adapt: remix, transform, and build upon this template.

Under the following terms:
- Attribution: You must give appropriate credit and indicate if changes were made.
- NonCommercial: You may not use this template for commercial purposes.
- ShareAlike: If you remix or build upon this template, you must distribute your contributions under the same license.

Full legal text: https://creativecommons.org/licenses/by-nc-sa/4.0/legalcode
`,
  },
  {
    id: 'cc-by-nc-4.0',
    name: 'CC BY-NC 4.0',
    summary: {
      en: 'Like CC BY-NC-SA, but remixes do not have to keep the same ShareAlike license. Still requires credit and stays non-commercial.',
      ja: 'クレジット表記・非営利利用が条件。改変OKで、改変物に同じライセンスを強制しません。',
      'zh-Hans': '与 CC BY-NC-SA 类似（需署名、限非商业、可二改），但不强制要求二改沿用同一协议。',
      'zh-Hant': '與 CC BY-NC-SA 類似（需標註出處、限非商業、可改作），但不強制改作沿用同一授權。',
    },
    text: `Creative Commons Attribution-NonCommercial 4.0 International (CC BY-NC 4.0)

Copyright (c) [Year] [Author Name]

You are free to:
- Share: copy and redistribute this template in any medium or format.
- Adapt: remix, transform, and build upon this template.

Under the following terms:
- Attribution: You must give appropriate credit and indicate if changes were made.
- NonCommercial: You may not use this template for commercial purposes.

Full legal text: https://creativecommons.org/licenses/by-nc/4.0/legalcode
`,
  },
  {
    id: 'cc-by-nc-nd-4.0',
    name: 'CC BY-NC-ND 4.0',
    summary: {
      en: 'Stricter — people can fill in & print IDs with credit (non-commercial), but cannot redistribute edited versions of your template artwork.',
      ja: 'より厳格 — クレジット表記での非営利ID作成・印刷はOKですが、改変したテンプレート素材の再配布は不可。',
      'zh-Hans': '更严格 — 署名后可非商业填写和打印证件，但不允许重新分发修改后的模板底图。',
      'zh-Hant': '較嚴格 — 標註出處後可非商業填寫與列印證件，但不可重新散布修改後的範本底圖。',
    },
    text: `Creative Commons Attribution-NonCommercial-NoDerivatives 4.0 International (CC BY-NC-ND 4.0)

Copyright (c) [Year] [Author Name]

You are free to:
- Share: copy and redistribute this unmodified template for personal, non-commercial ID generation and printing.

Under the following terms:
- Attribution: You must give appropriate credit.
- NonCommercial: You may not use this template for commercial purposes.
- NoDerivatives: If you remix, transform, or edit the template artwork, you may not distribute the modified material.

Full legal text: https://creativecommons.org/licenses/by-nc-nd/4.0/legalcode
`,
  },
  {
    id: 'cc-by-4.0',
    name: 'CC BY 4.0',
    summary: {
      en: 'Very permissive — anyone can use, remix, and share as long as they credit you (does not restrict commercial use).',
      ja: '非常に緩やか — クレジット表記のみで改変・再配布が可能（営利利用の制限なし）。',
      'zh-Hans': '非常宽松 — 只要署名即可自由使用、修改与分享（不限制商业用途）。',
      'zh-Hant': '非常寬鬆 — 只要標註出處即可自由使用、修改與分享（不限制商業用途）。',
    },
    text: `Creative Commons Attribution 4.0 International (CC BY 4.0)

Copyright (c) [Year] [Author Name]

You are free to:
- Share: copy and redistribute this template in any medium or format.
- Adapt: remix, transform, and build upon this template for any purpose.

Under the following terms:
- Attribution: You must give appropriate credit and indicate if changes were made.

Full legal text: https://creativecommons.org/licenses/by/4.0/legalcode
`,
  },
  {
    id: 'cc0-1.0',
    name: 'CC0 1.0 (Public Domain)',
    summary: {
      en: 'No rights reserved — anyone can use, modify, and share freely without even needing to give credit.',
      ja: 'パブリックドメイン — クレジット表記不要で誰でも自由に利用・改変・再配布できます。',
      'zh-Hans': '公有领域 — 放弃版权限制，任何人均可自由使用、修改和分发，无需署名。',
      'zh-Hant': '公眾領域 — 放棄著作權限制，任何人皆可自由使用、修改與散布，無需標註出處。',
    },
    text: `CC0 1.0 Universal (Public Domain Dedication)

To the extent possible under law, [Author Name] has waived all copyright and related or neighboring rights to this template.

You can copy, modify, distribute, and use this template freely without asking permission or giving attribution.

Full legal text: https://creativecommons.org/publicdomain/zero/1.0/legalcode
`,
  },
  {
    id: 'personal-use-only',
    name: 'Personal / Fan Use Only',
    summary: {
      en: 'Most restrictive — allows personal non-commercial ID creation & printing, but prohibits re-uploading or redistributing the blank template.',
      ja: '最も厳格 — 個人の非営利ID作成・印刷のみ許可し、無断転載や白紙テンプレートの再配布を禁止します。',
      'zh-Hans': '最严格 — 仅允许个人非商业生成与打印证件，禁止二次上传、商用或分发空白模板素材。',
      'zh-Hant': '最嚴格 — 僅允許個人非商業產生與列印證件，禁止二次上傳、商用或散布空白範本素材。',
    },
    text: `Personal / Fan Use Only — All Rights Reserved

Copyright (c) [Year] [Author Name]

Allowed:
- Generating and printing fictional ID cards for personal, non-commercial fan or cosplay use.
- Sharing images of your own filled-in ID cards (credit appreciated).

Not Allowed without prior written permission:
- Any commercial use or selling printed/digital cards made with this template.
- Re-uploading, reselling, or redistributing the blank template artwork or modified template files.
`,
  },
  {
    id: 'mit',
    name: 'MIT License',
    summary: {
      en: 'Standard open-source software license — ideal if your template is mostly code/JSON/SVG and you want maximum reuse with copyright notice.',
      ja: '定番のオープンソースライセンス — 主にJSONやSVGで構成されたテンプレートで、著作権表示のみで自由に再利用させたい場合に適しています。',
      'zh-Hans': '经典开源软件协议 — 适合以 JSON/SVG 代码为主的模板，仅需保留版权声明即可自由复用。',
      'zh-Hant': '經典開源軟體授權 — 適合以 JSON/SVG 程式碼為主的範本，僅需保留版權聲明即可自由重用。',
    },
    text: `MIT License

Copyright (c) [Year] [Author Name]

Permission is hereby granted, free of charge, to any person obtaining a copy of this template and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
`,
  },
]

export function hasTemplateDocs(docs?: TemplateDocs | null): boolean {
  return Boolean(docs?.credits?.trim() || docs?.license?.trim())
}

export function normalizeTemplateDocs(docs?: TemplateDocs | null): TemplateDocs | undefined {
  if (!docs) return undefined
  const credits = docs.credits?.trim() ? docs.credits : undefined
  const license = docs.license?.trim() ? docs.license : undefined
  if (!credits && !license) return undefined
  return {
    ...(credits ? { credits } : {}),
    ...(license ? { license } : {}),
  }
}

export function classifyTemplateDocFilename(fileName: string): 'credits' | 'license' | null {
  const base = fileName.split('/').filter(Boolean).pop()?.toLowerCase() ?? ''
  if (base === 'credits.txt' || base === 'credits.md' || base === 'credits') {
    return 'credits'
  }
  if (
    base === 'license.txt' ||
    base === 'license.md' ||
    base === 'license' ||
    base === 'licence.txt' ||
    base === 'licence.md' ||
    base === 'licence'
  ) {
    return 'license'
  }
  return null
}
