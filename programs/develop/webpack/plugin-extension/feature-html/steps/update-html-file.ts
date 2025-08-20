import fs from 'fs'
import {type Compiler} from '@rspack/core'
import {sources, Compilation} from '@rspack/core'
import {patchHtml} from '../html-lib/patch-html'
import {getFilePath} from '../html-lib/utils'
import * as utils from '../../../lib/utils'
import {type FilepathList, type PluginInterface} from '../../../webpack-types'

export class UpdateHtmlFile {
  public readonly manifestPath: string
  public readonly includeList?: FilepathList
  public readonly excludeList?: FilepathList
  public readonly browser?: string

  constructor(options: PluginInterface) {
    this.manifestPath = options.manifestPath
    this.includeList = options.includeList
    this.excludeList = options.excludeList
    this.browser = options.browser
  }

  public apply(compiler: Compiler): void {
    compiler.hooks.thisCompilation.tap(
      'html:update-html-file',
      (compilation) => {
        compilation.hooks.processAssets.tap(
          {
            name: 'html:update-html-file',
            stage: Compilation.PROCESS_ASSETS_STAGE_DERIVED
          },
          () => {
            if (compilation.errors.length > 0) return

            const htmlEntries = this.includeList || {}

            for (const field of Object.entries(htmlEntries)) {
              const [feature, resource] = field

              if (resource) {
                if (
                  !utils.shouldExclude(resource as string, this.excludeList)
                ) {
                  if (fs.existsSync(resource as string)) {
                    const updatedHtml = patchHtml(
                      compilation,
                      feature,
                      resource as string,
                      htmlEntries,
                      this.excludeList || {}
                    )

                    if (updatedHtml) {
                      const rawSource = new sources.RawSource(
                        updatedHtml.toString()
                      )
                      const filepath = getFilePath(feature, '.html', false)
                      compilation.updateAsset(filepath, rawSource)
                    }
                  }
                }
              }
            }
          }
        )
      }
    )
  }
}
