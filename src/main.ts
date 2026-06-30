import { createApp } from 'vue'
import './style.css'
import App from './App.vue'
import { appLogger, installGlobalLogging } from './lib/logger'

installGlobalLogging()
appLogger.info('vue mount start')
createApp(App).mount('#app')
appLogger.info('vue mount complete')
