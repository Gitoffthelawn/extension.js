import * as path from 'path'
import {commonStyleLoaders} from './common-style-loaders'
import {DevOptions} from '../../develop-lib/config-types'
import {isContentScriptEntry} from './is-content-script'

export async function cssInContentScriptLoader(
  projectPath: string,
  mode: DevOptions['mode']
) {
  const isContentScript = (issuer: string) =>
    isContentScriptEntry(issuer, projectPath + '/manifest.json')

  // Define file type configurations
  const fileTypes = [
    {test: /\.css$/, loader: null},
    {
      test: /\.(sass|scss)$/,
      exclude: /\.module\.(sass|scss)$/,
      loader: 'sass-loader'
    },
    {test: /\.module\.(sass|scss)$/, loader: 'sass-loader'},
    {test: /\.less$/, exclude: /\.module\.less$/, loader: 'less-loader'},
    {test: /\.module\.less$/, loader: 'less-loader'}
  ]

  const rules = await Promise.all(
    fileTypes.map(async ({test, exclude, loader}) => {
      const baseConfig = {
        test,
        exclude,
        type: 'asset' as const,
        generator: {
          filename: 'content_scripts/[name].[contenthash:8].css'
        },
        issuer: isContentScript
      }

      if (!loader) {
        // Regular CSS - no preprocessor needed
        return {
          ...baseConfig,
          use: await commonStyleLoaders(projectPath, {
            mode: mode as 'development' | 'production'
          })
        }
      }

      // Preprocessor CSS
      const loaderOptions =
        loader === 'sass-loader'
          ? {sourceMap: true, sassOptions: {outputStyle: 'expanded'}}
          : {sourceMap: true}

      return {
        ...baseConfig,
        use: await commonStyleLoaders(projectPath, {
          mode: mode as 'development' | 'production',
          loader: require.resolve(loader),
          loaderOptions
        })
      }
    })
  )

  return rules
}
