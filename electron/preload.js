'use strict'
const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('api', {
  window: {
    minimize: () => ipcRenderer.invoke('window:minimize'),
    maximize: () => ipcRenderer.invoke('window:maximize'),
    close:    () => ipcRenderer.invoke('window:close'),
  },
  steam: {
    getAccounts:     ()  => ipcRenderer.invoke('steam:getAccounts'),
    getActive:       ()  => ipcRenderer.invoke('steam:getActive'),
    getRunningGames: ()  => ipcRenderer.invoke('steam:getRunningGames'),
    getInstalledGames: (a) => ipcRenderer.invoke('steam:getInstalledGames', a),
    switchAccount:   (a) => ipcRenderer.invoke('steam:switchAccount', a),
    onSwitchStatus:  (cb) => {
      ipcRenderer.on('switch:status', (_, msg) => cb(msg))
      return () => ipcRenderer.removeAllListeners('switch:status')
    },
  },
  dod: {
    read:         ()  => ipcRenderer.invoke('dod:read'),
    action:       (a) => ipcRenderer.invoke('dod:action', a),
    recordTick:   (a) => ipcRenderer.invoke('dod:recordTick', a),
    getTickTimes: ()  => ipcRenderer.invoke('dod:getTickTimes'),
  },
  settings: {
    load: ()  => ipcRenderer.invoke('settings:load'),
    save: (a) => ipcRenderer.invoke('settings:save', a),
  },
  log: {
    get:   () => ipcRenderer.invoke('app:getLog'),
    clear: () => ipcRenderer.invoke('app:clearLog'),
  },
  updater: {
    install: () => ipcRenderer.invoke('update:install'),
    onAvailable:  (cb) => { ipcRenderer.on('update:available',  (_, d) => cb(d)); return () => ipcRenderer.removeAllListeners('update:available')  },
    onProgress:   (cb) => { ipcRenderer.on('update:progress',   (_, d) => cb(d)); return () => ipcRenderer.removeAllListeners('update:progress')   },
    onDownloaded: (cb) => { ipcRenderer.on('update:downloaded', (_, d) => cb(d)); return () => ipcRenderer.removeAllListeners('update:downloaded') },
    onError:      (cb) => { ipcRenderer.on('update:error',      (_, d) => cb(d)); return () => ipcRenderer.removeAllListeners('update:error')      },
  },
})
