import {type Manifest, type FilepathList} from '../../../../webpack-types'
import {getFilename} from '../../../../webpack-lib/utils'

interface ContentObj {
  js?: string[] | undefined
  css?: string[] | undefined
}

export function contentScripts(manifest: Manifest, excludeList: FilepathList) {
  return (
    manifest.content_scripts && {
      content_scripts: manifest.content_scripts.map(
        (contentObj: ContentObj, index: number) => {
          // Manifest overrides work by getting the manifest.json
          // before compilation and re-naming the files to be
          // bundled. But in reality the compilation returns here
          // all the bundled files into a single script plus the
          // public files path. The hack below is to prevent having
          // multiple bundles with the same name.
          const contentJs = [...new Set(contentObj.js)]
          const contentCss = [...new Set(contentObj.css)]

          return {
            ...contentObj,
            js: [
              ...contentJs.map((js: string) => {
                return getFilename(
                  `content_scripts/content-${index}.js`,
                  js,
                  excludeList
                )
              })
            ],
            css: [
              ...contentCss.map((css: string) => {
                return getFilename(
                  `content_scripts/content-${index}.css`,
                  css,
                  excludeList
                )
              })
            ]
          }
        }
      )
    }
  )
}
