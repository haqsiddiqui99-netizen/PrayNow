// Learn more: https://docs.expo.dev/guides/customizing-metro/

const { getDefaultConfig } = require('expo/metro-config')

const os = require('node:os')



/** @type {import('expo/metro-config').MetroConfig} */

const config = getDefaultConfig(__dirname)



const isWindows = process.platform === 'win32'

const mobileOnly = isWindows && process.env.EXPO_ENABLE_WEB !== '1'



// Windows + Node 22: parallel transformer workers die mid-stream

// ("Error: Premature close") and leave bundles stuck at 0% for minutes.

// maxWorkers 1 runs transforms in-process and is stable.

config.maxWorkers =

  Number(process.env.METRO_MAX_WORKERS) ||

  Number(process.env.REACT_NATIVE_MAX_WORKERS) ||

  (isWindows ? 1 : Math.min(2, os.cpus().length || 1))



// Mobile-only dev on Windows: browser/DevTools web requests otherwise trigger

// repeated multi-minute "Web Bundled … (1 module)" builds.

if (mobileOnly) {

  config.resolver.platforms = ['ios', 'android', 'native']

}



module.exports = config


