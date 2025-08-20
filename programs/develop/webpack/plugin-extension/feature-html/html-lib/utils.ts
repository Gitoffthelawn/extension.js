import * as fs from 'fs'
import * as path from 'path'
import * as parse5utilities from 'parse5-utilities'
import {parseHtml} from './parse-html'
import {type FilepathList} from '../../../webpack-types'

export interface ParsedHtmlAsset {
  css?: string[]
  js?: string[]
  static?: string[]
}

export function getAssetsFromHtml(
  htmlFilePath: string | undefined,
  htmlContent?: string,
  publicPath: string = 'public'
) {
  const assets: ParsedHtmlAsset = {
    css: [],
    js: [],
    static: []
  }

  if (!htmlFilePath) {
    return assets
  }

  try {
    const htmlString =
      htmlContent || fs.readFileSync(htmlFilePath, {encoding: 'utf8'})

    if (!htmlString) {
      return assets
    }

    const htmlDocument = parse5utilities.parse(htmlString)

    const baseHref = getBaseHref(htmlDocument)

    const getAbsolutePath = (
      htmlFilePath: string,
      filePathWithParts: string
    ) => {
      const {cleanPath} = cleanAssetUrl(filePathWithParts)
      if (cleanPath.startsWith('/')) {
        // For public paths, preserve them as-is
        return cleanPath
      }
      // If base href is present and is not a URL, resolve relative to base
      const isBaseUrl = isUrl(baseHref || '')
      const baseJoin =
        baseHref && !isBaseUrl
          ? path.join(path.dirname(htmlFilePath), baseHref)
          : path.dirname(htmlFilePath)
      return path.join(baseJoin, cleanPath)
    }

    parseHtml(htmlDocument as any, ({filePath, assetType}) => {
      const fileAbsolutePath = getAbsolutePath(htmlFilePath, filePath)

      switch (assetType) {
        case 'script':
          assets.js?.push(fileAbsolutePath)
          break
        case 'css':
          assets.css?.push(fileAbsolutePath)
          break
        case 'staticSrc':
        case 'staticHref':
          if (filePath.startsWith('#')) {
            break
          }
          assets.static?.push(fileAbsolutePath)
          break
        default:
          break
      }
    })
  } catch (error) {
    // If file doesn't exist or can't be read, return empty assets
    return assets
  }

  return assets
}

export function getHtmlPageDeclaredAssetPath(
  filepathList: FilepathList,
  filePath: string,
  extension: string
): string {
  const entryname =
    Object.keys(filepathList).find((key) => {
      const includePath = filepathList[key] as string
      return (
        filepathList[key] === filePath ||
        getAssetsFromHtml(includePath)?.js?.includes(filePath) ||
        getAssetsFromHtml(includePath)?.css?.includes(filePath)
      )
    }) || ''

  const extname = getExtname(filePath)
  if (!entryname) return `${filePath.replace(extname, '')}${extension}`

  return `/${entryname.replace(extname, '')}${extension}`
}

export function getExtname(filePath: string): string {
  return path.extname(filePath)
}

export function getFilePath(
  filePath: string,
  extension: string,
  isPublic: boolean
): string {
  if (isPublic) {
    return `/${filePath}${extension}`
  }
  return `${filePath}${extension}`
}

export function isFromIncludeList(
  filePath: string,
  includeList?: FilepathList
): boolean {
  return Object.values(includeList || {}).some((value) => {
    return value === filePath
  })
}

export function isUrl(src: string) {
  try {
    // eslint-disable-next-line no-new
    new URL(src)
    return true
  } catch (err) {
    return false
  }
}

export function cleanAssetUrl(url: string): {
  cleanPath: string
  hash: string
  search: string
} {
  const hashIndex = url.indexOf('#')
  const queryIndex = url.indexOf('?')
  let endIndex = url.length
  if (hashIndex !== -1 && queryIndex !== -1) {
    endIndex = Math.min(hashIndex, queryIndex)
  } else if (hashIndex !== -1) {
    endIndex = hashIndex
  } else if (queryIndex !== -1) {
    endIndex = queryIndex
  }

  const cleanPath = url.slice(0, endIndex)
  const hash = hashIndex !== -1 ? url.slice(hashIndex) : ''
  const search =
    queryIndex !== -1
      ? url.slice(queryIndex, hashIndex !== -1 ? hashIndex : undefined)
      : ''
  return {cleanPath, hash, search}
}

export function getBaseHref(htmlDocument: any): string | undefined {
  // Look for <base href="...">
  const htmlChildren = htmlDocument.childNodes || []
  for (const node of htmlChildren) {
    if (node?.nodeName !== 'html') continue
    for (const child of node.childNodes || []) {
      if (child?.nodeName !== 'head') continue
      for (const headChild of child.childNodes || []) {
        if (headChild?.nodeName === 'base') {
          const href = headChild.attrs?.find(
            (a: any) => a.name === 'href'
          )?.value
          if (href) return href
        }
      }
    }
  }
  return undefined
}
