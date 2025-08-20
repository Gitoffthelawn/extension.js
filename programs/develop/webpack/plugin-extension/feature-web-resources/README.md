[empowering-image]: https://img.shields.io/badge/Empowering-Extension.js-0971fe
[empowering-url]: https://extension.js.org
[pr-welcome-image]: https://img.shields.io/badge/pull--requests-welcome-2ecc40
[pr-welcome-url]: https://github.com/extension-js/extension.js/pulls
[extensionjs-image]: https://img.shields.io/badge/Extension.js-0971fe

[![Empowering][empowering-image]][empowering-url] [![pull-requests][pr-welcome-image]][pr-welcome-url]

# @/webpack/plugin-extension/feature-web-resources

> Adds assets imported by content scripts to `web_accessible_resources` in `manifest.json`.

Emits and registers assets imported by `content_scripts` so pages can access them at runtime. During the build, it scans content script entries and collects auxiliary assets they import (for example images and styles). It then patches `manifest.json` to include those assets under `web_accessible_resources`, grouped by each content script’s `matches`. This module is part of the [Extension.js](https://extension.js.org) project.

### Output mapping

| Input (source)                                   | Output (dist)           | Notes                                                                                                          |
| ------------------------------------------------ | ----------------------- | -------------------------------------------------------------------------------------------------------------- |
| content script imports of images/fonts/etc.      | `assets/*`              | Imported static assets are emitted under `assets/` and added to the relevant `web_accessible_resources` group. |
| content script CSS (if emitted as separate file) | `content_scripts/*.css` | Some setups inject CSS instead of emitting a file; injected CSS will not appear in `web_accessible_resources`. |
| JavaScript and source maps                       | —                       | `.js` and `.map` are intentionally excluded from `web_accessible_resources`.                                   |

## Supported manifest fields

| Feature                    | Description                                                                                           |
| -------------------------- | ----------------------------------------------------------------------------------------------------- |
| `content_scripts`          | Reads `matches` and `js` to associate imported assets with the correct content script.                |
| `web_accessible_resources` | Writes/merges groups for MV3 or appends to array for MV2 with assets discovered from content scripts. |

> Note: Fields like `icons`, `action.default_icon`, `browser_action.default_icon`, `browser_action.theme_icons`, `page_action.default_icon`, and `sidebar_action.default_icon` are handled by the Icons feature module (`@/webpack/plugin-extension/feature-icons`), not by Web Resources.

## Usage

Standalone (manual lists):

```ts
import * as path from 'path'
import {WebResourcesPlugin} from '@/webpack/plugin-extension/feature-web-resources'

export default {
  // ...your rspack/webpack configuration
  plugins: [
    new WebResourcesPlugin({
      manifestPath: path.resolve(__dirname, 'manifest.json'),
      includeList: {
        // Tell the plugin which content script entries to associate
        // The key is the logical entry name; the value(s) are absolute file paths
        'content_scripts:content/scripts': [
          path.resolve(__dirname, 'content/scripts.js')
        ]
      }
    })
  ]
}
```

## Include/Exclude semantics

- `includeList`: a map of feature keys to absolute file paths (string or string[]). For this plugin, keys typically reference content script entries (e.g., `content_scripts:content/scripts`).
- `excludeList`: not used by this plugin. Exclusion typically applies to features that emit direct file paths from the manifest (e.g., Icons, JSON). For Web Resources, files are discovered by analyzing the graph of content script imports; if you need to prevent a specific asset from being emitted, exclude it at the bundler level (e.g., via loader config or alias), or avoid importing it from the content script.

## Output path mapping (summary)

- Imported static assets from content scripts → `assets/`
- If the build emits content script CSS as files → `content_scripts/*.css`
- `.js` and `.map` are excluded

## Compatibility

- Typed against `@rspack/core` and tested with Rspack.
- Webpack 5 may be compatible (similar compiler interfaces), but is not officially supported here.

## API

```ts
export interface PluginInterface {
  manifestPath: string
  includeList?: Record<string, string | string[]>
}

export class WebResourcesPlugin {
  constructor(options: PluginInterface)
}
```

- Manifest v3: resources are grouped by the exact `matches` set (normalized), merged per group, and sorted deterministically.
- Manifest v2: resources are appended to a flat array, de-duplicated and sorted.
- Source maps (`.map`) and JavaScript outputs (`.js`) are excluded.

## License

MIT (c) Cezar Augusto
