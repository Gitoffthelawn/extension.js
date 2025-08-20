import {describe, it, expect, vi, beforeEach, afterEach} from 'vitest'
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - private API acceptable in tests
import Module from 'module'

const paths = vi.hoisted(() => {
  const path = require('node:path') as typeof import('node:path')
  const base = __dirname
  return {
    chromium: path.resolve(base, '../run-chromium/index.ts'),
    firefox: path.resolve(base, '../run-firefox/index.ts'),
    chromeInspection: path.resolve(
      base,
      '../run-chromium/setup-chrome-inspection/index.ts'
    ),
    firefoxInspection: path.resolve(
      base,
      '../run-firefox/remote-firefox/setup-firefox-inspection/index.ts'
    )
  }
})

// Mocks capturing instances created by the plugin
let lastChromiumRunner: any = null
let lastFirefoxRunner: any = null
let lastChromeInspector: any = null
let lastFirefoxInspector: any = null

// Intercept CommonJS require used inside BrowsersPlugin.apply
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - private API acceptable in tests
const originalLoad = (Module as any)._load
beforeEach(() => {
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore - private API acceptable in tests
  ;(Module as any)._load = function (
    request: string,
    parent: any,
    isMain: boolean
  ) {
    const isFromBrowsersIndex = parent?.id?.endsWith(
      '/plugin-browsers/index.ts'
    )
    if (isFromBrowsersIndex && request === './run-chromium') {
      class RunChromiumPlugin {
        public opts: any
        public apply = vi.fn()
        constructor(opts: any) {
          this.opts = opts
          lastChromiumRunner = this
        }
      }
      return {RunChromiumPlugin}
    }
    if (isFromBrowsersIndex && request === './run-firefox') {
      class RunFirefoxPlugin {
        public opts: any
        public apply = vi.fn()
        constructor(opts: any) {
          this.opts = opts
          lastFirefoxRunner = this
        }
      }
      return {RunFirefoxPlugin}
    }
    return originalLoad(request as any, parent, isMain)
  } as any
})
afterEach(() => {
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore - private API acceptable in tests
  ;(Module as any)._load = originalLoad
})

vi.mock(paths.chromeInspection, () => {
  class SetupChromeInspectionStep {
    public opts: any
    public apply = vi.fn()
    constructor(opts: any) {
      this.opts = opts
      lastChromeInspector = this
    }
  }
  return {SetupChromeInspectionStep}
})

vi.mock(paths.firefoxInspection, () => {
  class SetupFirefoxInspectionStep {
    public opts: any
    public apply = vi.fn()
    constructor(opts: any) {
      this.opts = opts
      lastFirefoxInspector = this
    }
  }
  return {SetupFirefoxInspectionStep}
})

// Module under test
import {BrowsersPlugin} from '../index'

function createCompiler(mode: 'development' | 'production') {
  return {options: {mode}} as any
}

beforeEach(() => {
  lastChromiumRunner = null
  lastFirefoxRunner = null
  lastChromeInspector = null
  lastFirefoxInspector = null
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('BrowsersPlugin', () => {
  it('exposes a stable static name', () => {
    expect(BrowsersPlugin.name).toBe('plugin-browsers')
  })

  it('selects browser based on binary hints', () => {
    const chromium = new BrowsersPlugin({
      extension: ['/path/to/ext'],
      browser: 'firefox',
      chromiumBinary: '/custom/chromium'
    } as any)
    expect(chromium.browser).toBe('chromium-based')

    const gecko = new BrowsersPlugin({
      extension: ['/path/to/ext'],
      browser: 'chrome',
      geckoBinary: '/custom/firefox'
    } as any)
    expect(gecko.browser).toBe('gecko-based')
  })

  it('filters --load-extension flags from browserFlags and extension mix', () => {
    const plugin = new BrowsersPlugin({
      extension: ['/path/to/ext'],
      browser: 'chrome',
      browserFlags: ['--hide-scrollbars', '--load-extension=/another']
    } as any)

    // browserFlags should exclude any load-extension flags
    expect(plugin.browserFlags).toEqual(['--hide-scrollbars'])
    // extension property should remain as provided (no flags mixed in)
    expect(plugin.extension).toEqual(['/path/to/ext'])
  })

  it('dispatches to Chromium runner for chrome/edge/chromium-based', () => {
    const plugin = new BrowsersPlugin({
      extension: ['/path/to/ext'],
      browser: 'chrome',
      excludeBrowserFlags: ['--mute-audio']
    } as any)
    const compiler = createCompiler('development')
    plugin.apply(compiler)

    expect(lastChromiumRunner).toBeTruthy()
    expect(lastChromiumRunner.apply).toHaveBeenCalledTimes(1)
    expect(lastChromiumRunner.opts.browser).toBe('chrome')
    expect(lastChromiumRunner.opts.excludeBrowserFlags).toEqual([
      '--mute-audio'
    ])
  })

  it('dispatches to Firefox runner for firefox/gecko-based', () => {
    const plugin = new BrowsersPlugin({
      extension: ['/path/to/ext'],
      browser: 'firefox',
      excludeBrowserFlags: ['--mute-audio']
    } as any)
    const compiler = createCompiler('development')
    plugin.apply(compiler)

    expect(lastFirefoxRunner).toBeTruthy()
    expect(lastFirefoxRunner.apply).toHaveBeenCalledTimes(1)
    expect(lastFirefoxRunner.opts.browser).toBe('firefox')
    expect(lastFirefoxRunner.opts.excludeBrowserFlags).toEqual(['--mute-audio'])
  })

  it('sets up inspection steps in development mode only', () => {
    const chromium = new BrowsersPlugin({
      extension: ['/path/to/ext'],
      browser: 'chrome',
      startingUrl: 'http://example.test',
      port: 1234,
      instanceId: 'id-1',
      dryRun: true
    } as any)
    chromium.apply(createCompiler('development'))
    expect(lastChromeInspector).toBeTruthy()
    expect(lastChromeInspector.apply).toHaveBeenCalledTimes(1)
    expect(lastChromeInspector.opts.startingUrl).toBe('http://example.test')

    // Firefox path is analogous but we validate Chromium path here; Firefox
    // runner behavior is covered in a dedicated test above.

    const prod = new BrowsersPlugin({
      extension: ['/path/to/ext'],
      browser: 'chrome',
      dryRun: true
    } as any)
    prod.apply(createCompiler('production'))
    // No new inspector should be created in production (previous mocks remain from dev assertions)
    expect(lastChromeInspector.apply).toHaveBeenCalledTimes(1)
  })

  it('logs and rethrows for unsupported browsers', () => {
    const plugin = new BrowsersPlugin({
      extension: ['/path/to/ext'],
      // @ts-expect-error testing invalid browser
      browser: 'safari'
    })
    const compiler = createCompiler('development')
    expect(() => plugin.apply(compiler)).toThrowError()
    expect(console.error).toHaveBeenCalled()
  })
})
